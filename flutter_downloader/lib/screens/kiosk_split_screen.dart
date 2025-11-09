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
import '../services/coffee_menu_service.dart';

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
  final CoffeeMenuService _menuService = CoffeeMenuService();

  // Menu video playback
  bool _isPlayingMenuVideo = false;
  String? _currentActionType; // Track the action type (checkout, addToCart, etc.)
  String? _currentCategoryId; // Track the current category ID
  String? _savedVideoPath;
  Duration _savedPosition = Duration.zero;

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
          if (_isPlayingMenuVideo) {
            // Check if this was a checkout video
            if (_currentActionType == 'checkout') {
              // Checkout video completed, play main video from beginning
              print('[KIOSK SPLIT] Checkout video completed, playing main video');
              _playMainVideo();
            } else if (_currentActionType == 'addToCart' || _currentActionType == 'cancelItem') {
              // addToCart or cancelItem completed, play category video
              print('[KIOSK SPLIT] $_currentActionType video completed, playing category video');
              _playCategoryVideo();
            } else {
              // Other menu video completed, return to saved video
              print('[KIOSK SPLIT] Menu video completed, returning to saved video');
              _returnToSavedVideo();
            }
          } else {
            // Regular video completed, play next
            _playNextVideo();
          }
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

  Future<void> _playMenuVideo(String videoPath, [String? actionType, String? categoryId]) async {
    if (_player == null) return;

    print('[KIOSK SPLIT] Playing menu video: $videoPath (action: $actionType, category: $categoryId)');

    try {
      // If already playing menu video, just switch to new menu video
      // Don't save the state again (keep the original saved state)
      if (!_isPlayingMenuVideo) {
        // Save current video state only if not already playing menu video
        final video = widget.videos[_currentVideoIndex];
        final actualPath = await _downloadService.getActualFilePath(video.localPath!);
        _savedVideoPath = actualPath;
        _savedPosition = _position;

        print('[KIOSK SPLIT] Saved video: $actualPath at position: $_savedPosition');
      } else {
        print('[KIOSK SPLIT] Already playing menu video, switching to new menu video');
      }

      _isPlayingMenuVideo = true;
      _currentActionType = actionType; // Store the action type
      _currentCategoryId = categoryId; // Store the category ID

      // Play menu video (this will stop current video if playing)
      await _player!.open(Media(videoPath));
      await _player!.play();

      print('[KIOSK SPLIT] Menu video started playing');
    } catch (e) {
      print('[KIOSK SPLIT] Error playing menu video: $e');
      _isPlayingMenuVideo = false;
      _currentActionType = null;
      _currentCategoryId = null;
    }
  }

  Future<void> _returnToSavedVideo() async {
    if (_player == null || _savedVideoPath == null) return;

    print('[KIOSK SPLIT] Returning to saved video: $_savedVideoPath');

    try {
      // Return to saved video
      await _player!.open(Media(_savedVideoPath!));
      await _player!.seek(_savedPosition);
      await _player!.play();

      // Clear saved state
      _isPlayingMenuVideo = false;
      _currentActionType = null;
      _savedVideoPath = null;
      _savedPosition = Duration.zero;

      print('[KIOSK SPLIT] Returned to saved video at position: $_savedPosition');
    } catch (e) {
      print('[KIOSK SPLIT] Error returning to saved video: $e');
      _isPlayingMenuVideo = false;
      _currentActionType = null;
    }
  }

  Future<void> _playMainVideo() async {
    if (_player == null || widget.videos.isEmpty) return;

    print('[KIOSK SPLIT] Playing main video from beginning');

    try {
      // Reset to first video and play from beginning
      _currentVideoIndex = 0;
      final video = widget.videos[_currentVideoIndex];
      final actualPath = await _downloadService.getActualFilePath(video.localPath!);

      await _player!.open(Media(actualPath));
      await _player!.play();

      // Clear saved state
      _isPlayingMenuVideo = false;
      _currentActionType = null;
      _savedVideoPath = null;
      _savedPosition = Duration.zero;

      print('[KIOSK SPLIT] Main video started playing: ${video.title}');
    } catch (e) {
      print('[KIOSK SPLIT] Error playing main video: $e');
      _isPlayingMenuVideo = false;
      _currentActionType = null;
    }
  }

  Future<void> _playCategoryVideo() async {
    if (_player == null || _currentCategoryId == null || widget.downloadPath == null || widget.kioskId == null) return;

    print('[KIOSK SPLIT] Playing category video for: $_currentCategoryId');

    try {
      // Get category video filename
      final videoFilename = _menuService.getCategoryVideoFilename(_currentCategoryId!);
      if (videoFilename == null || videoFilename.isEmpty) {
        print('[KIOSK SPLIT] No video for category: $_currentCategoryId');
        _returnToSavedVideo();
        return;
      }

      // Build video path in menu folder or kiosk folder
      String videoPath = '${widget.downloadPath}/${widget.kioskId}/menu/$videoFilename';
      File videoFile = File(videoPath);

      // If not found in menu folder, try kiosk folder
      if (!videoFile.existsSync()) {
        videoPath = '${widget.downloadPath}/${widget.kioskId}/$videoFilename';
        videoFile = File(videoPath);
      }

      if (!videoFile.existsSync()) {
        print('[KIOSK SPLIT] Category video file does not exist: $videoPath');
        _returnToSavedVideo();
        return;
      }

      print('[KIOSK SPLIT] Playing category video: $videoPath');

      await _player!.open(Media(videoPath));
      await _player!.play();

      // Keep _isPlayingMenuVideo true, this is still a menu video
      // Will return to saved video when this category video completes
      print('[KIOSK SPLIT] Category video started playing');
    } catch (e) {
      print('[KIOSK SPLIT] Error playing category video: $e');
      _returnToSavedVideo();
    }
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
    // Detect device orientation
    final orientation = MediaQuery.of(context).orientation;
    final isPortrait = orientation == Orientation.portrait;

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
        body: Flex(
          direction: isPortrait ? Axis.vertical : Axis.horizontal,
          children: [
            // Top (portrait) or Left (landscape): Video Player
            Expanded(
              flex: isPortrait ? 1 : 1, // Smaller in portrait mode to give more space to menu
              child: Container(
                color: Colors.black,
                child: Stack(
                  children: [
                    if (_hasError)
                      Center(
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
                        ),
                      ),
                    if (_isInitialized && _controller != null && !_hasError)
                      GestureDetector(
                        onTap: _togglePlayPause,
                        child: media_kit_video.Video(
                          controller: _controller!,
                          controls: media_kit_video.NoVideoControls,
                          fit: BoxFit.cover,
                          aspectRatio: null,
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // Bottom (portrait) or Right (landscape): Coffee Kiosk
            Expanded(
              flex: isPortrait ? 3 : 1, // Larger in portrait mode for menu visibility
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
                onPlayMenuVideo: _playMenuVideo,
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
