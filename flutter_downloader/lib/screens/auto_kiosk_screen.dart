import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:window_manager/window_manager.dart';
import 'dart:async';
import '../models/video.dart';
import '../services/presence_detection_service.dart';
import '../services/person_detection_service.dart';
import '../widgets/kiosk_loading_screen.dart';
import '../widgets/detection_status_overlay.dart';
import 'idle_screen.dart';
import 'kiosk_split_screen.dart';

/// Detection mode for kiosk activation
enum DetectionMode {
  touch,  // Touch/mouse based detection
  camera, // Camera-based person detection
}

/// Auto-switching kiosk screen that transitions between:
/// - Idle mode: Fullscreen advertisement videos
/// - Kiosk mode: Split screen with video + menu
class AutoKioskScreen extends StatefulWidget {
  final List<Video> videos;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;
  final DetectionMode detectionMode;
  final Duration idleTimeout;

  const AutoKioskScreen({
    super.key,
    required this.videos,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
    this.detectionMode = DetectionMode.camera, // Default to camera detection
    this.idleTimeout = const Duration(seconds: 30),
  });

  @override
  State<AutoKioskScreen> createState() => _AutoKioskScreenState();
}

class _AutoKioskScreenState extends State<AutoKioskScreen> {
  late PresenceDetectionService _presenceService;
  StreamSubscription<bool>? _presenceSubscription;
  StreamSubscription<InitializationProgress>? _initProgressSubscription;
  bool _isKioskMode = false;
  late List<Video> _advertisementVideos;
  late List<Video> _allVideos;

  bool _isFullscreenReady = false; // Track if fullscreen transition is complete
  bool _isInitializing = true; // Track if initialization is in progress
  InitializationProgress _initProgress = InitializationProgress(0.0, '초기화 준비 중...');

  // Cache screen widgets to prevent recreation on every build
  Widget? _cachedIdleScreen;
  Widget? _cachedKioskScreen;

  // Focus node for keyboard events
  late FocusNode _focusNode;

  // GlobalKey to access KioskSplitScreen state
  final GlobalKey<_KioskSplitScreenWrapperState> _kioskKey = GlobalKey<_KioskSplitScreenWrapperState>();

  // Cart warning popup timer
  Timer? _cartWarningTimer;
  bool _isShowingCartWarning = false;

  @override
  void initState() {
    super.initState();

    // Initialize focus node
    _focusNode = FocusNode();

    // Separate videos into advertisement and all videos
    // Advertisement videos: menuId is null or empty (not linked to menu items)
    // All videos: used in kiosk mode for menu item videos
    _allVideos = widget.videos;
    _advertisementVideos = widget.videos.where((video) =>
      video.menuId == null || video.menuId!.isEmpty
    ).toList();

    // If no advertisement videos, fallback to using all videos
    if (_advertisementVideos.isEmpty) {
      _advertisementVideos = _allVideos;
    }

    // Initialize presence detection service based on detection mode
    if (widget.detectionMode == DetectionMode.camera) {
      _presenceService = CameraPresenceDetectionService();

      // Listen to initialization progress for camera mode
      if (_presenceService is CameraPresenceDetectionService) {
        _initProgressSubscription = (_presenceService as CameraPresenceDetectionService)
            .initProgressStream
            .listen((progress) {
          setState(() {
            _initProgress = progress;
            // Mark initialization complete when progress reaches 100%
            if (progress.progress >= 1.0) {
              _isInitializing = false;
            }
          });
        });
      }
    } else {
      _presenceService = TouchPresenceDetectionService(
        idleTimeout: widget.idleTimeout,
      );
      // Touch mode doesn't need initialization time
      _isInitializing = false;
    }

    // Listen to presence changes
    _presenceSubscription = _presenceService.presenceStream.listen((isPresent) {
      if (_isKioskMode == isPresent) {
        return;
      }

      // When transitioning from kiosk to idle mode, check cart
      if (!isPresent && _isKioskMode) {
        _handleTransitionToIdle();
      } else {
        setState(() {
          _isKioskMode = isPresent;
        });
      }
    });

    // Start detection (this will trigger initialization for camera mode)
    _presenceService.start();

    // Enter fullscreen and wait for it to complete
    _enterFullscreen();
  }

