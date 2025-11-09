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

  @override
  void initState() {
    super.initState();

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
      videos: widget.videos,
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
          videos: widget.videos,
          downloadPath: widget.downloadPath,
          kioskId: widget.kioskId,
          menuFilename: widget.menuFilename,
        ),
      ),
    );
  }
}
