import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
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

  // Person detection
  final PersonDetectionService _personDetection = PersonDetectionService();
  StreamSubscription<bool>? _personDetectionSubscription;
  bool _personDetected = false;
  String _detectionStatus = 'Initializing...';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeVideo();
      _initializePersonDetection();

      // Enable touch detection after short delay
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          setState(() {
            _ignoreInitialTouch = false;
          });
          print('[IDLE SCREEN] Touch detection enabled');
        }
      });
    });
  }

  Future<void> _initializePersonDetection() async {
    try {
      setState(() {
        _detectionStatus = 'Initializing camera...';
      });

      await _personDetection.initialize();

      setState(() {
        _detectionStatus = 'Starting detection...';
      });

      await _personDetection.startDetection();

      // Subscribe to person detection stream
      _personDetectionSubscription = _personDetection.personDetectedStream.listen((detected) {
        if (mounted) {
          setState(() {
            _personDetected = detected;
            _detectionStatus = detected ? 'Person detected!' : 'Monitoring...';
          });
          print('[IDLE SCREEN] Person detection: $detected');
        }
      });

      setState(() {
        _detectionStatus = 'Monitoring...';
      });

      print('[IDLE SCREEN] Person detection initialized');
    } catch (e) {
      print('[IDLE SCREEN] Error initializing person detection: $e');
      setState(() {
        _detectionStatus = 'Error: $e';
      });
    }
  }

  Future<void> _initializeVideo() async {
    if (widget.videos.isEmpty) {
      setState(() {
        _hasError = true;
        _errorMessage = '재생할 영상이 없습니다';
      });
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

      setState(() {
        _currentVideoPath = actualPath;
        _hasError = false;
        _videoPlayerKeyCounter++;
      });

      print('[IDLE SCREEN] Video path set successfully');
    } catch (e) {
      print('[IDLE SCREEN] Error initializing video: $e');
      setState(() {
        _hasError = true;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _playNextVideo() async {
    _currentVideoIndex = (_currentVideoIndex + 1) % widget.videos.length;
    await _initializeVideo();
  }

  @override
  void dispose() {
    _personDetectionSubscription?.cancel();
    _personDetection.dispose();
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
    return GestureDetector(
      onTap: _handleUserInteraction,
      onPanUpdate: (_) => _handleUserInteraction(),
      child: MouseRegion(
        onHover: (_) => _handleUserInteraction(),
        child: Scaffold(
          backgroundColor: Colors.black,
          body: Row(
            children: [
              // Left side: Video player
              Expanded(
                flex: 1,
                child: Container(
                  color: Colors.black,
                  child: Stack(
                    children: [
                      // Video content
                      if (_hasError)
                        Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Colors.red,
                                size: 64,
                              ),
                              const SizedBox(height: 24),
                              const Text(
                                '동영상을 재생할 수 없습니다',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _errorMessage ?? '',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        )
                      else if (_currentVideoPath != null)
                        VideoPlayerWidget(
                          key: ValueKey(_videoPlayerKeyCounter),
                          videoPath: _currentVideoPath!,
                          onCompleted: _playNextVideo,
                          onError: () {
                            setState(() {
                              _hasError = true;
                              _errorMessage = '동영상 재생 중 오류가 발생했습니다';
                            });
                          },
                        )
                      else
                        const Center(
                          child: CircularProgressIndicator(
                            color: Colors.white,
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

                      // Video label
                      Positioned(
                        top: 20,
                        left: 20,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.8),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            '영상 재생',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Divider
              Container(
                width: 2,
                color: Colors.white.withOpacity(0.3),
              ),

              // Right side: Camera preview
              Expanded(
                flex: 1,
                child: Container(
                  color: Colors.grey.shade900,
                  child: Stack(
                    children: [
                      // Camera preview
                      if (_personDetection.isInitialized && _personDetection.cameraController != null)
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
                        )
                      else
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
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