  Future<void> _enterFullscreen() async {
    // Only use window_manager on desktop platforms
    if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
      await windowManager.setFullScreen(true);
    } else if (Platform.isAndroid) {
      // On Android, use SystemChrome for fullscreen
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }

    // Wait for fullscreen transition to complete
    await Future.delayed(const Duration(milliseconds: 300));

    // Mark fullscreen as ready and rebuild
    if (mounted) {
      setState(() {
        _isFullscreenReady = true;
      });

      // Request focus after fullscreen is ready
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _focusNode.requestFocus();
        }
      });
    }
  }

  Future<void> _exitFullscreen() async {
    // Only use window_manager on desktop platforms
    if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
      await windowManager.setFullScreen(false);
    } else if (Platform.isAndroid) {
      // On Android, restore system UI
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  @override
  void dispose() {
    _presenceSubscription?.cancel();
    _initProgressSubscription?.cancel();
    _presenceService.dispose();
    _focusNode.dispose();
    _cartWarningTimer?.cancel();
    // Ensure fullscreen is cleared (fire-and-forget)
    if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
      windowManager.setFullScreen(false);
    }
    super.dispose();
  }

  /// Handle transition to idle mode with cart warning if needed
  void _handleTransitionToIdle() {
    print('[AUTO KIOSK] Handling transition to idle mode...');
    print('[AUTO KIOSK] _isKioskMode: $_isKioskMode, _isInitializing: $_isInitializing');

    // If still initializing or never entered kiosk mode, skip cart check
    if (_isInitializing || !_isKioskMode) {
      print('[AUTO KIOSK] Skipping cart check (still initializing or not in kiosk mode)');
      setState(() {
        _isKioskMode = false;
      });
      return;
    }

    // Check if kiosk screen has been built
    if (_cachedKioskScreen == null) {
      print('[AUTO KIOSK] Kiosk screen not yet built, skipping cart check');
      setState(() {
        _isKioskMode = false;
      });
      return;
    }

    // Check if cart has items
    final kioskState = _kioskKey.currentState;
    print('[AUTO KIOSK] kioskState: $kioskState');

    final hasCartItems = kioskState?.hasCartItems() ?? false;
    print('[AUTO KIOSK] hasCartItems: $hasCartItems, _isShowingCartWarning: $_isShowingCartWarning');

    if (hasCartItems && !_isShowingCartWarning) {
      // Show warning popup
      print('[AUTO KIOSK] Showing cart warning popup');
      _showCartWarningPopup();
    } else {
      // Direct transition to idle
      print('[AUTO KIOSK] Direct transition to idle (no cart items or already showing warning)');
      setState(() {
        _isKioskMode = false;
      });
    }
  }

  /// Show cart warning popup with 10 second auto-dismiss
  void _showCartWarningPopup() {
    if (!mounted || _isShowingCartWarning) return;

    _isShowingCartWarning = true;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _CartWarningDialog(
        onContinue: () {
          Navigator.of(context).pop();
          _isShowingCartWarning = false;
          _cartWarningTimer?.cancel();
          // Stay in kiosk mode and re-trigger presence
          _presenceService.triggerPresence();
        },
        onTimeout: () {
          if (mounted) {
            Navigator.of(context).pop();
            _isShowingCartWarning = false;
            setState(() {
              _isKioskMode = false;
            });
          }
        },
      ),
    ).then((_) {
      _isShowingCartWarning = false;
      _cartWarningTimer?.cancel();
    });
  }

  void _handleUserPresence() {
    _presenceService.triggerPresence();
  }

  Future<void> _handleExit() async {
    await _exitFullscreen();
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Show loading screen during initialization (camera setup, AI model loading)
    if (_isInitializing) {
      return Scaffold(
        body: KioskLoadingScreen(progress: _initProgress),
      );
    }

    // Show loading screen until fullscreen transition completes
    if (!_isFullscreenReady) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
      );
    }

    final widget = Focus(
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
      child: Scaffold(
        body: Stack(
          children: [
            _isKioskMode ? _buildKioskMode() : _buildIdleMode(),
            // Show detection status overlay (top-right corner)
            const DetectionStatusOverlay(),
          ],
        ),
      ),
    );
    return widget;
  }

  Widget _buildIdleMode() {
    // Create IdleScreen only once and cache it
    if (_cachedIdleScreen == null) {
      _cachedIdleScreen = IdleScreen(
        videos: _advertisementVideos, // Only advertisement videos (menuId == null)
        onUserPresence: _handleUserPresence,
      );
    }
    return _cachedIdleScreen!;
  }

  Widget _buildKioskMode() {
    // Create KioskSplitScreen only once and cache it
    if (_cachedKioskScreen == null) {
      _cachedKioskScreen = GestureDetector(
        onTap: _handleUserPresence,
        onPanUpdate: (_) => _handleUserPresence(),
        child: MouseRegion(
          onHover: (_) => _handleUserPresence(),
          child: _KioskSplitScreenWrapper(
            key: _kioskKey,
            videos: _allVideos,
            downloadPath: widget.downloadPath,
            kioskId: widget.kioskId,
            menuFilename: widget.menuFilename,
          ),
        ),
      );
    }
    return _cachedKioskScreen!;
  }
}

