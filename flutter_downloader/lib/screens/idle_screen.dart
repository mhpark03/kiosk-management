import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'dart:async';
import '../models/video.dart';
import '../services/download_service.dart';
import '../services/person_detection_service.dart';
import '../widgets/video_player_widget.dart';

/// Idle screen that shows fullscreen advertisement videos
/// Displayed when no user is present at the kiosk
class IdleScreen extends StatefulWidget {
  final List<Video> videos;
  final VoidCallback? onUserPresence; // Callback when user interaction detected

  const IdleScreen({
    super.key,
    required this.videos,
    this.onUserPresence,
  });

  @override
  State<IdleScreen> createState() => _IdleScreenState();
}

class _IdleScreenState extends State<IdleScreen> {
  int _currentVideoIndex = 0;
  final DownloadService _downloadService = DownloadService();
  String? _currentVideoPath;
  bool _hasError = false;
  String? _errorMessage;
  int _videoPlayerKeyCounter = 0;

  // Grace period to ignore initial touches (prevent button click from activating kiosk)
  bool _ignoreInitialTouch = true;

  // Grace period to ignore initial detections (camera warmup)
  bool _ignoreInitialDetection = true;
  Timer? _detectionGraceTimer;

  // Person detection
  final PersonDetectionService _personDetection = PersonDetectionService();
  StreamSubscription<bool>? _personDetectionSubscription;
  bool _personDetected = false;
  String _detectionStatus = 'Initializing...';
  bool _isDisposed = false; // Track if widget is disposed
  bool _isPersonDetectionInitialized = false; // Track initialization state

  // Focus node for keyboard events
  late FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    print('[IDLE SCREEN] ========== INIT STATE ==========');

    // Initialize focus node
    _focusNode = FocusNode();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Check if still mounted (widget might be disposed before callback executes)
      if (!mounted || _isDisposed) {
        print('[IDLE SCREEN] Widget disposed before postFrameCallback, skipping initialization');
        return;
      }

      // Request focus for keyboard events
      _focusNode.requestFocus();

      // Skip video initialization - only camera detection in idle mode
      // _initializeVideo();
      print('[IDLE SCREEN] Initializing person detection from postFrameCallback...');
      _initializePersonDetection();

