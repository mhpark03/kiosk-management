import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';

/// Service for detecting person presence using camera
/// Uses motion detection as a simple approach
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
  DateTime? _lastMotionTime;

  // Configuration
  static const Duration _motionTimeout = Duration(seconds: 3);
  static const Duration _detectionInterval = Duration(milliseconds: 500);

  Timer? _detectionTimer;

  /// Initialize camera for person detection
  Future<void> initialize() async {
    if (_isInitialized) {
      print('[PERSON DETECTION] Already initialized');
      return;
    }

    try {
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
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.yuv420,
      );

      await _cameraController!.initialize();

      _isInitialized = true;
      print('[PERSON DETECTION] Camera initialized successfully');
    } catch (e) {
      print('[PERSON DETECTION] Error initializing camera: $e');
      rethrow;
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
    print('[PERSON DETECTION] Starting detection');

    try {
      // Start image stream for motion detection
      await _cameraController!.startImageStream((CameraImage image) {
        _processImage(image);
      });

      // Start periodic check for motion timeout
      _detectionTimer = Timer.periodic(_detectionInterval, (_) {
        _checkMotionTimeout();
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

    try {
      await _cameraController?.stopImageStream();
    } catch (e) {
      print('[PERSON DETECTION] Error stopping image stream: $e');
    }
  }

  /// Process camera image for motion detection
  void _processImage(CameraImage image) {
    if (!_isDetecting) return;

    // Simple motion detection: check if there's significant brightness variation
    // This is a basic implementation - for production, use TFLite model
    try {
      // Get image brightness (simplified approach)
      // In a real implementation, this would run TFLite inference
      final hasMotion = _detectMotion(image);

      if (hasMotion) {
        _lastMotionTime = DateTime.now();

        if (!_personPresent) {
          _personPresent = true;
          _personDetectedController.add(true);
          print('[PERSON DETECTION] Person detected');
        }
      }
    } catch (e) {
      print('[PERSON DETECTION] Error processing image: $e');
    }
  }

  /// Simple motion detection based on image data
  bool _detectMotion(CameraImage image) {
    // This is a simplified motion detection
    // For production, replace with TFLite person detection model

    // Calculate average brightness from Y plane (luminance)
    if (image.planes.isEmpty) return false;

    final yPlane = image.planes[0];
    final bytes = yPlane.bytes;

    // Sample every 100th pixel to check for variation
    int sum = 0;
    int count = 0;
    for (int i = 0; i < bytes.length; i += 100) {
      sum += bytes[i];
      count++;
    }

    if (count == 0) return false;

    final avgBrightness = sum / count;

    // If brightness is in a reasonable range, assume motion/person
    // This is very basic - real detection would use ML model
    return avgBrightness > 30 && avgBrightness < 225;
  }

  /// Check if motion has timed out
  void _checkMotionTimeout() {
    if (_lastMotionTime == null) return;

    final timeSinceMotion = DateTime.now().difference(_lastMotionTime!);

    if (timeSinceMotion > _motionTimeout && _personPresent) {
      _personPresent = false;
      _personDetectedController.add(false);
      print('[PERSON DETECTION] Person left (motion timeout)');
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

  /// Dispose resources
  Future<void> dispose() async {
    print('[PERSON DETECTION] Disposing service');
    await stopDetection();
    await _cameraController?.dispose();
    await _personDetectedController.close();
    _isInitialized = false;
    _cameraController = null;
  }
}
