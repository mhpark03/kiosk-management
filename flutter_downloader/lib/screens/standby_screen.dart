import 'dart:async';
import 'package:flutter/material.dart';
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

  @override
  void initState() {
    super.initState();

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

      // Listen for person detection
      _detectionSubscription =
          _detectionService.personDetectedStream.listen((personDetected) {
        if (personDetected) {
          print('[STANDBY] Person detected, activating kiosk...');
          _activateKiosk();
        }
      });

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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera preview (if available)
          if (_detectionService.isInitialized &&
              _detectionService.cameraController != null)
            Center(
              child: AspectRatio(
                aspectRatio:
                    _detectionService.cameraController!.value.aspectRatio,
                child: CameraPreview(_detectionService.cameraController!),
              ),
            ),

          // Dark overlay
          Container(
            color: Colors.black.withOpacity(0.6),
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
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
