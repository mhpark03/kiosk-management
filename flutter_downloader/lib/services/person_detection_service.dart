import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'package:onnxruntime/onnxruntime.dart';

// Platform-specific imports
import 'package:camera/camera.dart' if (dart.library.io) 'package:camera/camera.dart';
import 'package:flutter_lite_camera/flutter_lite_camera.dart' if (dart.library.io) 'package:flutter_lite_camera/flutter_lite_camera.dart';

/// Service for detecting person presence using ONNX Runtime on all platforms
class PersonDetectionService {
  static final PersonDetectionService _instance = PersonDetectionService._internal();
  factory PersonDetectionService() => _instance;
  PersonDetectionService._internal();

  // Android camera (camera package)
  CameraController? _cameraController;

  // Windows camera (flutter_lite_camera package)
  FlutterLiteCamera? _liteCamera;
  Timer? _captureTimer;

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

  Timer? _timeoutTimer;
  bool _isProcessing = false;

  // Camera warmup and error tracking
  int _consecutiveFailures = 0;
  static const int _maxConsecutiveFailures = 10; // Only warn after 10 consecutive failures
  bool _cameraWarmedUp = false;

  // Latest captured frame for preview (Windows only)
  Uint8List? _latestFrameData; // RGB888 raw data
  Uint8List? _latestFramePng;  // PNG encoded for display
  int _latestFrameWidth = 640;
  int _latestFrameHeight = 480;

