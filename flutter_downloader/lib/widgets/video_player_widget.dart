import 'dart:async';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart' as media_kit_video;

/// Standalone video player widget that manages its own video state
/// to prevent parent widget rebuilds on every video frame update
class VideoPlayerWidget extends StatefulWidget {
  final String videoPath;
  final VoidCallback? onCompleted;
  final VoidCallback? onError;

  const VideoPlayerWidget({
    super.key,
    required this.videoPath,
    this.onCompleted,
    this.onError,
  });

  @override
  State<VideoPlayerWidget> createState() => _VideoPlayerWidgetState();
}

class _VideoPlayerWidgetState extends State<VideoPlayerWidget> {
  Player? _player;
  media_kit_video.VideoController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isInitializing = false;
  bool _isDisposing = false;

  // Stream subscriptions
  StreamSubscription<bool>? _playingSubscription;
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<Duration>? _durationSubscription;
  StreamSubscription<bool>? _completedSubscription;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  @override
  void didUpdateWidget(VideoPlayerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If video path changed, reinitialize player
    if (widget.videoPath != oldWidget.videoPath) {
      _reinitializePlayer();
    }
  }

  @override
  void dispose() {
    _isDisposing = true;
    _cancelSubscriptions();
    _player?.dispose();
    super.dispose();
  }

  void _cancelSubscriptions() {
    _playingSubscription?.cancel();
    _positionSubscription?.cancel();
    _durationSubscription?.cancel();
    _completedSubscription?.cancel();
  }

  Future<void> _reinitializePlayer() async {
    // Wait for any ongoing initialization to complete
    while (_isInitializing) {
      await Future.delayed(const Duration(milliseconds: 100));
    }

    _cancelSubscriptions();
    await _player?.dispose();
    _player = null;
    _controller = null;

    if (mounted) {
      setState(() {
        _isInitialized = false;
        _hasError = false;
      });
    }
    await _initializePlayer();
  }

  Future<void> _initializePlayer() async {
    // Prevent concurrent initialization
    if (_isInitializing || _isDisposing || !mounted) {
      print('[VIDEO PLAYER WIDGET] Skipping initialization (initializing: $_isInitializing, disposing: $_isDisposing, mounted: $mounted)');
      return;
    }

    _isInitializing = true;

    try {
      print('[VIDEO PLAYER WIDGET] Initializing player for: ${widget.videoPath}');

      _player = Player();
      _controller = media_kit_video.VideoController(_player!);

      // Listen to player state changes
      _playingSubscription = _player!.stream.playing.listen((playing) {
        if (mounted) {
          setState(() => _isPlaying = playing);
        }
      });

      _positionSubscription = _player!.stream.position.listen((position) {
        if (mounted) {
          setState(() => _position = position);
        }
      });

      _durationSubscription = _player!.stream.duration.listen((duration) {
        if (mounted) {
          setState(() => _duration = duration);
        }
      });

      // Listen for video completion
      _completedSubscription = _player!.stream.completed.listen((completed) {
        if (completed && mounted) {
          print('[VIDEO PLAYER WIDGET] Video completed');
          widget.onCompleted?.call();
        }
      });

      print('[VIDEO PLAYER WIDGET] Controller created, opening media...');

      // Open media first
      await _player!.open(Media(widget.videoPath));

      print('[VIDEO PLAYER WIDGET] Media opened, waiting for next frame...');

      // IMPORTANT: Wait for next frame before setting initialized
      // This ensures the layout is complete and the Video widget can receive proper constraints
      await Future.delayed(const Duration(milliseconds: 100));

      // Set initialized after layout is ready
      if (mounted) {
        setState(() {
          _isInitialized = true;
          _hasError = false;
        });
      }

      print('[VIDEO PLAYER WIDGET] Widget ready to render');

      await _player!.play();

      print('[VIDEO PLAYER WIDGET] Player initialized and playing');
    } catch (e) {
      print('[VIDEO PLAYER WIDGET] Error initializing player: $e');
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = e.toString();
        });
      }
      widget.onError?.call();
    } finally {
      _isInitializing = false;
    }
  }

  void _togglePlayPause() {
    if (_player == null) return;
    _player!.playOrPause();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Padding(
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
              ],
            ),
          ),
        ),
      );
    }

    if (!_isInitialized || _controller == null) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(
            color: Colors.white,
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: _togglePlayPause,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SizedBox(
            width: constraints.maxWidth,
            height: constraints.maxHeight,
            child: media_kit_video.Video(
              controller: _controller!,
              controls: media_kit_video.NoVideoControls,
              fit: BoxFit.contain,
            ),
          );
        },
      ),
    );
  }
}