/// Wrapper widget to access KioskSplitScreen's cart state
class _KioskSplitScreenWrapper extends StatefulWidget {
  final List<Video> videos;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;

  const _KioskSplitScreenWrapper({
    super.key,
    required this.videos,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
  });

  @override
  State<_KioskSplitScreenWrapper> createState() => _KioskSplitScreenWrapperState();
}

class _KioskSplitScreenWrapperState extends State<_KioskSplitScreenWrapper> {
  final GlobalKey<KioskSplitScreenState> _splitScreenKey = GlobalKey<KioskSplitScreenState>();

  bool hasCartItems() {
    print('[CART CHECK] Checking cart items...');

    final splitScreenState = _splitScreenKey.currentState;
    print('[CART CHECK] splitScreenState: $splitScreenState');

    if (splitScreenState == null) {
      print('[CART CHECK] splitScreenState is null, returning false');
      return false;
    }

    // Access cart key from KioskSplitScreen
    final cartKey = splitScreenState.cartKey;
    final cartState = cartKey.currentState;
    print('[CART CHECK] cartState: $cartState');

    if (cartState == null) {
      print('[CART CHECK] cartState is null, returning false');
      return false;
    }

    final hasItems = cartState.cartItems.isNotEmpty;
    print('[CART CHECK] cartItems count: ${cartState.cartItems.length}, hasItems: $hasItems');

    return hasItems;
  }

  @override
  Widget build(BuildContext context) {
    return KioskSplitScreen(
      key: _splitScreenKey,
      videos: widget.videos,
      downloadPath: widget.downloadPath,
      kioskId: widget.kioskId,
      menuFilename: widget.menuFilename,
    );
  }
}

/// Cart warning dialog with 10 second auto-dismiss
class _CartWarningDialog extends StatefulWidget {
  final VoidCallback onContinue;
  final VoidCallback onTimeout;

  const _CartWarningDialog({
    required this.onContinue,
    required this.onTimeout,
  });

  @override
  State<_CartWarningDialog> createState() => _CartWarningDialogState();
}

class _CartWarningDialogState extends State<_CartWarningDialog> {
  Timer? _countdownTimer;
  int _secondsRemaining = 10;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() {
          _secondsRemaining--;
        });
      } else {
        timer.cancel();
        widget.onTimeout();
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      title: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 32),
          const SizedBox(width: 12),
          const Text(
            '주문을 계속하시겠습니까?',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '장바구니에 상품이 담겨 있습니다.',
            style: TextStyle(fontSize: 18),
          ),
          const SizedBox(height: 20),
          Text(
            '$_secondsRemaining초 후 자동으로 취소됩니다',
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            _countdownTimer?.cancel();
            widget.onTimeout();
          },
          child: const Text(
            '주문 취소',
            style: TextStyle(fontSize: 18, color: Colors.grey),
          ),
        ),
        ElevatedButton(
          onPressed: () {
            _countdownTimer?.cancel();
            widget.onContinue();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.brown,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: const Text(
            '계속 주문하기',
            style: TextStyle(fontSize: 18, color: Colors.white),
          ),
        ),
      ],
    );
  }
}
