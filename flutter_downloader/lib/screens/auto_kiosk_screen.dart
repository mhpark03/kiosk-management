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
      print('[AUTO KIOSK] Presence changed: $isPresent');
      print('[AUTO KIOSK] Current _isKioskMode: $_isKioskMode, changing to: $isPresent');
      setState(() {
        _isKioskMode = isPresent;
      });
      print('[AUTO KIOSK] setState completed, _isKioskMode is now: $_isKioskMode');
    });

    // Start detection
    _presenceService.start();

    // Enter fullscreen
    _enterFullscreen();
  }

  Future<void> _enterFullscreen() async {
    await windowManager.setFullScreen(true);
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
    print('[AUTO KIOSK] build() called with _isKioskMode: $_isKioskMode');
    return Scaffold(
      body: _isKioskMode ? _buildKioskMode() : _buildIdleMode(),
    );
  }

  Widget _buildIdleMode() {
    print('[AUTO KIOSK] _buildIdleMode() called');
    return IdleScreen(
      videos: _advertisementVideos, // Only advertisement videos (menuId == null)
      onUserPresence: _handleUserPresence,
    );
  }

  Widget _buildKioskMode() {
    print('[AUTO KIOSK] _buildKioskMode() called');
    return GestureDetector(
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
  }
}
