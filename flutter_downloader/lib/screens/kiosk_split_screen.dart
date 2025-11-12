import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:window_manager/window_manager.dart';
import '../models/video.dart';
import '../models/coffee_order.dart';
import '../widgets/coffee_kiosk_overlay.dart';
import '../widgets/video_player_widget.dart';
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
  State<KioskSplitScreen> createState() => KioskSplitScreenState();
}

class KioskSplitScreenState extends State<KioskSplitScreen> {
  int _currentVideoIndex = 0;
  final FocusNode _focusNode = FocusNode();
  final DownloadService _downloadService = DownloadService();
  final CoffeeMenuService _menuService = CoffeeMenuService();

  // GlobalKey for cart widget (for landscape split layout)
  final GlobalKey<CoffeeKioskOverlayState> _cartKey = GlobalKey<CoffeeKioskOverlayState>();

  // Current video path to display
  String? _currentVideoPath;
  bool _hasError = false;
  String? _errorMessage;

  // Video player key counter to force recreation
  int _videoPlayerKeyCounter = 0;

  // Menu video playback
  bool _isPlayingMenuVideo = false;
  String? _currentActionType; // Track the action type (checkout, addToCart, etc.)
  String? _currentCategoryId; // Track the current category ID

  // Public getter for cart key (accessed by AutoKioskScreen)
  GlobalKey<CoffeeKioskOverlayState> get cartKey => _cartKey;
  String? _savedVideoPath;
  Duration _savedPosition = Duration.zero;

  // Filtered list of menu-related videos only (menuId is not null/empty)
  late List<Video> _menuVideos;

