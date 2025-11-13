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

/// Initialization progress information
class InitializationProgress {
  final double progress; // 0.0 to 1.0
  final String message;

  InitializationProgress(this.progress, this.message);
}

/// Detection status information
class DetectionStatus {
  final bool personPresent;
  final double latestConfidence; // 0.0 to 1.0
  final int totalDetections;
  final int successfulDetections;
  final bool isDetecting;
  final bool isInitialized;

  // Gender detection (automatic, no user action required)
  final String? gender; // 'male', 'female', 'unknown'
  final double? genderConfidence; // 0.0 to 1.0
  final int? facePixelSize; // Detected face size in pixels (for debugging)

  DetectionStatus({
    required this.personPresent,
    required this.latestConfidence,
    required this.totalDetections,
    required this.successfulDetections,
    required this.isDetecting,
    required this.isInitialized,
    this.gender,
    this.genderConfidence,
    this.facePixelSize,
  });

  double get successRate => totalDetections > 0 ? successfulDetections / totalDetections : 0.0;

  /// Check if gender detection is reliable enough for content customization
  bool get isGenderReliable => genderConfidence != null && genderConfidence! >= 0.4;

  /// Check if gender detection is highly confident
  bool get isGenderHighlyConfident => genderConfidence != null && genderConfidence! >= 0.7;
}

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

  // Initialization progress state
  final _initProgressController = StreamController<InitializationProgress>.broadcast();
  Stream<InitializationProgress> get initProgressStream => _initProgressController.stream;

  // Detection status state (for UI display)
  final _detectionStatusController = StreamController<DetectionStatus>.broadcast();
  Stream<DetectionStatus> get detectionStatusStream => _detectionStatusController.stream;

  bool _personPresent = false;
  DateTime? _lastDetectionTime;
  double _latestConfidence = 0.0; // Latest detection confidence (0.0 - 1.0)
  int _totalDetections = 0; // Total number of detection attempts
  int _successfulDetections = 0; // Number of successful person detections

  // Gender detection state
  String? _latestGender; // 'male', 'female', 'unknown'
  double? _latestGenderConfidence; // 0.0 to 1.0
  int? _latestFacePixelSize; // Face size in pixels

  // ONNX objects
  OrtSession? _ortSession; // Person detection model
  OrtSessionOptions? _sessionOptions;
  OrtSession? _genderSession; // Gender classification model
  OrtSessionOptions? _genderSessionOptions;

  // Configuration
  static const Duration _detectionTimeout = Duration(seconds: 30); // 30 seconds timeout for kiosk use
  static const Duration _detectionInterval = Duration(milliseconds: 500);
  static const double _confidenceThreshold = 0.6; // 60% confidence threshold for person detection
  static const double _genderConfidenceThreshold = 0.4; // 40% threshold for gender (lower for automatic detection)
  static const int _personClassIndex = 1; // "person" class in COCO dataset
  static const int _minFaceSizeForGender = 40; // Minimum face size (pixels) to attempt gender detection

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
      return;
    }

    try {
      print('[PERSON DETECTION] Initializing ONNX Runtime mode for ${Platform.operatingSystem}');

      // Step 1: Initialize ONNX (0% - 40%)
      _initProgressController.add(InitializationProgress(0.0, 'AI 모델 로딩 중...'));
      await _initializeONNX();
      _initProgressController.add(InitializationProgress(0.4, 'AI 모델 로딩 완료'));

      if (Platform.isWindows) {
        // Windows: Initialize flutter_lite_camera
        _initProgressController.add(InitializationProgress(0.5, '카메라 초기화 중...'));
        _liteCamera = FlutterLiteCamera();

        // Get available cameras
        final devices = await _liteCamera!.getDeviceList();
        if (devices.isEmpty) {
          throw Exception('No cameras available on Windows');
        }

        print('[PERSON DETECTION] Available Windows cameras: $devices');

        // Open first camera (index 0) - usually the built-in front camera on laptops
        // If wrong camera is selected, change the index (0, 1, 2, etc.)
        await _liteCamera!.open(0);
        print('[PERSON DETECTION] Opened Windows camera index: 0');
        _initProgressController.add(InitializationProgress(0.8, '카메라 초기화 완료'));

      } else if (Platform.isAndroid) {
        // Android: Initialize camera package
        _initProgressController.add(InitializationProgress(0.5, '카메라 초기화 중...'));
        final cameras = await availableCameras();
        if (cameras.isEmpty) {
          throw Exception('No cameras available');
        }

        // Find front camera (for kiosk use - facing the user)
        CameraDescription? frontCamera;
        try {
          frontCamera = cameras.firstWhere(
            (camera) => camera.lensDirection == CameraLensDirection.front,
          );
          print('[PERSON DETECTION] Using front camera: ${frontCamera.name}');
        } catch (e) {
          // If no front camera found, use first available camera
          frontCamera = cameras.first;
          print('[PERSON DETECTION] No front camera found, using: ${frontCamera.name}');
        }

        _initProgressController.add(InitializationProgress(0.6, '카메라 설정 중...'));
        _cameraController = CameraController(
          frontCamera,
          ResolutionPreset.low,
          enableAudio: false,
          imageFormatGroup: ImageFormatGroup.yuv420,
        );

        await _cameraController!.initialize();
        _initProgressController.add(InitializationProgress(0.8, '카메라 초기화 완료'));
      }

      _isInitialized = true;
      print('[PERSON DETECTION] Initialized successfully');
    } catch (e) {
      print('[PERSON DETECTION] Error initializing: $e');
      rethrow;
    }
  }

  /// Initialize ONNX Runtime session
  Future<void> _initializeONNX() async {
    try {
      print('[PERSON DETECTION] Initializing ONNX Runtime...');

      // Initialize ONNX Runtime
      OrtEnv.instance.init();
      print('[PERSON DETECTION] ONNX Runtime environment initialized');

      // Create session options for person detection
      _sessionOptions = OrtSessionOptions();
      print('[PERSON DETECTION] ONNX session options created');

      // Load person detection ONNX model from assets
      print('[PERSON DETECTION] Loading person detection model from assets...');
      final modelBytes = await rootBundle.load('assets/detect.onnx');
      final modelData = modelBytes.buffer.asUint8List();
      print('[PERSON DETECTION] Person detection model loaded: ${modelData.length} bytes');

      // Create ONNX Runtime session for person detection
      print('[PERSON DETECTION] Creating person detection session...');
      _ortSession = OrtSession.fromBuffer(modelData, _sessionOptions!);
      print('[PERSON DETECTION] Person detection session created successfully');

      // Load gender classification model (optional - will continue if not found)
      try {
        print('[GENDER DETECTION] Loading gender classification model...');
        _genderSessionOptions = OrtSessionOptions();
        final genderModelBytes = await rootBundle.load('assets/gender_classifier.onnx');
        final genderModelData = genderModelBytes.buffer.asUint8List();
        print('[GENDER DETECTION] Gender model loaded: ${genderModelData.length} bytes');

        _genderSession = OrtSession.fromBuffer(genderModelData, _genderSessionOptions!);
        print('[GENDER DETECTION] Gender classification session created successfully');
      } catch (e) {
        print('[GENDER DETECTION] Gender model not found or failed to load: $e');
        print('[GENDER DETECTION] Continuing without gender detection...');
        _genderSession = null;
      }
    } catch (e, stackTrace) {
      print('[PERSON DETECTION] Error loading ONNX model: $e');
      print('[PERSON DETECTION] Stack trace: $stackTrace');
      throw Exception('Failed to initialize ONNX Runtime: $e');
    }
  }

  /// Start person detection
  Future<void> startDetection() async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_isDetecting) {
      return;
    }

    _isDetecting = true;

    try {
      _initProgressController.add(InitializationProgress(0.9, '감지 시스템 시작 중...'));

      if (Platform.isWindows) {
        // Windows: Wait for camera to warm up before starting capture
        await Future.delayed(const Duration(seconds: 2));
        _cameraWarmedUp = true;
        _consecutiveFailures = 0;

        // Windows: Use Timer to periodically capture frames
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
        print('[PERSON DETECTION] Starting Android camera image stream...');
        await _cameraController!.startImageStream((CameraImage image) {
          print('[PERSON DETECTION] Image stream callback received (${image.width}x${image.height})');
          _processImageAsync(image);
        });
        print('[PERSON DETECTION] Android camera image stream started');
      }

      // Start periodic timeout check
      _timeoutTimer = Timer.periodic(_detectionInterval, (_) {
        _checkDetectionTimeout();
      });

      // Initialization complete
      _initProgressController.add(InitializationProgress(1.0, '초기화 완료'));
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

    _isDetecting = false;
    _captureTimer?.cancel();
    _timeoutTimer?.cancel();
    _consecutiveFailures = 0;
    _cameraWarmedUp = false;

    try {
      if (Platform.isWindows) {
        // Windows: Release camera
        await _liteCamera?.release();
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
      _emitDetectionStatus(); // Emit status update after each detection
      _isProcessing = false;
    }).catchError((e) {
      print('[PERSON DETECTION] Error processing RGB888: $e');
      _isProcessing = false;
    });
  }

  /// Process camera image asynchronously (Android)
  void _processImageAsync(CameraImage image) {
    if (!_isDetecting) {
      print('[PERSON DETECTION] Skipping image - not detecting');
      return;
    }

    if (_isProcessing) {
      // Only log occasionally to avoid spam
      if (_totalDetections % 50 == 0) {
        print('[PERSON DETECTION] Skipping image - still processing previous frame');
      }
      return;
    }

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
      _emitDetectionStatus(); // Emit status update after each detection
      _isProcessing = false;
    }).catchError((e, stackTrace) {
      print('[PERSON DETECTION] Error processing image: $e');
      print('[PERSON DETECTION] Stack trace: $stackTrace');
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

      return await _runONNXInference(inputTensor, [1, 1200, 1200, 3]); // NHWC format
    } catch (e) {
      print('[PERSON DETECTION] Error in RGB888 detection: $e');
      return false;
    }
  }

  /// Detect person using ONNX Runtime (Android)
  Future<bool> _detectPersonONNX(CameraImage image) async {
    if (_ortSession == null) {
      print('[PERSON DETECTION] ERROR: ONNX session is null!');
      return false;
    }

    try {
      // Convert camera image to input tensor format
      final inputTensor = _convertCameraImageToONNXTensor(image);

      return await _runONNXInference(inputTensor, [1, 1200, 1200, 3]); // NHWC format
    } catch (e, stackTrace) {
      print('[PERSON DETECTION] Error in ONNX detection: $e');
      print('[PERSON DETECTION] Stack trace: $stackTrace');
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
      double maxConfidence = 0.0;

      _totalDetections++; // Increment detection attempts

      if (outputs.isNotEmpty && outputs.length >= 3) {
        final labelsValue = outputs[1];
        final scoresValue = outputs[2];

        if (labelsValue != null && scoresValue != null) {
          final labelsData = labelsValue.value as List<dynamic>?;
          final scoresData = scoresValue.value as List<dynamic>?;

          if (scoresData != null && labelsData != null) {
            // Log total detections for debugging
            if (_totalDetections % 10 == 0) {
              print('[PERSON DETECTION] Detection attempt #$_totalDetections (${scoresData.length} objects detected)');
            }

            for (int i = 0; i < scoresData.length && i < labelsData.length; i++) {
              final score = scoresData[i] is List ? scoresData[i][0] : scoresData[i];
              final label = labelsData[i] is List ? labelsData[i][0] : labelsData[i];

              final scoreValue = score is num ? score.toDouble() : 0.0;
              final labelValue = label is num ? label.toInt() : 0;

              // Track highest confidence for person class
              if (labelValue == _personClassIndex && scoreValue > maxConfidence) {
                maxConfidence = scoreValue;
              }

              if (labelValue == _personClassIndex && scoreValue >= _confidenceThreshold) {
                print('[PERSON DETECTION] ✓ Person detected with confidence: ${(scoreValue * 100).toStringAsFixed(1)}%');
                personDetected = true;
                _successfulDetections++;
                break;
              }
            }
          }
        }
      }

      // Update latest confidence (even if below threshold, for debugging)
      _latestConfidence = maxConfidence;

      // Log when person class is detected but confidence is too low
      if (maxConfidence > 0 && maxConfidence < _confidenceThreshold) {
        // Only log occasionally to avoid spam (every 20 attempts)
        if (_totalDetections % 20 == 0) {
          print('[PERSON DETECTION] Person detected but confidence too low: ${(maxConfidence * 100).toStringAsFixed(1)}% (threshold: ${(_confidenceThreshold * 100).toStringAsFixed(0)}%)');
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

    // Convert to NHWC format [1, 1200, 1200, 3] as uint8 (0-255)
    // TensorFlow models expect NHWC format: height, width, channels
    final tensorData = Uint8List(1 * inputSize * inputSize * 3);
    int index = 0;

    // Interleave RGB values (NHWC format)
    for (int y = 0; y < inputSize; y++) {
      for (int x = 0; x < inputSize; x++) {
        final pixel = resizedImage.getPixel(x, y);
        tensorData[index++] = pixel.r.toInt(); // R
        tensorData[index++] = pixel.g.toInt(); // G
        tensorData[index++] = pixel.b.toInt(); // B
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
      _emitDetectionStatus(); // Emit status update
    }
  }

  /// Emit current detection status to stream
  void _emitDetectionStatus() {
    if (!_detectionStatusController.isClosed) {
      _detectionStatusController.add(DetectionStatus(
        personPresent: _personPresent,
        latestConfidence: _latestConfidence,
        totalDetections: _totalDetections,
        successfulDetections: _successfulDetections,
        isDetecting: _isDetecting,
        isInitialized: _isInitialized,
        gender: _latestGender,
        genderConfidence: _latestGenderConfidence,
        facePixelSize: _latestFacePixelSize,
      ));
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

  /// Get latest detection confidence (0.0 - 1.0)
  double get latestConfidence => _latestConfidence;

  /// Get total number of detection attempts
  int get totalDetections => _totalDetections;

  /// Get number of successful detections
  int get successfulDetections => _successfulDetections;

  /// Get current detection mode
  String get detectionMode => Platform.isWindows ? 'ONNX Runtime (Windows)' : 'ONNX Runtime (Android)';

  /// Dispose resources
  Future<void> dispose() async {
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
    _genderSession?.release();
    _genderSessionOptions?.release();

    // Don't close the stream controller for singleton - just reset state
    _personPresent = false;
    _lastDetectionTime = null;
    _isInitialized = false;
    _ortSession = null;
    _sessionOptions = null;
    _genderSession = null;
    _genderSessionOptions = null;
    _consecutiveFailures = 0;
    _cameraWarmedUp = false;
    _latestFrameData = null;
    _latestFramePng = null;
    _latestConfidence = 0.0;
    _totalDetections = 0;
    _successfulDetections = 0;
    _latestGender = null;
    _latestGenderConfidence = null;
    _latestFacePixelSize = null;
  }

  /// Extract face region from person bounding box
  /// Assumes face is in top 30% of person bbox
  img.Image? _extractFaceRegion(img.Image fullImage, List<double> personBbox) {
    try {
      // personBbox format: [x1, y1, x2, y2] normalized (0-1)
      final int imageWidth = fullImage.width;
      final int imageHeight = fullImage.height;

      // Convert normalized coords to pixels
      final int x1 = (personBbox[0] * imageWidth).round().clamp(0, imageWidth - 1);
      final int y1 = (personBbox[1] * imageHeight).round().clamp(0, imageHeight - 1);
      final int x2 = (personBbox[2] * imageWidth).round().clamp(0, imageWidth - 1);
      final int y2 = (personBbox[3] * imageHeight).round().clamp(0, imageHeight - 1);

      final int bboxWidth = x2 - x1;
      final int bboxHeight = y2 - y1;

      // Estimate face region: top 30% of person bbox, centered horizontally
      final int faceHeight = (bboxHeight * 0.3).round();
      final int faceWidth = (bboxWidth * 0.8).round(); // 80% width for face
      final int faceX = x1 + ((bboxWidth - faceWidth) / 2).round();
      final int faceY = y1;

      // Store face size for debugging
      _latestFacePixelSize = faceHeight;

      // Check minimum face size
      if (faceWidth < _minFaceSizeForGender || faceHeight < _minFaceSizeForGender) {
        print('[GENDER DETECTION] Face too small: ${faceWidth}x${faceHeight} (min: $_minFaceSizeForGender)');
        return null;
      }

      // Crop face region
      final faceImage = img.copyCrop(
        fullImage,
        x: faceX.clamp(0, imageWidth - 1),
        y: faceY.clamp(0, imageHeight - 1),
        width: faceWidth.clamp(1, imageWidth),
        height: faceHeight.clamp(1, imageHeight),
      );

      return faceImage;
    } catch (e) {
      print('[GENDER DETECTION] Error extracting face region: $e');
      return null;
    }
  }

  /// Detect gender from face image using ONNX model
  Future<(String, double)?> _detectGender(img.Image faceImage) async {
    if (_genderSession == null) {
      return null; // Gender model not loaded
    }

    OrtValueTensor? inputOrt;
    OrtRunOptions? runOptions;
    List<OrtValue?>? outputs;

    try {
      // Resize face to model input size (typically 224x224 or 112x112)
      // Adjust this based on your gender model's input size
      const int inputSize = 112;
      final resizedFace = img.copyResize(faceImage, width: inputSize, height: inputSize);

      // Convert to tensor format (NHWC, normalized 0-1)
      final tensorData = Float32List(1 * inputSize * inputSize * 3);
      int index = 0;

      for (int y = 0; y < inputSize; y++) {
        for (int x = 0; x < inputSize; x++) {
          final pixel = resizedFace.getPixel(x, y);
          tensorData[index++] = pixel.r.toDouble() / 255.0; // R
          tensorData[index++] = pixel.g.toDouble() / 255.0; // G
          tensorData[index++] = pixel.b.toDouble() / 255.0; // B
        }
      }

      // Create ONNX tensor
      inputOrt = OrtValueTensor.createTensorWithDataList(
        tensorData,
        [1, inputSize, inputSize, 3], // NHWC format
      );

      // Run inference
      // Note: Input name may need to be adjusted based on your model
      final inputs = {'input': inputOrt};
      runOptions = OrtRunOptions();
      outputs = _genderSession!.run(runOptions, inputs);

      // Parse output
      // Assumes binary classification: [male_prob, female_prob] or single value
      if (outputs.isNotEmpty && outputs[0] != null) {
        final outputData = outputs[0]!.value as List<dynamic>;

        double maleProb = 0.0;
        double femaleProb = 0.0;

        if (outputData.length == 2) {
          // Binary output: [male_prob, female_prob]
          maleProb = (outputData[0] is num) ? (outputData[0] as num).toDouble() : 0.0;
          femaleProb = (outputData[1] is num) ? (outputData[1] as num).toDouble() : 0.0;
        } else if (outputData.length == 1) {
          // Single sigmoid output: > 0.5 = female, < 0.5 = male
          final value = (outputData[0] is num) ? (outputData[0] as num).toDouble() : 0.5;
          femaleProb = value;
          maleProb = 1.0 - value;
        }

        // Determine gender
        final isMale = maleProb > femaleProb;
        final confidence = isMale ? maleProb : femaleProb;

        // Only return if confidence is above threshold
        if (confidence >= _genderConfidenceThreshold) {
          final gender = isMale ? 'male' : 'female';
          print('[GENDER DETECTION] ✓ Gender detected: $gender (${(confidence * 100).toStringAsFixed(1)}%)');
          return (gender, confidence);
        } else {
          print('[GENDER DETECTION] Confidence too low: ${(confidence * 100).toStringAsFixed(1)}%');
          return ('unknown', confidence);
        }
      }

      // Clean up
      for (var output in outputs ?? []) {
        output?.release();
      }
      inputOrt?.release();
      runOptions?.release();

      return null;
    } catch (e) {
      print('[GENDER DETECTION] Error in gender detection: $e');

      // Clean up on error
      try {
        for (var output in outputs ?? []) {
          output?.release();
        }
        inputOrt?.release();
        runOptions?.release();
      } catch (cleanupError) {
        print('[GENDER DETECTION] Error cleaning up: $cleanupError');
      }

      return null;
    }
  }
}
