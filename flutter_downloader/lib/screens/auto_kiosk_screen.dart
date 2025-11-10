import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

  bool _isFullscreenReady = false; // Track if fullscreen transition is complete

  // Cache screen widgets to prevent recreation on every build
  Widget? _cachedIdleScreen;
  Widget? _cachedKioskScreen;

  // Focus node for keyboard events
  late FocusNode _focusNode;

  @override
  void initState() {
    super.initState();

    // Initialize focus node
    _focusNode = FocusNode();

    // Separate videos into advertisement and all videos
    // Advertisement videos: menuId is null (not linked to menu items)
    // All videos: used in kiosk mode for menu item videos
    _allVideos = widget.videos;
    _advertisementVideos = widget.videos.where((video) => video.menuId == null).toList();

    // If no advertisement videos, fallback to using all videos
    if (_advertisementVideos.isEmpty) {
      _advertisementVideos = _allVideos;
    }

    // Initialize presence detection service based on detection mode
    if (widget.detectionMode == DetectionMode.camera) {
      _presenceService = CameraPresenceDetectionService();
    } else {
      _presenceService = TouchPresenceDetectionService(
        idleTimeout: widget.idleTimeout,
      );
    }

    // Listen to presence changes
    _presenceSubscription = _presenceService.presenceStream.listen((isPresent) {
      if (_isKioskMode == isPresent) {
        return;
      }
      setState(() {
        _isKioskMode = isPresent;
      });
    });

    // Start detection
    _presenceService.start();

    // Enter fullscreen and wait for it to complete
    _enterFullscreen();
  }

  Future<void> _enterFullscreen() async {
    await windowManager.setFullScreen(true);

    // Wait for fullscreen transition to complete
    await Future.delayed(const Duration(milliseconds: 300));

    // Mark fullscreen as ready and rebuild
    if (mounted) {
      setState(() {
        _isFullscreenReady = true;
      });

      // Request focus after fullscreen is ready
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _focusNode.requestFocus();
        }
      });
    }
  }

  Future<void> _exitFullscreen() async {
    await windowManager.setFullScreen(false);
  }

  @override
  void dispose() {
    _presenceSubscription?.cancel();
    _presenceService.dispose();
    _focusNode.dispose();
    // Ensure fullscreen is cleared (fire-and-forget)
    windowManager.setFullScreen(false);
    super.dispose();
  }

  void _handleUserPresence() {
    _presenceService.triggerPresence();
  }

  Future<void> _handleExit() async {
    await _exitFullscreen();
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show loading screen until fullscreen transition completes
    if (!_isFullscreenReady) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
      );
    }

    final widget = Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape) {
          if (Platform.isWindows || Platform.isAndroid) {
            SystemNavigator.pop(); // Exit app
          }
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: Scaffold(
        body: _isKioskMode ? _buildKioskMode() : _buildIdleMode(),
      ),
    );
    return widget;
  }

  Widget _buildIdleMode() {
    // Create IdleScreen only once and cache it
    if (_cachedIdleScreen == null) {
      _cachedIdleScreen = IdleScreen(
        videos: _advertisementVideos, // Only advertisement videos (menuId == null)
        onUserPresence: _handleUserPresence,
      );
    }
    return _cachedIdleScreen!;
  }

  Widget _buildKioskMode() {
    // Create KioskSplitScreen only once and cache it
    if (_cachedKioskScreen == null) {
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
    }
    return _cachedKioskScreen!;
  }
}
