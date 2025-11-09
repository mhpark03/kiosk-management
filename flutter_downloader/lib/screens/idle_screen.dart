import 'dart:io';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart' as media_kit_video;
import '../models/video.dart';
import '../services/download_service.dart';

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializeVideo();
    });
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
    super.dispose();
  }

  void _handleUserInteraction() {
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
            ],
          ),
        ),
      ),
    );
  }
}
