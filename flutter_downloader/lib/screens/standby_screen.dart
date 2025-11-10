import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import '../services/person_detection_service.dart';
import '../models/video.dart';
import 'kiosk_split_screen.dart';

/// Standby screen that activates when a person is detected
class StandbyScreen extends StatefulWidget {
  final List<Video> videos;
  final String? downloadPath;
  final String? kioskId;
  final String? menuFilename;

  const StandbyScreen({
    super.key,
    required this.videos,
    this.downloadPath,
    this.kioskId,
    this.menuFilename,
  });

  @override
  State<StandbyScreen> createState() => _StandbyScreenState();
}

class _StandbyScreenState extends State<StandbyScreen>
    with SingleTickerProviderStateMixin {
  final PersonDetectionService _detectionService = PersonDetectionService();
  StreamSubscription<bool>? _detectionSubscription;
  bool _isInitializing = true;
  String? _errorMessage;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  // Minimum preview time before allowing activation (5 seconds)
  static const Duration _minPreviewTime = Duration(seconds: 5);
  DateTime? _previewStartTime;
  bool _canActivate = false;
  Timer? _previewTimer;
  Timer? _countdownTimer;
  int _remainingSeconds = 5;

  // For Windows camera preview refresh
  Timer? _frameRefreshTimer;
  Uint8List? _currentFrameData;

  // Focus node for keyboard events
  late FocusNode _focusNode;

  @override
  void initState() {
    super.initState();

    // Initialize focus node
    _focusNode = FocusNode();

    // Request focus after frame is built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });

    // Setup pulse animation for waiting message
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _initializeDetection();
  }

  Future<void> _initializeDetection() async {
    try {
      print('[STANDBY] Initializing person detection...');

      await _detectionService.initialize();
      await _detectionService.startDetection();

      // Start preview timer
      _previewStartTime = DateTime.now();
      _remainingSeconds = _minPreviewTime.inSeconds;
      print('[STANDBY] Preview started, minimum display time: ${_minPreviewTime.inSeconds} seconds');

      // Set timer to allow activation after minimum preview time
      _previewTimer = Timer(_minPreviewTime, () {
        setState(() {
          _canActivate = true;
          _remainingSeconds = 0;
        });
        print('[STANDBY] Preview time complete, activation enabled');
      });

      // Start countdown timer (updates every second)
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (_remainingSeconds > 0) {
          setState(() {
            _remainingSeconds--;
          });
        } else {
          timer.cancel();
        }
      });

      // Listen for person detection
      _detectionSubscription =
          _detectionService.personDetectedStream.listen((personDetected) {
        if (personDetected && _canActivate) {
          print('[STANDBY] Person detected and can activate, activating kiosk...');
          _activateKiosk();
        } else if (personDetected && !_canActivate) {
          final elapsed = DateTime.now().difference(_previewStartTime!);
          final remaining = _minPreviewTime - elapsed;
          print('[STANDBY] Person detected but preview time not complete (${remaining.inSeconds}s remaining)');
        }
      });

      // Start frame refresh timer for Windows
      if (Platform.isWindows) {
        print('[STANDBY] Starting frame refresh timer for Windows preview');
        _frameRefreshTimer = Timer.periodic(const Duration(milliseconds: 100), (_) {
          if (mounted && _detectionService.latestFramePng != null) {
            setState(() {
              _currentFrameData = _detectionService.latestFramePng;
            });
          }
        });
      }

      setState(() {
        _isInitializing = false;
      });

      print('[STANDBY] Person detection started successfully');
    } catch (e) {
      print('[STANDBY] Error initializing detection: $e');
      setState(() {
        _isInitializing = false;
        _errorMessage = e.toString();
      });
    }
  }

  void _activateKiosk() {
    // Navigate to kiosk screen
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (context) => KioskSplitScreen(
          videos: widget.videos,
          downloadPath: widget.downloadPath,
          kioskId: widget.kioskId,
          menuFilename: widget.menuFilename,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _detectionSubscription?.cancel();
    _detectionService.stopDetection();
    _pulseController.dispose();
    _previewTimer?.cancel();
    _countdownTimer?.cancel();
    _frameRefreshTimer?.cancel();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.escape) {
          print('[STANDBY] ESC key pressed, exiting app...');
          if (Platform.isWindows || Platform.isAndroid) {
            SystemNavigator.pop(); // Exit app
          }
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: GestureDetector(
          onTap: () {
            print('[STANDBY] Screen tapped, activating kiosk...');
            _activateKiosk();
          },
          child: Stack(
          children: [
            // Camera preview - full screen
            if (_detectionService.isInitialized) ...[
              // Android: Use CameraPreview
              if (Platform.isAndroid && _detectionService.cameraController != null)
                SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: _detectionService.cameraController!.value.previewSize?.height ?? 1,
                      height: _detectionService.cameraController!.value.previewSize?.width ?? 1,
                      child: CameraPreview(_detectionService.cameraController!),
                    ),
                  ),
                ),
              // Windows: Display captured frame (PNG encoded)
              if (Platform.isWindows && _currentFrameData != null)
                SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: Image.memory(
                      _currentFrameData!,
                      gaplessPlayback: true, // Smooth frame transitions
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
            ],

            // Light overlay (more transparent to see camera)
            Container(
              color: Colors.black.withOpacity(0.3),
            ),

          // Centered message
          Center(
            child: _isInitializing
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const CircularProgressIndicator(
                        color: Colors.white,
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '시스템 초기화 중...',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.9),
                          fontSize: 18,
                        ),
                      ),
                    ],
                  )
                : _errorMessage != null
                    ? Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            color: Colors.red,
                            size: 64,
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            '카메라를 초기화할 수 없습니다',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _errorMessage!,
                            style: TextStyle(
                              color: Colors.grey.shade400,
                              fontSize: 14,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 32),
                          ElevatedButton(
                            onPressed: () {
                              // Skip to kiosk directly
                              _activateKiosk();
                            },
                            child: const Text('키오스크 시작'),
                          ),
                        ],
                      )
                    : ScaleTransition(
                        scale: _pulseAnimation,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.waving_hand,
                              color: Colors.white,
                              size: 80,
                            ),
                            const SizedBox(height: 32),
                            const Text(
                              '환영합니다!',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 48,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              '주문하시려면 화면 앞으로 다가와 주세요',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.9),
                                fontSize: 24,
                              ),
                            ),
                            const SizedBox(height: 48),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 32,
                                vertical: 16,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.3),
                                  width: 2,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.camera_alt,
                                    color: Colors.white70,
                                    size: 24,
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    '카메라가 사람을 감지 중입니다',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.7),
                                      fontSize: 16,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
          ),

          // Debug info (bottom right)
          if (_detectionService.isInitialized)
            Positioned(
              bottom: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '감지 상태: ${_detectionService.isDetecting ? "활성" : "비활성"}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      '사람 감지: ${_detectionService.personPresent ? "예" : "아니오"}',
                      style: TextStyle(
                        color: _detectionService.personPresent
                            ? Colors.green
                            : Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    if (!_canActivate)
                      Text(
                        '프리뷰 시간: ${_remainingSeconds}초 남음',
                        style: const TextStyle(
                          color: Colors.yellow,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    if (_canActivate)
                      const Text(
                        '활성화 준비 완료',
                        style: TextStyle(
                          color: Colors.green,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    if (Platform.isWindows)
                      Text(
                        '프레임: ${_currentFrameData != null ? "수신 중" : "대기 중"}',
                        style: TextStyle(
                          color: _currentFrameData != null
                              ? Colors.green
                              : Colors.white70,
                          fontSize: 12,
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
