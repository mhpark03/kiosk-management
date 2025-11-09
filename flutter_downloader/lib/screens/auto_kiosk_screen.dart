import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'dart:async';
import '../models/video.dart';
import '../services/presence_detection_service.dart';
import 'idle_screen.dart';
import 'kiosk_split_screen.dart';

/// Auto-switching kiosk screen that transitions between:
/// - Idle mode: Fullscreen advertisement videos
/// - Kiosk mode: Split screen with video + menu
class AutoKioskScreen extends StatefulWidget {
  final List<Video> videos;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;

  const AutoKioskScreen({
    super.key,
    required this.videos,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
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

    // Initialize presence detection service
    // Using touch-based detection for now (can switch to camera later)
    _presenceService = TouchPresenceDetectionService(
      idleTimeout: const Duration(seconds: 30), // Return to idle after 30s of inactivity
    );

    // Listen to presence changes
    _presenceSubscription = _presenceService.presenceStream.listen((isPresent) {
      print('[AUTO KIOSK] Presence changed: $isPresent');
      setState(() {
        _isKioskMode = isPresent;
      });
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
    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 500),
        child: _isKioskMode
            ? _buildKioskMode()
            : _buildIdleMode(),
      ),
    );
  }

  Widget _buildIdleMode() {
    return IdleScreen(
      key: const ValueKey('idle'),
      videos: _advertisementVideos, // Only advertisement videos (menuId == null)
      onUserPresence: _handleUserPresence,
    );
  }

  Widget _buildKioskMode() {
    return GestureDetector(
      key: const ValueKey('kiosk'),
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
