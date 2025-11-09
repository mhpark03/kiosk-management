import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:window_manager/window_manager.dart';
import 'package:media_kit/media_kit.dart';
import 'services/api_service.dart';
import 'services/storage_service.dart';
import 'models/kiosk_config.dart';
import 'screens/login_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/video_list_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize MediaKit for video playback
  MediaKit.ensureInitialized();

  // Initialize window manager (desktop platforms only)
  if (defaultTargetPlatform == TargetPlatform.windows ||
      defaultTargetPlatform == TargetPlatform.macOS ||
      defaultTargetPlatform == TargetPlatform.linux) {
    await windowManager.ensureInitialized();
  }

  // Allow all orientations (auto-rotation)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // Initialize storage service
  final storageService = await StorageService.init();

  // Initialize API service with default server
  final config = storageService.getConfig();
  final apiService = ApiService(
    baseUrl: config?.serverUrl ?? ServerPresets.local, // Use local server for development
  );

  // Restore auth token if exists
  final token = await storageService.getToken();
  if (token != null) {
    apiService.setAuthToken(token);
  }

  runApp(MyApp(
    apiService: apiService,
    storageService: storageService,
  ));
}

class MyApp extends StatefulWidget {
  final ApiService apiService;
  final StorageService storageService;

  const MyApp({
    super.key,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  // 키오스크는 무인으로 동작하므로 자동 로그아웃 기능 제거

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '키오스크 다운로더',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: _getInitialScreen(),
      debugShowCheckedModeBanner: false,
    );
  }

  Widget _getInitialScreen() {
    // 키오스크는 무인 환경에서 동작하므로 설정이 있으면 로그인 없이 바로 실행
    // Check if config is set (키오스크 설정 확인)
    if (widget.storageService.isConfigured()) {
      // 설정이 있으면 로그인 여부와 상관없이 영상 목록으로
      return VideoListScreen(
        apiService: widget.apiService,
        storageService: widget.storageService,
      );
    }

    // 설정이 없으면 로그인 화면으로 (초기 설정 필요)
    return LoginScreen(
      apiService: widget.apiService,
      storageService: widget.storageService,
    );
  }
}
