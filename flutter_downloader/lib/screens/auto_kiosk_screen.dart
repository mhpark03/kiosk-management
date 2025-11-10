import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'dart:async';
import '../models/video.dart';
import '../services/presence_detection_service.dart';
import 'idle_screen.dart';
import 'kiosk_split_screen.dart';

/// Detection mode for kiosk activation
enum DetectionMode {
  touch,  // Touch/mouse based detection
  camera, // Camera-based person detection
}

/// Auto-switching kiosk screen that transitions between:
/// - Idle mode: Fullscreen advertisement videos
/// - Kiosk mode: Split screen with video + menu
class AutoKioskScreen extends StatefulWidget {
  final List<Video> videos;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;
  final DetectionMode detectionMode;
  final Duration idleTimeout;

  const AutoKioskScreen({
    super.key,
    required this.videos,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
    this.detectionMode = DetectionMode.camera, // Default to camera detection
    this.idleTimeout = const Duration(seconds: 30),
  });

  @override
  State<AutoKioskScreen> createState() => _AutoKioskScreenState();
}

class _AutoKioskScreenState extends State<AutoKioskScreen> {
  late PresenceDetectionService _presenceService;
  StreamSubscription<bool>? _presenceSubscription;
  bool _isKioskMode = false;
  late List<Video> _advertisementVideos;
  late List<Video> _allVideos;

  // Cache screen widgets to prevent recreation on every build
  Widget? _cachedIdleScreen;
  Widget? _cachedKioskScreen;

  @override
  void initState() {
    super.initState();

    // Separate videos into advertisement and all videos
    // Advertisement videos: menuId is null (not linked to menu items)
    // All videos: used in kiosk mode for menu item videos
    _allVideos = widget.videos;
    _advertisementVideos = widget.videos.where((video) => video.menuId == null).toList();

    print('[AUTO KIOSK] Total videos: ${_allVideos.length}');
    print('[AUTO KIOSK] Advertisement videos (menuId == null): ${_advertisementVideos.length}');

    // If no advertisement videos, fallback to using all videos
    if (_advertisementVideos.isEmpty) {
      print('[AUTO KIOSK] WARNING: No advertisement videos found, using all videos for idle screen');
      _advertisementVideos = _allVideos;
    }

    // Initialize presence detection service based on detection mode
    if (widget.detectionMode == DetectionMode.camera) {
      print('[AUTO KIOSK] Using camera-based person detection');
      _presenceService = CameraPresenceDetectionService();
    } else {
      print('[AUTO KIOSK] Using touch-based detection');
      _presenceService = TouchPresenceDetectionService(
        idleTimeout: widget.idleTimeout,
      );
    }

    // Listen to presence changes
    _presenceSubscription = _presenceService.presenceStream.listen((isPresent) {
      print('[AUTO KIOSK] ========== Presence Stream Event ==========');
      print('[AUTO KIOSK] Presence changed: $isPresent');
      print('[AUTO KIOSK] Current _isKioskMode: $_isKioskMode, changing to: $isPresent');
      if (_isKioskMode == isPresent) {
        print('[AUTO KIOSK] WARNING: _isKioskMode already equals $isPresent, no change needed');
        return;
      }
      setState(() {
        _isKioskMode = isPresent;
      });
      print('[AUTO KIOSK] setState completed, _isKioskMode is now: $_isKioskMode');
      print('[AUTO KIOSK] ===============================================');
    });

    // Start detection
    _presenceService.start();

    // Enter fullscreen and wait for it to complete
    _enterFullscreen();
  }

  Future<void> _enterFullscreen() async {
    print('[AUTO KIOSK] Entering fullscreen...');
    await windowManager.setFullScreen(true);

    // Wait for fullscreen transition to complete
    await Future.delayed(const Duration(milliseconds: 300));

    // Force rebuild after fullscreen is active
    if (mounted) {
      setState(() {});
      print('[AUTO KIOSK] Fullscreen active, screen rebuilt');
    }
  }

  Future<void> _exitFullscreen() async {
    await windowManager.setFullScreen(false);
  }

  @override
  void dispose() {
    _presenceSubscription?.cancel();
    _presenceService.dispose();
    super.dispose();
  }

  void _handleUserPresence() {
    print('[AUTO KIOSK] User presence detected');
    _presenceService.triggerPresence();
  }

  void _handleExit() {
    _exitFullscreen();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    print('[AUTO KIOSK] ========== build() START ==========');
    print('[AUTO KIOSK] _isKioskMode: $_isKioskMode');
    print('[AUTO KIOSK] Will render: ${_isKioskMode ? "KioskSplitScreen" : "IdleScreen"}');
    final widget = Scaffold(
      body: _isKioskMode ? _buildKioskMode() : _buildIdleMode(),
    );
    print('[AUTO KIOSK] ========== build() END ==========');
    return widget;
  }

  Widget _buildIdleMode() {
    // Create IdleScreen only once and cache it
    if (_cachedIdleScreen == null) {
      print('[AUTO KIOSK] >>> _buildIdleMode() - Creating NEW IdleScreen <<<');
      _cachedIdleScreen = IdleScreen(
        videos: _advertisementVideos, // Only advertisement videos (menuId == null)
        onUserPresence: _handleUserPresence,
      );
    } else {
      print('[AUTO KIOSK] >>> _buildIdleMode() - Reusing cached IdleScreen <<<');
    }
    return _cachedIdleScreen!;
  }

  Widget _buildKioskMode() {
    // Create KioskSplitScreen only once and cache it
    if (_cachedKioskScreen == null) {
      print('[AUTO KIOSK] >>> _buildKioskMode() - Creating NEW KioskSplitScreen <<<');
      _cachedKioskScreen = GestureDetector(
        onTap: _handleUserPresence,
        onPanUpdate: (_) => _handleUserPresence(),
        child: MouseRegion(
          onHover: (_) => _handleUserPresence(),
          child: KioskSplitScreen(
            videos: _allVideos, // All videos for kiosk mode
            downloadPath: widget.downloadPath,
            kioskId: widget.kioskId,
            menuFilename: widget.menuFilename,
          ),
        ),
      );
    } else {
      print('[AUTO KIOSK] >>> _buildKioskMode() - Reusing cached KioskSplitScreen <<<');
    }
    return _cachedKioskScreen!;
  }
}
