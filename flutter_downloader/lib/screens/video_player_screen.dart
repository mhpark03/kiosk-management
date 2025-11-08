import 'dart:io';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart' as media_kit_video;
import '../widgets/coffee_kiosk_overlay.dart';
import '../models/coffee_order.dart';

class VideoPlayerScreen extends StatefulWidget {
  final String videoPath;
  final String videoTitle;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;

  const VideoPlayerScreen({
    super.key,
    required this.videoPath,
    required this.videoTitle,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  late final Player _player;
  late final media_kit_video.VideoController _controller;
  bool _isInitialized = false;
  bool _hasError = false;
  String? _errorMessage;
  bool _showKioskOverlay = false;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _initializeVideo();
  }

  Future<void> _initializeVideo() async {
    try {
      _player = Player();
      _controller = media_kit_video.VideoController(_player);

      // Listen to player state changes
      _player.stream.playing.listen((playing) {
        if (mounted) {
          setState(() => _isPlaying = playing);
        }
      });

      _player.stream.position.listen((position) {
        if (mounted) {
          setState(() => _position = position);
        }
      });

      _player.stream.duration.listen((duration) {
        if (mounted) {
          setState(() => _duration = duration);
        }
      });

      await _player.open(Media('file:///${widget.videoPath}'));
      await _player.play();

      setState(() {
        _isInitialized = true;
      });
    } catch (e) {
      print('[VIDEO PLAYER] Error initializing video: $e');
      setState(() {
        _hasError = true;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    setState(() {
      _player.playOrPause();
    });
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '$hours:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  void _handleOrderComplete(CoffeeOrder order) {
    print('[COFFEE ORDER] Order completed: ${order.toJson()}');
    // TODO: Send order to backend API
    setState(() => _showKioskOverlay = false);
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: isLandscape ? null : AppBar(
        title: Text(
          widget.videoTitle,
          style: const TextStyle(fontSize: 16),
        ),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Stack(
          children: [
            // Video player
            Center(
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
                          style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    )
                  : _isInitialized
                      ? media_kit_video.Video(
                          controller: _controller,
                          controls: media_kit_video.NoVideoControls,
                        )
                      : const CircularProgressIndicator(),
            ),

            // Play/Pause overlay
            if (_isInitialized && !_hasError)
              Positioned.fill(
                child: GestureDetector(
                  onTap: _togglePlayPause,
                  child: Container(
                    color: Colors.transparent,
                    child: Center(
                      child: AnimatedOpacity(
                        opacity: _isPlaying ? 0.0 : 1.0,
                        duration: const Duration(milliseconds: 300),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                          ),
                          padding: const EdgeInsets.all(16),
                          child: Icon(
                            _isPlaying
                                ? Icons.pause
                                : Icons.play_arrow,
                            color: Colors.white,
                            size: 48,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

            // Video controls (bottom)
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
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Progress bar
                      Slider(
                        value: _duration.inMilliseconds > 0
                            ? _position.inMilliseconds / _duration.inMilliseconds
                            : 0.0,
                        onChanged: (value) {
                          final position = Duration(
                            milliseconds: (value * _duration.inMilliseconds).round(),
                          );
                          _player.seek(position);
                        },
                        activeColor: Colors.blue,
                        inactiveColor: Colors.white24,
                      ),
                      const SizedBox(height: 8),
                      // Time and controls
                      Row(
                        children: [
                          // Current time / Total time
                          Text(
                            '${_formatDuration(_position)} / ${_formatDuration(_duration)}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                            ),
                          ),
                          const Spacer(),
                          // Play/Pause button
                          IconButton(
                            icon: Icon(
                              _isPlaying
                                  ? Icons.pause
                                  : Icons.play_arrow,
                              color: Colors.white,
                            ),
                            onPressed: _togglePlayPause,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

            // Close button (landscape only)
            if (isLandscape && !_showKioskOverlay)
              Positioned(
                top: 16,
                left: 16,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                  onPressed: () => Navigator.of(context).pop(),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black54,
                    padding: const EdgeInsets.all(12),
                  ),
                ),
              ),

            // Coffee Kiosk button (right bottom)
            if (_isInitialized && !_hasError && !_showKioskOverlay)
              Positioned(
                right: 16,
                bottom: 80,
                child: FloatingActionButton(
                  onPressed: () {
                    setState(() => _showKioskOverlay = true);
                  },
                  backgroundColor: Colors.brown.shade700,
                  child: const Icon(Icons.coffee, color: Colors.white, size: 28),
                ),
              ),

            // Coffee Kiosk Overlay - Must be last to be on top
            if (_showKioskOverlay)
              Positioned.fill(
                child: CoffeeKioskOverlay(
                  onClose: () {
                    setState(() => _showKioskOverlay = false);
                  },
                  onOrderComplete: _handleOrderComplete,
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