      // Enable touch detection after short delay
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted && !_isDisposed) {
          setState(() {
            _ignoreInitialTouch = false;
          });
          print('[IDLE SCREEN] Touch detection enabled');
        }
      });
    });
  }

  Future<void> _initializePersonDetection() async {
    // Early exit if widget is disposed
    if (!mounted || _isDisposed) {
      print('[IDLE SCREEN] Widget disposed, skipping person detection initialization');
      return;
    }

    try {
      if (mounted && !_isDisposed) {
        setState(() {
          _detectionStatus = 'Initializing camera...';
        });
      }

      await _personDetection.initialize();

      // Check if disposed after async operation
      if (_isDisposed || !mounted) {
        print('[IDLE SCREEN] Widget disposed during initialization, stopping person detection');
        _personDetection.dispose();
        return;
      }

      if (mounted && !_isDisposed) {
        setState(() {
          _detectionStatus = 'Starting detection...';
        });
      }

      await _personDetection.startDetection();

      // Check if disposed after async operation
      if (_isDisposed || !mounted) {
        print('[IDLE SCREEN] Widget disposed after startDetection, stopping person detection');
        _personDetection.dispose();
        return;
      }

      // Subscribe to person detection stream
      _personDetectionSubscription = _personDetection.personDetectedStream.listen((detected) {
        if (mounted && !_isDisposed) {
          setState(() {
            _personDetected = detected;
            _detectionStatus = detected ? 'Person detected!' : 'Monitoring...';
          });
          print('[IDLE SCREEN] Person detection: $detected');

          // Trigger kiosk activation when person is detected (after grace period)
          if (detected && widget.onUserPresence != null && !_ignoreInitialDetection) {
            print('[IDLE SCREEN] Triggering kiosk activation due to person detection');
            widget.onUserPresence!();
          } else if (detected && _ignoreInitialDetection) {
            print('[IDLE SCREEN] Ignoring detection during grace period (camera warming up)');
          }
        }
      });

      // Start grace period timer (3 seconds to allow camera to stabilize)
      _detectionGraceTimer = Timer(const Duration(seconds: 3), () {
        if (mounted && !_isDisposed) {
          setState(() {
            _ignoreInitialDetection = false;
          });
          print('[IDLE SCREEN] Detection grace period complete, activation enabled');
        }
      });

      // Mark as initialized and update UI
      if (mounted && !_isDisposed) {
        setState(() {
          _isPersonDetectionInitialized = true;
          _detectionStatus = 'Monitoring...';
        });
      }

      print('[IDLE SCREEN] Person detection initialized and UI updated');
    } catch (e) {
      print('[IDLE SCREEN] Error initializing person detection: $e');
      if (mounted && !_isDisposed) {
        setState(() {
          _detectionStatus = 'Error: $e';
        });
      }
    }
  }

  Future<void> _initializeVideo() async {
    if (widget.videos.isEmpty) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = '재생할 영상이 없습니다';
        });
      }
      return;
    }

    try {
      final video = widget.videos[_currentVideoIndex];

      if (video.localPath == null || video.localPath!.isEmpty) {
        throw Exception('영상 파일 경로가 없습니다.');
      }

      final actualPath = await _downloadService.getActualFilePath(video.localPath!);
      print('[IDLE SCREEN] Loading video: $actualPath');

      final videoFile = File(actualPath);
      if (!await videoFile.exists()) {
        throw Exception('영상 파일을 찾을 수 없습니다: $actualPath');
      }

      if (mounted) {
        setState(() {
          _currentVideoPath = actualPath;
          _hasError = false;
          _videoPlayerKeyCounter++;
        });
      }

      print('[IDLE SCREEN] Video path set successfully');
    } catch (e) {
      print('[IDLE SCREEN] Error initializing video: $e');
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = e.toString();
        });
      }
    }
  }

  Future<void> _playNextVideo() async {
    _currentVideoIndex = (_currentVideoIndex + 1) % widget.videos.length;
    await _initializeVideo();
  }

  @override
  void dispose() {
    print('[IDLE SCREEN] ========== DISPOSE START ==========');
    _isDisposed = true; // Set flag to prevent async operations from continuing
    print('[IDLE SCREEN] Canceling person detection subscription...');
    _personDetectionSubscription?.cancel();
    print('[IDLE SCREEN] Disposing person detection service...');
    _personDetection.dispose();
    print('[IDLE SCREEN] Disposing focus node...');
    _focusNode.dispose();
    print('[IDLE SCREEN] Canceling detection grace timer...');
    _detectionGraceTimer?.cancel();
    print('[IDLE SCREEN] IdleScreen disposed');
    print('[IDLE SCREEN] ========== DISPOSE END ==========');
    super.dispose();
  }

  void _handleUserInteraction() {
    // Ignore initial touches to prevent button click from activating kiosk
    if (_ignoreInitialTouch) {
      print('[IDLE SCREEN] Ignoring initial user interaction (grace period)');
      return;
    }
    print('[IDLE SCREEN] User interaction detected');
    widget.onUserPresence?.call();
  }

  @override
  Widget build(BuildContext context) {
    print('[IDLE SCREEN] build() called - _isPersonDetectionInitialized: $_isPersonDetectionInitialized, Platform: ${Platform.operatingSystem}');
    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape) {
          print('[IDLE SCREEN] ESC key pressed, exiting app...');
          if (Platform.isWindows || Platform.isAndroid) {
            SystemNavigator.pop(); // Exit app
          }
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: GestureDetector(
        onTap: _handleUserInteraction,
        onPanUpdate: (_) => _handleUserInteraction(),
        child: MouseRegion(
          onHover: (_) => _handleUserInteraction(),
          child: Scaffold(
          backgroundColor: Colors.black,
          body: Container(
            color: Colors.grey.shade900,
            child: Stack(
              children: [
                // Camera preview (Android only)
                if (Platform.isAndroid && _isPersonDetectionInitialized && _personDetection.cameraController != null) ...[
                  const SizedBox.shrink(), // Placeholder for logging
                  Center(
                    child: AspectRatio(
                      aspectRatio: 4 / 3,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: _personDetected ? Colors.greenAccent : Colors.blueAccent,
                            width: 3,
                          ),
                        ),
                        child: CameraPreview(_personDetection.cameraController!),
                      ),
                    ),
                  ),
                ]
                // Detection status (Windows or initializing)
                else if (Platform.isWindows && _isPersonDetectionInitialized) ...[
                  Builder(builder: (context) {
                    print('[IDLE SCREEN] Building Windows UI - personDetected: $_personDetected');
                    return const SizedBox.shrink();
                  }),
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _personDetected ? Icons.person : Icons.person_search,
                          color: _personDetected ? Colors.greenAccent : Colors.blueAccent,
                          size: 120,
                        ),
                        const SizedBox(height: 40),
                        Text(
                          _personDetected ? 'Person Detected' : 'Monitoring...',
                          style: TextStyle(
                            color: _personDetected ? Colors.greenAccent : Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Camera active',
                          style: TextStyle(
                            color: Colors.grey.shade400,
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                  ),
                ]
                else ...[
                  Builder(builder: (context) {
                    print('[IDLE SCREEN] Building loading UI - status: $_detectionStatus');
                    return const SizedBox.shrink();
                  }),
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const CircularProgressIndicator(
                          color: Colors.white,
                        ),
                        const SizedBox(height: 20),
                        Text(
                          _detectionStatus,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Detection status overlay
                Positioned(
                  top: 20,
                  left: 20,
                  right: 20,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: _personDetected
                          ? Colors.green.withOpacity(0.8)
                          : Colors.blue.withOpacity(0.8),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _personDetected ? Colors.greenAccent : Colors.blueAccent,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _personDetected ? Icons.person : Icons.person_outline,
                              color: Colors.white,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Person Detection',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _detectionStatus,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                          ),
                        ),
                        if (_personDetection.isInitialized)
                          Text(
                            'Mode: ${_personDetection.detectionMode}',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 10,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                // Hint overlay
                Positioned(
                  bottom: 40,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: const Text(
                        '화면을 터치하여 주문하세요',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
    );
  }
}
