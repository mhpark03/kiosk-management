import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'services/storage_service.dart';
import 'models/kiosk_config.dart';
import 'screens/login_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/video_list_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize storage service
  final storageService = await StorageService.init();

  // Initialize API service with default server
  final config = storageService.getConfig();
  final apiService = ApiService(
    baseUrl: config?.serverUrl ?? ServerPresets.awsDev,
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

class MyApp extends StatelessWidget {
  final ApiService apiService;
  final StorageService storageService;

  const MyApp({
    super.key,
    required this.apiService,
    required this.storageService,
  });

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
    // Check if user is logged in
    if (!storageService.isLoggedIn()) {
      return LoginScreen(
        apiService: apiService,
        storageService: storageService,
      );
    }

    // Check if config is set
    if (!storageService.isConfigured()) {
      return SettingsScreen(
        apiService: apiService,
        storageService: storageService,
      );
    }

    // Go to video list
    return VideoListScreen(
      apiService: apiService,
      storageService: storageService,
    );
  }
}