  @override
  void initState() {
    super.initState();

    // Filter videos to only include menu-related videos (has menuId)
    _menuVideos = widget.videos.where((video) =>
      video.menuId != null && video.menuId!.isNotEmpty
    ).toList();

    // If no menu videos found, use all videos as fallback
    if (_menuVideos.isEmpty) {
      print('[KIOSK SPLIT] No menu videos found, using all videos as fallback');
      _menuVideos = widget.videos;
    }

    print('[KIOSK SPLIT] ========== VIDEO FILTERING ==========');
    print('[KIOSK SPLIT] Total videos: ${widget.videos.length}');
    print('[KIOSK SPLIT] Menu videos (menuId != null): ${_menuVideos.length}');

    // Log all videos with their menuId
    for (var i = 0; i < widget.videos.length; i++) {
      final video = widget.videos[i];
      print('[KIOSK SPLIT] Video $i: "${video.title}" - menuId: ${video.menuId} - path: ${video.localPath}');
    }

    print('[KIOSK SPLIT] Filtered menu videos:');
    for (var i = 0; i < _menuVideos.length; i++) {
      final video = _menuVideos[i];
      print('[KIOSK SPLIT] Menu video $i: "${video.title}" - menuId: ${video.menuId}');
    }
    print('[KIOSK SPLIT] ========================================');

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _focusNode.requestFocus();

      // Load menu XML to get main video info
      if (widget.downloadPath != null && widget.kioskId != null) {
        try {
          await _menuService.loadMenuFromXml(
            downloadPath: widget.downloadPath,
            kioskId: widget.kioskId,
            filename: widget.menuFilename,
          );
          print('[KIOSK SPLIT] Menu XML loaded successfully');
        } catch (e) {
          print('[KIOSK SPLIT] Failed to load menu XML: $e');
        }
      }

      _initializeVideo();
    });
  }

  Future<void> _initializeVideo() async {
    print('[KIOSK SPLIT] ========== INITIALIZE VIDEO ==========');
    print('[KIOSK SPLIT] Menu videos count: ${_menuVideos.length}');

    if (_menuVideos.isEmpty) {
      setState(() {
        _hasError = true;
        _errorMessage = '재생할 메뉴 영상이 없습니다';
      });
      return;
    }

    try {
      String? videoPath;
      String? videoTitle;

      // Try to get main video from menu XML first
      final mainVideoFilename = _menuService.getMainVideoFilename();
      print('[KIOSK SPLIT] Main video filename from XML: $mainVideoFilename');

      if (mainVideoFilename != null && widget.downloadPath != null && widget.kioskId != null) {
        print('[KIOSK SPLIT] Searching for main video file: $mainVideoFilename');

        // Check if main video file exists in menu folder first
        String mainVideoPath = '${widget.downloadPath}/${widget.kioskId}/menu/$mainVideoFilename';
        File mainVideoFile = File(mainVideoPath);

        // If not in menu folder, try kiosk folder
        if (!await mainVideoFile.exists()) {
          mainVideoPath = '${widget.downloadPath}/${widget.kioskId}/$mainVideoFilename';
          mainVideoFile = File(mainVideoPath);
        }

        // If main video file exists, use it
        if (await mainVideoFile.exists()) {
          print('[KIOSK SPLIT] Found main video at: $mainVideoPath');
          videoPath = mainVideoPath;
          videoTitle = 'Main Video';

          final fileSize = await mainVideoFile.length();
          print('[KIOSK SPLIT] Main video file size: ${fileSize / (1024 * 1024)} MB');
        } else {
          print('[KIOSK SPLIT] Main video file not found: $mainVideoPath');
        }
      }

      // Fallback: use first menu video
      if (videoPath == null) {
        print('[KIOSK SPLIT] ⚠️  FALLBACK: Main video not found in XML or file missing');
        print('[KIOSK SPLIT] ⚠️  Using first menu video as fallback');
        print('[KIOSK SPLIT] Current video index: $_currentVideoIndex');

        final video = _menuVideos[_currentVideoIndex];
        print('[KIOSK SPLIT] Fallback video: "${video.title}" (menuId: ${video.menuId})');

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

        videoPath = actualPath;
        videoTitle = video.title;
      }

      setState(() {
        _currentVideoPath = videoPath;
        _hasError = false;
        _videoPlayerKeyCounter++;
      });

      print('[KIOSK SPLIT] ========== VIDEO INITIALIZED ==========');
      print('[KIOSK SPLIT] ✅ Selected video: $videoTitle');
      print('[KIOSK SPLIT] ✅ Video path: $videoPath');
      print('[KIOSK SPLIT] ========================================');
    } catch (e) {
      print('[KIOSK SPLIT] Error initializing video: $e');
      setState(() {
        _hasError = true;
        _errorMessage = e.toString();
      });
    }
  }

  void _onVideoCompleted() {
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
      } else if (_currentActionType == 'increaseQuantity' ||
                 _currentActionType == 'decreaseQuantity') {
        // Quantity change completed, return to saved video
        print('[KIOSK SPLIT] $_currentActionType video completed, returning to saved video');
        _returnToSavedVideo();
      } else {
        // Other menu video completed, return to saved video
        print('[KIOSK SPLIT] Menu video completed, returning to saved video');
        _returnToSavedVideo();
      }
    } else {
      // Regular video completed, replay the first (main) video
      print('[KIOSK SPLIT] Main video completed, replaying from beginning');
      _playMainVideo();
    }
  }

  Future<void> _playNextVideo() async {
    _currentVideoIndex = (_currentVideoIndex + 1) % _menuVideos.length;
    await _initializeVideo();
  }

  Future<void> _playMenuVideo(String videoPath, [String? actionType, String? categoryId]) async {
    print('[KIOSK SPLIT] Playing menu video: $videoPath (action: $actionType, category: $categoryId)');

    try {
      // If already playing menu video, just switch to new menu video
      // Don't save the state again (keep the original saved state)
      if (!_isPlayingMenuVideo) {
        // Save current video path only if not already playing menu video
        _savedVideoPath = _currentVideoPath;
        _savedPosition = Duration.zero;
        print('[KIOSK SPLIT] Saved video: $_savedVideoPath');
      } else {
        print('[KIOSK SPLIT] Already playing menu video, switching to new menu video');
      }

      _isPlayingMenuVideo = true;
      _currentActionType = actionType; // Store the action type
      _currentCategoryId = categoryId; // Store the category ID

      // Update current video path to play menu video
      setState(() {
        _currentVideoPath = videoPath;
        _videoPlayerKeyCounter++;
      });

      print('[KIOSK SPLIT] Menu video path set');
    } catch (e) {
      print('[KIOSK SPLIT] Error playing menu video: $e');
      _isPlayingMenuVideo = false;
      _currentActionType = null;
      _currentCategoryId = null;
    }
  }

  Future<void> _returnToSavedVideo() async {
    if (_savedVideoPath == null) return;

    print('[KIOSK SPLIT] Returning to saved video: $_savedVideoPath');

    try {
      // Return to saved video
      setState(() {
        _currentVideoPath = _savedVideoPath;
        _videoPlayerKeyCounter++;
      });

      // Clear saved state
      _isPlayingMenuVideo = false;
      _currentActionType = null;
      _savedVideoPath = null;
      _savedPosition = Duration.zero;

      print('[KIOSK SPLIT] Returned to saved video');
    } catch (e) {
      print('[KIOSK SPLIT] Error returning to saved video: $e');
      _isPlayingMenuVideo = false;
      _currentActionType = null;
    }
  }

  Future<void> _playMainVideo() async {
    if (_menuVideos.isEmpty) return;

    print('[KIOSK SPLIT] Playing main video from beginning');

    try {
      // Try to get main video from menu XML
      final mainVideoFilename = _menuService.getMainVideoFilename();

      if (mainVideoFilename != null && widget.downloadPath != null && widget.kioskId != null) {
        print('[KIOSK SPLIT] Main video filename from menu: $mainVideoFilename');

        // Check if main video file exists in menu folder first
        String mainVideoPath = '${widget.downloadPath}/${widget.kioskId}/menu/$mainVideoFilename';
        File mainVideoFile = File(mainVideoPath);

        // If not in menu folder, try kiosk folder
        if (!await mainVideoFile.exists()) {
          mainVideoPath = '${widget.downloadPath}/${widget.kioskId}/$mainVideoFilename';
          mainVideoFile = File(mainVideoPath);
        }

        // If main video file exists, play it
        if (await mainVideoFile.exists()) {
          print('[KIOSK SPLIT] Found main video at: $mainVideoPath');

          setState(() {
            _currentVideoPath = mainVideoPath;
            _videoPlayerKeyCounter++;
          });

          // Clear saved state
          _isPlayingMenuVideo = false;
          _currentActionType = null;
          _savedVideoPath = null;
          _savedPosition = Duration.zero;

          print('[KIOSK SPLIT] Main video from menu XML is playing');
          return;
        } else {
          print('[KIOSK SPLIT] Main video file not found: $mainVideoPath');
        }
      }

      // Fallback: play first menu video
      print('[KIOSK SPLIT] Fallback to first menu video');
      _currentVideoIndex = 0;
      final video = _menuVideos[_currentVideoIndex];
      final actualPath = await _downloadService.getActualFilePath(video.localPath!);

      setState(() {
        _currentVideoPath = actualPath;
        _videoPlayerKeyCounter++;
      });

      // Clear saved state
      _isPlayingMenuVideo = false;
      _currentActionType = null;
      _savedVideoPath = null;
      _savedPosition = Duration.zero;

      print('[KIOSK SPLIT] Main video path set (fallback): ${video.title}');
    } catch (e) {
      print('[KIOSK SPLIT] Error playing main video: $e');
      _isPlayingMenuVideo = false;
      _currentActionType = null;
    }
  }

  Future<void> _playCategoryVideo() async {
    if (_currentCategoryId == null || widget.downloadPath == null || widget.kioskId == null) return;

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

      setState(() {
        _currentVideoPath = videoPath;
        _videoPlayerKeyCounter++;
      });

      // Update action type to 'category' so it returns to saved video when completed
      _currentActionType = 'category';
      // Keep _isPlayingMenuVideo true, this is still a menu video
      // Will return to saved video when this category video completes
      print('[KIOSK SPLIT] Category video path set');
    } catch (e) {
      print('[KIOSK SPLIT] Error playing category video: $e');
      _returnToSavedVideo();
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _exitKiosk() async {
    print('[KIOSK SPLIT] Exiting kiosk, clearing fullscreen...');
    await windowManager.setFullScreen(false);
    print('[KIOSK SPLIT] Fullscreen cleared, popping navigation...');
    if (mounted) {
      Navigator.of(context).pop();
    }
    print('[KIOSK SPLIT] Navigation popped');
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

    print('[KIOSK SPLIT] ========== build() ==========');
    print('[KIOSK SPLIT] Orientation: $orientation');
    print('[KIOSK SPLIT] isPortrait: $isPortrait');
    print('[KIOSK SPLIT] Will use: ${isPortrait ? "Portrait" : "Landscape"} layout');

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
        body: isPortrait ? _buildPortraitLayout() : _buildLandscapeLayout(),
      ),
    );
  }

  // Portrait layout: Video on top, menu at bottom
  Widget _buildPortraitLayout() {
    return Column(
      children: [
        // Top: Video Player
        Expanded(
          flex: 3, // 3:5 ratio (video:menu)
          child: _buildVideoPlayer(),
        ),

        // Bottom: Coffee Kiosk
        Expanded(
          flex: 5, // 3:5 ratio (video:menu)
          child: _buildKioskOverlay(),
        ),
      ],
    );
  }

  // Landscape layout: Left (video + cart), Right (menu)
  Widget _buildLandscapeLayout() {
    return Row(
      children: [
        // Left: Video (top) + Cart (bottom)
        Expanded(
          flex: 1,
          child: Column(
            children: [
              // Video Player (top)
              Expanded(
                flex: 1,
                child: _buildVideoPlayer(),
              ),
              // Cart (bottom)
              Expanded(
                flex: 1,
                child: CoffeeKioskOverlay(
                  key: _cartKey, // Assign GlobalKey to cart widget
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
                  onCheckoutComplete: () {
                    print('[KIOSK SPLIT] Checkout completed, returning to main video');
                    _playMainVideo();
                  },
                  downloadPath: widget.downloadPath,
                  kioskId: widget.kioskId,
                  menuFilename: widget.menuFilename,
                  showOnlyCart: true, // Show only cart section
                ),
              ),
            ],
          ),
        ),

        // Right: Menu
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
            onPlayMenuVideo: _playMenuVideo,
            onCheckoutComplete: () {
              print('[KIOSK SPLIT] Checkout completed, returning to main video');
              _playMainVideo();
            },
            downloadPath: widget.downloadPath,
            kioskId: widget.kioskId,
            menuFilename: widget.menuFilename,
            showOnlyMenu: true, // Show only menu section
            cartStateKey: _cartKey, // Pass cart key to menu widget
          ),
        ),
      ],
    );
  }

  // Build video player widget
  Widget _buildVideoPlayer() {
    print('[KIOSK SPLIT] _buildVideoPlayer() called - _currentVideoPath: $_currentVideoPath, _hasError: $_hasError');

    if (_hasError) {
      print('[KIOSK SPLIT] Showing error screen');
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
      );
    }

    if (_currentVideoPath == null) {
      print('[KIOSK SPLIT] Video path is null, showing loading screen');
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    print('[KIOSK SPLIT] Rendering VideoPlayerWidget with path: $_currentVideoPath');
    return VideoPlayerWidget(
      key: ValueKey(_videoPlayerKeyCounter),
      videoPath: _currentVideoPath!,
      onCompleted: _onVideoCompleted,
      onError: () {
        setState(() {
          _hasError = true;
          _errorMessage = '동영상 재생 중 오류가 발생했습니다';
        });
      },
    );
  }

  // Build kiosk overlay widget (for portrait mode - full overlay)
  Widget _buildKioskOverlay() {
    return CoffeeKioskOverlay(
      key: _cartKey, // Assign GlobalKey to enable cart state access
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
      onCheckoutComplete: () {
        print('[KIOSK SPLIT] Checkout completed, returning to main video');
        _playMainVideo();
      },
      downloadPath: widget.downloadPath,
      kioskId: widget.kioskId,
      menuFilename: widget.menuFilename,
    );
  }
}
