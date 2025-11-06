import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:window_manager/window_manager.dart';
import '../models/video.dart';
import '../models/coffee_order.dart';
import '../widgets/coffee_kiosk_overlay.dart';

class KioskSplitScreen extends StatefulWidget {
  final List<Video> videos;

  const KioskSplitScreen({
    super.key,
    required this.videos,
  });

  @override
  State<KioskSplitScreen> createState() => _KioskSplitScreenState();
}

class _KioskSplitScreenState extends State<KioskSplitScreen> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  int _currentVideoIndex = 0;
  final FocusNode _focusNode = FocusNode();

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
      _controller = VideoPlayerController.file(File(video.localPath!));
      await _controller!.initialize();
      await _controller!.setLooping(false);
      await _controller!.play();

      // Listen for video completion to play next video
      _controller!.addListener(_videoListener);

      setState(() {
        _isInitialized = true;
        _hasError = false;
      });
    } catch (e) {
      print('[KIOSK SPLIT] Error initializing video: $e');
      setState(() {
        _hasError = true;
        _errorMessage = e.toString();
      });
    }
  }

  void _videoListener() {
    if (_controller != null &&
        _controller!.value.position >= _controller!.value.duration) {
      // Video finished, play next
      _playNextVideo();
    }
  }

  Future<void> _playNextVideo() async {
    _currentVideoIndex = (_currentVideoIndex + 1) % widget.videos.length;
    await _controller?.dispose();
    setState(() {
      _isInitialized = false;
    });
    await _initializeVideo();
  }

  @override
  void dispose() {
    _controller?.removeListener(_videoListener);
    _controller?.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    if (_controller == null) return;
    setState(() {
      if (_controller!.value.isPlaying) {
        _controller!.pause();
      } else {
        _controller!.play();
      }
    });
  }

  Future<void> _exitKiosk() async {
    await windowManager.setFullScreen(false);
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent &&
            event.logicalKey == LogicalKeyboardKey.escape) {
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
                child: Center(
                  child: _hasError
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: Colors.red,
                              size: 64,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              '동영상을 재생할 수 없습니다',
                              style: TextStyle(color: Colors.white, fontSize: 18),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _errorMessage ?? '',
                              style: TextStyle(
                                  color: Colors.grey.shade400, fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        )
                      : _isInitialized && _controller != null
                          ? GestureDetector(
                              onTap: _togglePlayPause,
                              child: AspectRatio(
                                aspectRatio: _controller!.value.aspectRatio,
                                child: VideoPlayer(_controller!),
                              ),
                            )
                          : const CircularProgressIndicator(),
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
              ),
            ),
          ],
        ),
      ),
    );
  }
}
