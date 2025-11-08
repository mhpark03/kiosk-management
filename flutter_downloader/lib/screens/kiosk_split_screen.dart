import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart' as media_kit_video;
import 'package:window_manager/window_manager.dart';
import '../models/video.dart';
import '../models/coffee_order.dart';
import '../widgets/coffee_kiosk_overlay.dart';
import '../services/download_service.dart';

class KioskSplitScreen extends StatefulWidget {
  final List<Video> videos;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;

  const KioskSplitScreen({
    super.key,
    required this.videos,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
  });

  @override
  State<KioskSplitScreen> createState() => _KioskSplitScreenState();
}

class _KioskSplitScreenState extends State<KioskSplitScreen> {
  Player? _player;
  media_kit_video.VideoController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  int _currentVideoIndex = 0;
  final FocusNode _focusNode = FocusNode();
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  final DownloadService _downloadService = DownloadService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
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

      // Check if localPath exists
      if (video.localPath == null || video.localPath!.isEmpty) {
        throw Exception('영상 파일 경로가 없습니다. 영상을 먼저 다운로드해주세요.');
      }

      // Convert Android path to actual Windows path if needed
      final actualPath = await _downloadService.getActualFilePath(video.localPath!);
      print('[KIOSK SPLIT] Original path: ${video.localPath}');
      print('[KIOSK SPLIT] Actual path: $actualPath');

      final videoFile = File(actualPath);
      print('[KIOSK SPLIT] Loading video from: $actualPath');

      // Check if file exists
      if (!await videoFile.exists()) {
        throw Exception('영상 파일을 찾을 수 없습니다:\n$actualPath');
      }

      // Get file size to verify it's accessible
      final fileSize = await videoFile.length();
      print('[KIOSK SPLIT] Video file size: ${fileSize / (1024 * 1024)} MB');

      _player = Player();
      _controller = media_kit_video.VideoController(_player!);

      // Listen to player state changes
      _player!.stream.playing.listen((playing) {
        if (mounted) {
          setState(() => _isPlaying = playing);
        }
      });

      _player!.stream.position.listen((position) {
        if (mounted) {
          setState(() => _position = position);
        }
      });

      _player!.stream.duration.listen((duration) {
        if (mounted) {
          setState(() => _duration = duration);
        }
      });

      // Listen for video completion
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

      print('[KIOSK SPLIT] Video initialized successfully: ${video.title}');
    } catch (e) {
      print('[KIOSK SPLIT] Error initializing video: $e');
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
    _focusNode.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    if (_player == null) return;
    _player!.playOrPause();
  }

  Future<void> _exitKiosk() async {
    await windowManager.setFullScreen(false);
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent &&
            event.logicalKey == LogicalKeyboardKey.escape) {
          // Exit to video list screen
          _exitKiosk();
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Row(
          children: [
            // Left side: Video Player
            Expanded(
              flex: 1,
              child: Container(
                color: Colors.black,
                child: Stack(
                  children: [
                    Center(
                      child: _hasError
                      ? Padding(
                          padding: const EdgeInsets.all(32.0),
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
                                style: TextStyle(
                                  color: Colors.grey.shade400,
                                  fontSize: 14,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 32),
                              ElevatedButton.icon(
                                onPressed: () {
                                  // Try to skip to next video
                                  if (widget.videos.length > 1) {
                                    _playNextVideo();
                                  }
                                },
                                icon: const Icon(Icons.skip_next),
                                label: const Text('다음 영상'),
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 24,
                                    vertical: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : _isInitialized && _controller != null
                          ? GestureDetector(
                              onTap: _togglePlayPause,
                              child: media_kit_video.Video(
                                controller: _controller!,
                                controls: media_kit_video.NoVideoControls,
                              ),
                            )
                          : const CircularProgressIndicator(),
                    ),

                    // Video info overlay (bottom)
                    if (_isInitialized && !_hasError)
                      Positioned(
                        bottom: 0,
                        left: 0,
                        right: 0,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [
                                Colors.black.withOpacity(0.8),
                                Colors.transparent,
                              ],
                            ),
                          ),
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.videos[_currentVideoIndex].title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Text(
                                    '${_currentVideoIndex + 1} / ${widget.videos.length}',
                                    style: TextStyle(
                                      color: Colors.grey.shade300,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  if (_player != null)
                                    Text(
                                      '${_formatDuration(_position)} / ${_formatDuration(_duration)}',
                                      style: TextStyle(
                                        color: Colors.grey.shade300,
                                        fontSize: 14,
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // Right side: Coffee Kiosk
            Expanded(
              flex: 1,
              child: CoffeeKioskOverlay(
                onClose: _exitKiosk,
                onOrderComplete: (order) {
                  print('[KIOSK SPLIT] Order completed: ${order.toJson()}');
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('주문이 완료되었습니다. 준비되면 호출하겠습니다.'),
                      duration: const Duration(seconds: 2),
                      backgroundColor: Colors.green.shade700,
                    ),
                  );
                },
                downloadPath: widget.downloadPath,
                kioskId: widget.kioskId,
                menuFilename: widget.menuFilename,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
