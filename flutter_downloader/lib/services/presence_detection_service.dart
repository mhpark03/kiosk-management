import 'dart:async';
import 'person_detection_service.dart';

/// Abstract service for detecting human presence
/// Can be implemented with touch/mouse input, camera, or sensors
abstract class PresenceDetectionService {
  /// Stream of presence detection events
  /// true = person detected, false = no person
  Stream<bool> get presenceStream;

  /// Current presence status
  bool get isPresent;

  /// Start detection
  Future<void> start();

  /// Stop detection
  Future<void> stop();

  /// Manually trigger presence (for testing or manual override)
  void triggerPresence();

  /// Dispose resources
  void dispose();
}

/// Touch/Mouse based presence detection
/// Detects presence when user interacts with screen
class TouchPresenceDetectionService extends PresenceDetectionService {
  final StreamController<bool> _presenceController = StreamController<bool>.broadcast();
  Timer? _idleTimer;
  bool _isPresent = false;

  /// Duration of inactivity before considering user as "not present"
  final Duration idleTimeout;

  TouchPresenceDetectionService({
    this.idleTimeout = const Duration(seconds: 30),
  });

  @override
  Stream<bool> get presenceStream => _presenceController.stream;

  @override
  bool get isPresent => _isPresent;

  @override
  Future<void> start() async {
    print('[PRESENCE] Touch-based detection started (idle timeout: ${idleTimeout.inSeconds}s)');
    // Start with no presence
    _updatePresence(false);
  }

  @override
  Future<void> stop() async {
    print('[PRESENCE] Touch-based detection stopped');
    _idleTimer?.cancel();
    _updatePresence(false);
  }

  @override
  void triggerPresence() {
    print('[PRESENCE] User interaction detected');

    // Cancel existing timer
    _idleTimer?.cancel();

    // Set presence to true
    if (!_isPresent) {
      _updatePresence(true);
    }

    // Start idle timer
    _idleTimer = Timer(idleTimeout, () {
      print('[PRESENCE] Idle timeout reached, user considered absent');
      _updatePresence(false);
    });
  }

  void _updatePresence(bool present) {
    if (_isPresent != present) {
      _isPresent = present;
      _presenceController.add(present);
      print('[PRESENCE] Presence changed: $present');
    }
  }

  @override
  void dispose() {
    _idleTimer?.cancel();
    _presenceController.close();
  }
}

/// Camera-based presence detection using ML person detection
class CameraPresenceDetectionService extends PresenceDetectionService {
  final PersonDetectionService _personDetectionService = PersonDetectionService();
  final StreamController<bool> _presenceController = StreamController<bool>.broadcast();
  StreamSubscription<bool>? _detectionSubscription;
  bool _isPresent = false;

  @override
  Stream<bool> get presenceStream => _presenceController.stream;

  @override
  bool get isPresent => _isPresent;

  @override
  Future<void> start() async {
    print('[PRESENCE] Camera-based detection starting...');

    try {
      // Initialize and start person detection
      await _personDetectionService.initialize();
      await _personDetectionService.startDetection();

      // Listen for person detection events and forward to our stream
      _detectionSubscription = _personDetectionService.personDetectedStream.listen((detected) {
        _updatePresence(detected);
        print('[PRESENCE] Camera presence changed: $detected');
      });

      print('[PRESENCE] Camera-based detection started successfully');
    } catch (e) {
      print('[PRESENCE] Error starting camera detection: $e');
      rethrow;
    }
  }

  @override
  Future<void> stop() async {
    print('[PRESENCE] Camera-based detection stopping...');

    await _detectionSubscription?.cancel();
    await _personDetectionService.stopDetection();

    _updatePresence(false);
    print('[PRESENCE] Camera-based detection stopped');
  }

  @override
  void triggerPresence() {
    // For camera mode, manual trigger can be used for testing or override
    // This allows touch input to work alongside camera detection
    print('[PRESENCE] Manual trigger (camera mode) - activating kiosk');
    _updatePresence(true);
  }

  void _updatePresence(bool present) {
    if (_isPresent != present) {
      _isPresent = present;
      _presenceController.add(present);
    }
  }

  @override
  void dispose() {
    _detectionSubscription?.cancel();
    _personDetectionService.dispose();
    _presenceController.close();
  }
}
