import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'package:onnxruntime/onnxruntime.dart';

/// Service for detecting person presence using ONNX Runtime on all platforms
class PersonDetectionService {
  static final PersonDetectionService _instance = PersonDetectionService._internal();
  factory PersonDetectionService() => _instance;
  PersonDetectionService._internal();

  CameraController? _cameraController;
  bool _isInitialized = false;
  bool _isDetecting = false;

  // Detection state
  final _personDetectedController = StreamController<bool>.broadcast();
  Stream<bool> get personDetectedStream => _personDetectedController.stream;

  bool _personPresent = false;
  DateTime? _lastDetectionTime;

  // ONNX objects
  OrtSession? _ortSession;
  OrtSessionOptions? _sessionOptions;

  // Configuration
  static const Duration _detectionTimeout = Duration(seconds: 3);
  static const Duration _detectionInterval = Duration(milliseconds: 500);
  static const double _confidenceThreshold = 0.5;
  static const int _personClassIndex = 1; // "person" class in COCO dataset

  Timer? _detectionTimer;
  Timer? _timeoutTimer;
  bool _isProcessing = false;

  /// Initialize camera and ONNX Runtime
  Future<void> initialize() async {
    if (_isInitialized) {
      print('[PERSON DETECTION] Already initialized');
      return;
    }

    try {
      print('[PERSON DETECTION] Initializing ONNX Runtime mode for ${Platform.operatingSystem}');
      await _initializeONNX();

      // Get available cameras
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw Exception('No cameras available');
      }

      // Use first available camera (typically front-facing)
      final camera = cameras.first;
      print('[PERSON DETECTION] Using camera: ${camera.name}');

      // Initialize camera controller
      _cameraController = CameraController(
        camera,
        ResolutionPreset.low, // Use low resolution for better performance
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid
            ? ImageFormatGroup.yuv420
            : ImageFormatGroup.bgra8888,
      );

      await _cameraController!.initialize();

      _isInitialized = true;
      print('[PERSON DETECTION] Initialized successfully (ONNX Runtime mode)');
    } catch (e) {
      print('[PERSON DETECTION] Error initializing: $e');
      rethrow;
    }
  }

  /// Initialize ONNX Runtime session
  Future<void> _initializeONNX() async {
    try {
      // Initialize ONNX Runtime
      OrtEnv.instance.init();

      // Create session options
      _sessionOptions = OrtSessionOptions();

      // Load ONNX model from assets
      final modelBytes = await rootBundle.load('assets/detect.onnx');
      final modelData = modelBytes.buffer.asUint8List();

      // Create ONNX Runtime session
      _ortSession = OrtSession.fromBuffer(modelData, _sessionOptions!);

      print('[PERSON DETECTION] ONNX model loaded successfully');
      print('[PERSON DETECTION] Model inputs: ${_ortSession!.inputNames}');
      print('[PERSON DETECTION] Model outputs: ${_ortSession!.outputNames}');
    } catch (e) {
      print('[PERSON DETECTION] Error loading ONNX model: $e');
      throw Exception('Failed to initialize ONNX Runtime: $e');
    }
  }

  /// Start person detection
  Future<void> startDetection() async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_isDetecting) {
      print('[PERSON DETECTION] Already detecting');
      return;
    }

    _isDetecting = true;
    print('[PERSON DETECTION] Starting detection (ONNX Runtime mode)');

    try {
      // Start image stream for detection
      await _cameraController!.startImageStream((CameraImage image) {
        _processImageAsync(image);
      });

      // Start periodic timeout check
      _timeoutTimer = Timer.periodic(_detectionInterval, (_) {
        _checkDetectionTimeout();
      });
    } catch (e) {
      print('[PERSON DETECTION] Error starting detection: $e');
      _isDetecting = false;
      rethrow;
    }
  }

  /// Stop person detection
  Future<void> stopDetection() async {
    if (!_isDetecting) {
      return;
    }

    print('[PERSON DETECTION] Stopping detection');
    _isDetecting = false;
    _detectionTimer?.cancel();
    _timeoutTimer?.cancel();

    try {
      await _cameraController?.stopImageStream();
    } catch (e) {
      print('[PERSON DETECTION] Error stopping image stream: $e');
    }
  }

  /// Process camera image asynchronously
  void _processImageAsync(CameraImage image) {
    if (!_isDetecting || _isProcessing) return;

    _isProcessing = true;

    _detectPersonONNX(image).then((detected) {
      if (detected) {
        _lastDetectionTime = DateTime.now();

        if (!_personPresent) {
          _personPresent = true;
          if (!_personDetectedController.isClosed) {
            _personDetectedController.add(true);
          }
          print('[PERSON DETECTION] Person detected');
        }
      }
      _isProcessing = false;
    }).catchError((e) {
      print('[PERSON DETECTION] Error processing image: $e');
      _isProcessing = false;
    });
  }

  /// Detect person using ONNX Runtime
  Future<bool> _detectPersonONNX(CameraImage image) async {
    if (_ortSession == null) {
      return false;
    }

    try {
      // Convert camera image to input tensor format (1200x1200 RGB for ONNX SSD MobileNet)
      final inputTensor = _convertCameraImageToONNXTensor(image);

      // Create ONNX value from tensor
      final inputOrt = OrtValueTensor.createTensorWithDataList(
        inputTensor,
        [1, 3, 1200, 1200], // NCHW format for ONNX
      );

      // Run inference
      final inputs = {'image': inputOrt};
      final runOptions = OrtRunOptions();
      final outputs = _ortSession!.run(runOptions, inputs);

      // Parse outputs
      // Output 0: bboxes [1, N, 4]
      // Output 1: labels [1, N]
      // Output 2: scores [1, N]

      if (outputs.isNotEmpty && outputs.length >= 3) {
        // Get outputs by index (outputs is a List<OrtValue?>)
        final labelsValue = outputs[1];
        final scoresValue = outputs[2];

        if (labelsValue != null && scoresValue != null) {
          final labelsData = labelsValue.value as List<dynamic>?;
          final scoresData = scoresValue.value as List<dynamic>?;

          if (scoresData != null && labelsData != null) {
            // Check each detection
            for (int i = 0; i < scoresData.length && i < labelsData.length; i++) {
              final score = scoresData[i] is List ? scoresData[i][0] : scoresData[i];
              final label = labelsData[i] is List ? labelsData[i][0] : labelsData[i];

              final scoreValue = score is num ? score.toDouble() : 0.0;
              final labelValue = label is num ? label.toInt() : 0;

              // Check if it's a person (class 1) with sufficient confidence
              if (labelValue == _personClassIndex && scoreValue >= _confidenceThreshold) {
                print('[PERSON DETECTION] Person detected with confidence: ${(scoreValue * 100).toStringAsFixed(1)}%');
                return true;
              }
            }
          }
        }
      }

      // Release outputs
      for (var output in outputs) {
        output?.release();
      }
      inputOrt.release();
      runOptions.release();

      return false;
    } catch (e) {
      print('[PERSON DETECTION] Error in ONNX detection: $e');
      return false;
    }
  }

  /// Convert CameraImage to ONNX tensor format (NCHW: 1, 3, 1200, 1200)
  List<double> _convertCameraImageToONNXTensor(CameraImage image) {
    const int inputSize = 1200;

    // Convert camera image to RGB
    img.Image? convertedImage;

    if (Platform.isAndroid) {
      convertedImage = _convertYUV420ToImage(image);
    } else {
      convertedImage = _convertBGRA8888ToImage(image);
    }

    if (convertedImage == null) {
      throw Exception('Failed to convert camera image');
    }

    // Resize to 1200x1200
    final resizedImage = img.copyResize(convertedImage, width: inputSize, height: inputSize);

    // Convert to NCHW format [1, 3, 1200, 1200] and normalize to [0, 1]
    final tensorData = <double>[];

    // Channel R
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData.add(pixel.r / 255.0);
      }
    }

    // Channel G
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData.add(pixel.g / 255.0);
      }
    }

    // Channel B
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData.add(pixel.b / 255.0);
      }
    }

    return tensorData;
  }

  /// Convert YUV420 to Image (Android)
  img.Image? _convertYUV420ToImage(CameraImage image) {
    try {
      final int width = image.width;
      final int height = image.height;
      final int uvRowStride = image.planes[1].bytesPerRow;
      final int uvPixelStride = image.planes[1].bytesPerPixel ?? 1;

      final img.Image convertedImage = img.Image(width: width, height: height);

      for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
          final int uvIndex = uvPixelStride * (x / 2).floor() + uvRowStride * (y / 2).floor();
          final int index = y * width + x;

          final yp = image.planes[0].bytes[index];
          final up = image.planes[1].bytes[uvIndex];
          final vp = image.planes[2].bytes[uvIndex];

          int r = (yp + vp * 1436 / 1024 - 179).round().clamp(0, 255);
          int g = (yp - up * 46549 / 131072 + 44 - vp * 93604 / 131072 + 91).round().clamp(0, 255);
          int b = (yp + up * 1814 / 1024 - 227).round().clamp(0, 255);

          convertedImage.setPixelRgb(x, y, r, g, b);
        }
      }

      return convertedImage;
    } catch (e) {
      print('[PERSON DETECTION] Error converting YUV420: $e');
      return null;
    }
  }

  /// Convert BGRA8888 to Image (iOS/Windows)
  img.Image? _convertBGRA8888ToImage(CameraImage image) {
    try {
      final int width = image.width;
      final int height = image.height;
      final bytes = image.planes[0].bytes;

      final img.Image convertedImage = img.Image(width: width, height: height);

      for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
          final int pixelIndex = (y * width + x) * 4;

          final int b = bytes[pixelIndex];
          final int g = bytes[pixelIndex + 1];
          final int r = bytes[pixelIndex + 2];
          // bytes[pixelIndex + 3] is alpha, not used

          convertedImage.setPixelRgb(x, y, r, g, b);
        }
      }

      return convertedImage;
    } catch (e) {
      print('[PERSON DETECTION] Error converting BGRA8888: $e');
      return null;
    }
  }

  /// Check if detection has timed out
  void _checkDetectionTimeout() {
    if (_lastDetectionTime == null) return;

    final timeSinceDetection = DateTime.now().difference(_lastDetectionTime!);

    if (timeSinceDetection > _detectionTimeout && _personPresent) {
      _personPresent = false;
      if (!_personDetectedController.isClosed) {
        _personDetectedController.add(false);
      }
      print('[PERSON DETECTION] No person (detection timeout)');
    }
  }

  /// Get camera controller for preview
  CameraController? get cameraController => _cameraController;

  /// Check if initialized
  bool get isInitialized => _isInitialized;

  /// Check if currently detecting
  bool get isDetecting => _isDetecting;

  /// Check if person is currently present
  bool get personPresent => _personPresent;

  /// Get current detection mode
  String get detectionMode => 'ONNX Runtime';

  /// Dispose resources
  Future<void> dispose() async {
    print('[PERSON DETECTION] Disposing service');
    await stopDetection();
    await _cameraController?.dispose();
    _ortSession?.release();
    _sessionOptions?.release();

    // Don't close the stream controller for singleton - just reset state
    _personPresent = false;
    _lastDetectionTime = null;
    _isInitialized = false;
    _cameraController = null;
    _ortSession = null;
    _sessionOptions = null;
  }
}
