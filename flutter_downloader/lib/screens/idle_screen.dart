import 'dart:io';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart' as media_kit_video;
import 'package:camera/camera.dart';
import 'dart:async';
import '../models/video.dart';
import '../services/download_service.dart';
import '../services/person_detection_service.dart';

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
  Player? _player;
  media_kit_video.VideoController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  int _currentVideoIndex = 0;
  final DownloadService _downloadService = DownloadService();

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

      _player = Player();
      _controller = media_kit_video.VideoController(_player!);

      // Listen for video completion to play next video
      _player!.stream.completed.listen((completed) {
        if (completed) {
          _playNextVideo();
        }
      });

      await _player!.open(Media(actualPath));
      await _player!.play();

      setState(() {
        _isInitialized = true;
        _hasError = false;
      });

      print('[IDLE SCREEN] Video initialized successfully');
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
    await _player?.dispose();
    setState(() {
      _isInitialized = false;
    });
    await _initializeVideo();
  }

  @override
  void dispose() {
    _player?.dispose();
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
          body: Stack(
            children: [
              // Fullscreen video
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
              else if (_isInitialized && _controller != null)
                SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: (_controller!.player.state.width ?? 1920).toDouble(),
                      height: (_controller!.player.state.height ?? 1080).toDouble(),
                      child: media_kit_video.Video(
                        controller: _controller!,
                        controls: media_kit_video.NoVideoControls,
                      ),
                    ),
                  ),
                )
              else
                const Center(
                  child: CircularProgressIndicator(
                    color: Colors.white,
                  ),
                ),

              // Subtle hint overlay
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

              // Detection status overlay (top left)
              Positioned(
                top: 20,
                left: 20,
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
                          Text(
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
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 10,
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Camera preview overlay (bottom right)
              if (_personDetection.isInitialized && _personDetection.cameraController != null)
                Positioned(
                  bottom: 20,
                  right: 20,
                  child: Container(
                    width: 320,
                    height: 240,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: _personDetected ? Colors.greenAccent : Colors.blueAccent,
                        width: 3,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.5),
                          blurRadius: 10,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: CameraPreview(_personDetection.cameraController!),
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