  /// Initialize camera and ONNX Runtime
  Future<void> initialize() async {
    if (_isInitialized) {
      print('[PERSON DETECTION] Already initialized');
      return;
    }

    try {
      print('[PERSON DETECTION] Initializing ONNX Runtime mode for ${Platform.operatingSystem}');
      await _initializeONNX();

      if (Platform.isWindows) {
        // Windows: Initialize flutter_lite_camera
        print('[PERSON DETECTION] Using flutter_lite_camera for Windows');
        _liteCamera = FlutterLiteCamera();

        // Get available cameras
        final devices = await _liteCamera!.getDeviceList();
        if (devices.isEmpty) {
          throw Exception('No cameras available on Windows');
        }

        print('[PERSON DETECTION] Available cameras: $devices');

        // Open first camera (index 0)
        await _liteCamera!.open(0);
        print('[PERSON DETECTION] Windows camera opened successfully');

      } else if (Platform.isAndroid) {
        // Android: Initialize camera package
        final cameras = await availableCameras();
        if (cameras.isEmpty) {
          throw Exception('No cameras available');
        }

        final camera = cameras.first;
        print('[PERSON DETECTION] Using camera: ${camera.name}');

        _cameraController = CameraController(
          camera,
          ResolutionPreset.low,
          enableAudio: false,
          imageFormatGroup: ImageFormatGroup.yuv420,
        );

        await _cameraController!.initialize();
      }

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
      if (Platform.isWindows) {
        // Windows: Wait for camera to warm up before starting capture
        print('[PERSON DETECTION] Waiting 2 seconds for camera warmup...');
        await Future.delayed(const Duration(seconds: 2));
        _cameraWarmedUp = true;
        _consecutiveFailures = 0;

        // Windows: Use Timer to periodically capture frames
        print('[PERSON DETECTION] Starting periodic frame capture (${_detectionInterval.inMilliseconds}ms)');
        _captureTimer = Timer.periodic(_detectionInterval, (_) async {
          if (!_isDetecting || _isProcessing) return;

          try {
            final frame = await _liteCamera!.captureFrame();
            if (frame != null && frame.containsKey('data')) {
              final rgb888Data = frame['data'] as Uint8List;
              final width = frame['width'] as int? ?? 640;
              final height = frame['height'] as int? ?? 480;

              // Successful capture - reset failure counter
              _consecutiveFailures = 0;

              // Store latest frame for preview
              _latestFrameData = rgb888Data;
              _latestFrameWidth = width;
              _latestFrameHeight = height;

              // Convert RGB888 to PNG for preview (async to avoid blocking)
              _convertRGB888ToPngAsync(rgb888Data, width, height);

              _processRGB888Async(rgb888Data);
            }
          } catch (e) {
            _consecutiveFailures++;

            // Only log error after multiple consecutive failures
            if (_consecutiveFailures == _maxConsecutiveFailures) {
              print('[PERSON DETECTION] Camera capture failing consistently after $_maxConsecutiveFailures attempts: $e');
            }
          }
        });

      } else if (Platform.isAndroid) {
        // Android: Use camera package image stream
        await _cameraController!.startImageStream((CameraImage image) {
          _processImageAsync(image);
        });
      }

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
    _captureTimer?.cancel();
    _timeoutTimer?.cancel();
    _consecutiveFailures = 0;
    _cameraWarmedUp = false;

    try {
      if (Platform.isWindows) {
        // Windows: Release camera
        await _liteCamera?.release();
        print('[PERSON DETECTION] Windows camera released');
      } else if (Platform.isAndroid) {
        await _cameraController?.stopImageStream();
      }
    } catch (e) {
      print('[PERSON DETECTION] Error stopping image stream: $e');
    }
  }

  /// Convert RGB888 to PNG for preview (async)
  void _convertRGB888ToPngAsync(Uint8List rgb888Data, int width, int height) {
    // Run in background to avoid blocking
    Future(() {
      try {
        // Convert RGB888 to img.Image
        final image = img.Image(width: width, height: height);

        for (int y = 0; y < height; y++) {
          for (int x = 0; x < width; x++) {
            final int index = (y * width + x) * 3;
            final int r = rgb888Data[index];
            final int g = rgb888Data[index + 1];
            final int b = rgb888Data[index + 2];
            image.setPixelRgb(x, y, r, g, b);
          }
        }

        // Encode to PNG
        final pngBytes = img.encodePng(image);
        _latestFramePng = Uint8List.fromList(pngBytes);
      } catch (e) {
        print('[PERSON DETECTION] Error converting RGB888 to PNG: $e');
      }
    });
  }

  /// Process RGB888 data from Windows camera asynchronously
  void _processRGB888Async(Uint8List rgb888Data) {
    if (!_isDetecting || _isProcessing) return;

    _isProcessing = true;

    _detectPersonFromRGB888(rgb888Data).then((detected) {
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
      print('[PERSON DETECTION] Error processing RGB888: $e');
      _isProcessing = false;
    });
  }

  /// Process camera image asynchronously (Android)
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

  /// Detect person from RGB888 data (Windows)
  Future<bool> _detectPersonFromRGB888(Uint8List rgb888Data) async {
    if (_ortSession == null) {
      return false;
    }

    try {
      // flutter_lite_camera provides 640x480 RGB888
      const int width = 640;
      const int height = 480;

      // Convert RGB888 to img.Image
      final image = img.Image(width: width, height: height);

      for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
          final int index = (y * width + x) * 3;
          final int r = rgb888Data[index];
          final int g = rgb888Data[index + 1];
          final int b = rgb888Data[index + 2];
          image.setPixelRgb(x, y, r, g, b);
        }
      }

      // Convert to ONNX tensor
      final inputTensor = _convertImageToONNXTensor(image);

      return await _runONNXInference(inputTensor, [1, 3, 1200, 1200]);
    } catch (e) {
      print('[PERSON DETECTION] Error in RGB888 detection: $e');
      return false;
    }
  }

  /// Detect person using ONNX Runtime (Android)
  Future<bool> _detectPersonONNX(CameraImage image) async {
    if (_ortSession == null) {
      return false;
    }

    try {
      // Convert camera image to input tensor format
      final inputTensor = _convertCameraImageToONNXTensor(image);

      return await _runONNXInference(inputTensor, [1, 3, 1200, 1200]);
    } catch (e) {
      print('[PERSON DETECTION] Error in ONNX detection: $e');
      return false;
    }
  }

  /// Run ONNX inference (common for both platforms)
  Future<bool> _runONNXInference(Uint8List inputTensor, List<int> shape) async {
    OrtValueTensor? inputOrt;
    OrtRunOptions? runOptions;
    List<OrtValue?>? outputs;

    try {
      // Create ONNX value from tensor with uint8 data (Uint8List automatically uses uint8 type)
      inputOrt = OrtValueTensor.createTensorWithDataList(
        inputTensor,
        shape, // NCHW format for ONNX
      );

      // Run inference
      final inputs = {'inputs': inputOrt};  // Changed from 'image' to 'inputs' to match model input name
      runOptions = OrtRunOptions();
      outputs = _ortSession!.run(runOptions, inputs);

      // Parse outputs
      // Output 0: bboxes [1, N, 4]
      // Output 1: labels [1, N]
      // Output 2: scores [1, N]

      bool personDetected = false;

      if (outputs.isNotEmpty && outputs.length >= 3) {
        final labelsValue = outputs[1];
        final scoresValue = outputs[2];

        if (labelsValue != null && scoresValue != null) {
          final labelsData = labelsValue.value as List<dynamic>?;
          final scoresData = scoresValue.value as List<dynamic>?;

          if (scoresData != null && labelsData != null) {
            for (int i = 0; i < scoresData.length && i < labelsData.length; i++) {
              final score = scoresData[i] is List ? scoresData[i][0] : scoresData[i];
              final label = labelsData[i] is List ? labelsData[i][0] : labelsData[i];

              final scoreValue = score is num ? score.toDouble() : 0.0;
              final labelValue = label is num ? label.toInt() : 0;

              if (labelValue == _personClassIndex && scoreValue >= _confidenceThreshold) {
                print('[PERSON DETECTION] Person detected with confidence: ${(scoreValue * 100).toStringAsFixed(1)}%');
                personDetected = true;
                break;
              }
            }
          }
        }
      }

      // Release outputs
      if (outputs != null) {
        for (var output in outputs) {
          output?.release();
        }
      }
      inputOrt?.release();
      runOptions?.release();

      return personDetected;
    } catch (e, stackTrace) {
      print('[PERSON DETECTION] Error in ONNX inference: $e');
      print('[PERSON DETECTION] Stack trace: $stackTrace');

      // Clean up resources in case of error
      try {
        if (outputs != null) {
          for (var output in outputs) {
            output?.release();
          }
        }
        inputOrt?.release();
        runOptions?.release();
      } catch (cleanupError) {
        print('[PERSON DETECTION] Error cleaning up resources: $cleanupError');
      }

      return false;
    }
  }

  /// Convert img.Image to ONNX tensor format (common for both platforms)
  Uint8List _convertImageToONNXTensor(img.Image image) {
    const int inputSize = 1200;

    // Resize to 1200x1200
    final resizedImage = img.copyResize(image, width: inputSize, height: inputSize);

    // Convert to NCHW format [1, 3, 1200, 1200] as uint8 (0-255)
    final tensorData = Uint8List(1 * 3 * inputSize * inputSize);
    int index = 0;

    // Channel R
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData[index++] = pixel.r.toInt();
      }
    }

    // Channel G
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData[index++] = pixel.g.toInt();
      }
    }

    // Channel B
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData[index++] = pixel.b.toInt();
      }
    }

    return tensorData;
  }

  /// Convert CameraImage to ONNX tensor format (Android only)
  Uint8List _convertCameraImageToONNXTensor(CameraImage image) {
    // Convert camera image to RGB
    final convertedImage = _convertYUV420ToImage(image);

    if (convertedImage == null) {
      throw Exception('Failed to convert camera image');
    }

    return _convertImageToONNXTensor(convertedImage);
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

  /// Get camera controller for preview (Android only)
  CameraController? get cameraController => _cameraController;

  /// Get latest captured frame data as PNG (Windows only)
  Uint8List? get latestFramePng => _latestFramePng;

  /// Get latest captured frame data as RGB888 raw (Windows only)
  Uint8List? get latestFrameData => _latestFrameData;

  /// Get latest frame dimensions
  int get latestFrameWidth => _latestFrameWidth;
  int get latestFrameHeight => _latestFrameHeight;

  /// Check if initialized
  bool get isInitialized => _isInitialized;

  /// Check if currently detecting
  bool get isDetecting => _isDetecting;

  /// Check if person is currently present
  bool get personPresent => _personPresent;

  /// Get current detection mode
  String get detectionMode => Platform.isWindows ? 'ONNX Runtime (Windows)' : 'ONNX Runtime (Android)';

  /// Dispose resources
  Future<void> dispose() async {
    print('[PERSON DETECTION] Disposing service');
    await stopDetection();

    if (Platform.isAndroid) {
      await _cameraController?.dispose();
      _cameraController = null;
    } else if (Platform.isWindows) {
      await _liteCamera?.release();
      _liteCamera = null;
    }

    _ortSession?.release();
    _sessionOptions?.release();

    // Don't close the stream controller for singleton - just reset state
    _personPresent = false;
    _lastDetectionTime = null;
    _isInitialized = false;
    _ortSession = null;
    _sessionOptions = null;
    _consecutiveFailures = 0;
    _cameraWarmedUp = false;
    _latestFrameData = null;
    _latestFramePng = null;
  }
}
