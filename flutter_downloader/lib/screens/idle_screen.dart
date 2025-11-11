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
import '../widgets/camera_status_overlay.dart';

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

  bool _isDisposed = false; // Track if widget is disposed

  // Access to shared PersonDetectionService (managed by AutoKioskScreen)
  final PersonDetectionService _personDetection = PersonDetectionService();

  // Focus node for keyboard events
  late FocusNode _focusNode;

  @override
  void initState() {
    super.initState();

    // Initialize focus node
    _focusNode = FocusNode();

    // Initialize first video
    _initializeVideo();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Check if still mounted (widget might be disposed before callback executes)
      if (!mounted || _isDisposed) {
        return;
      }

      // Request focus for keyboard events
      _focusNode.requestFocus();

      // Enable touch detection after short delay
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted && !_isDisposed) {
          setState(() {
            _ignoreInitialTouch = false;
          });
        }
      });
    });
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
    _isDisposed = true; // Set flag to prevent async operations from continuing
    _focusNode.dispose();
    super.dispose();
  }

  void _handleUserInteraction() {
    // Ignore initial touches to prevent button click from activating kiosk
    if (_ignoreInitialTouch) {
      return;
    }
    widget.onUserPresence?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
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
      child: GestureDetector(
        onTap: _handleUserInteraction,
        onPanUpdate: (_) => _handleUserInteraction(),
        child: MouseRegion(
          onHover: (_) => _handleUserInteraction(),
          child: Scaffold(
          backgroundColor: Colors.black,
          body: Container(
            color: Colors.black,
            child: Stack(
              children: [
                // Video player - fullscreen advertisement videos
                if (_currentVideoPath != null && !_hasError) ...[
                  VideoPlayerWidget(
                    key: ValueKey('idle_video_$_videoPlayerKeyCounter'),
                    videoPath: _currentVideoPath!,
                    onCompleted: _playNextVideo,
                  ),
                ]
                // Error or loading state
                else ...[
                  Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_hasError) ...[
                          Icon(
                            Icons.error_outline,
                            color: Colors.red,
                            size: 80,
                          ),
                          const SizedBox(height: 20),
                          Text(
                            _errorMessage ?? '영상 재생 오류',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ] else ...[
                          CircularProgressIndicator(
                            color: Colors.white,
                          ),
                          const SizedBox(height: 20),
                          Text(
                            '영상 로딩 중...',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],

                // Camera status overlay (shows detection confidence and stats)
                // Always show for testing purposes
                Positioned(
                  top: 20,
                  left: 20,
                  right: 20,
                  child: StreamBuilder<DetectionStatus>(
                    stream: _personDetection.detectionStatusStream,
                    builder: (context, snapshot) {
                      if (snapshot.hasData) {
                        return CameraStatusOverlay(status: snapshot.data!);
                      }
                      // Show default status while waiting for first update
                      return CameraStatusOverlay(
                        status: DetectionStatus(
                          personPresent: false,
                          latestConfidence: 0.0,
                          totalDetections: 0,
                          successfulDetections: 0,
                          isDetecting: _personDetection.isDetecting,
                          isInitialized: _personDetection.isInitialized,
                        ),
                      );
                    },
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
                        color: Colors.black.withOpacity(0.7),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: const Text(
                        '화면을 터치하거나 카메라 앞에 서 주세요',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
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
