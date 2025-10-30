import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/download_service.dart';
import '../services/websocket_service.dart';
import '../models/video.dart';
import '../models/kiosk.dart';
import 'settings_screen.dart';
import 'login_screen.dart';

class VideoListScreen extends StatefulWidget {
  final ApiService apiService;
  final StorageService storageService;

  const VideoListScreen({
    super.key,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<VideoListScreen> createState() => _VideoListScreenState();
}

class _VideoListScreenState extends State<VideoListScreen> {
  final DownloadService _downloadService = DownloadService();
  final WebSocketService _webSocketService = WebSocketService();
  List<Video> _videos = [];
  bool _isLoading = false;
  String? _errorMessage;
  bool _wsConnected = false;
  Timer? _autoLogoutTimer;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
    _loadVideos();
    _initWebSocket();
    _startAutoLogoutTimer();
  }

  @override
  void dispose() {
    _webSocketService.dispose();
    _autoLogoutTimer?.cancel();
    super.dispose();
  }

  void _checkLoginStatus() {
    _isLoggedIn = widget.storageService.isLoggedIn();
  }

  void _startAutoLogoutTimer() {
    _autoLogoutTimer?.cancel();

    if (_isLoggedIn) {
      // 10분 후 자동 로그아웃
      _autoLogoutTimer = Timer(const Duration(minutes: 10), () {
        if (mounted && _isLoggedIn) {
          _performLogout(isAuto: true);
        }
      });
    }
  }

  void _resetAutoLogoutTimer() {
    if (_isLoggedIn) {
      _startAutoLogoutTimer();
    }
  }

  Future<void> _performLogout({bool isAuto = false}) async {
    // 사용자와 토큰만 삭제 (설정은 유지)
    await widget.storageService.deleteUser();
    await widget.storageService.deleteToken();
    widget.apiService.setAuthToken(null);

    _autoLogoutTimer?.cancel();

    if (mounted) {
      setState(() {
        _isLoggedIn = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isAuto ? '10분 동안 활동이 없어 자동 로그아웃되었습니다' : '로그아웃되었습니다'),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  Future<void> _navigateToLogin() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LoginScreen(
          apiService: widget.apiService,
          storageService: widget.storageService,
        ),
      ),
    );

    // 로그인 화면에서 돌아온 후 상태 업데이트
    if (mounted) {
      _checkLoginStatus();
      _startAutoLogoutTimer();
      setState(() {});
    }
  }

  Future<void> _initWebSocket() async {
    final config = widget.storageService.getConfig();

    if (config == null || !config.isValid) {
      print('WebSocket: Cannot initialize - invalid config');
      return;
    }

    try {
      // Get kiosk info to obtain kiosk number
      print('WebSocket: Fetching kiosk info...');
      final kiosk = await widget.apiService.getKiosk(config.kioskId);

      if (kiosk.kioskNumber == null) {
        print('WebSocket: Cannot initialize - kioskNumber is null');
        return;
      }

      // Get kiosk authentication token
      print('WebSocket: Requesting kiosk token...');
      final kioskToken = await widget.apiService.getKioskToken(
        config.kioskId,
        config.posId ?? '',
        kiosk.kioskNumber!,
      );

      print('WebSocket: Kiosk token obtained successfully');

      // Configure WebSocket with kiosk token
      _webSocketService.configure(
        config.serverUrl,
        config.kioskId,
        kioskToken,
      );

      // Set up callbacks
      _webSocketService.onSyncCommand = () {
        print('WebSocket: Sync command received, reloading videos...');
        _loadVideos();
      };

      _webSocketService.onConnectionStatusChanged = (connected) {
        if (mounted) {
          setState(() {
            _wsConnected = connected;
          });
          if (connected) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('실시간 연결됨'),
                duration: Duration(seconds: 2),
                backgroundColor: Colors.green,
              ),
            );
          }
        }
      };

      // Connect
      _webSocketService.connect();
    } catch (e) {
      print('WebSocket: Initialization failed: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('웹소켓 연결 실패: ${e.toString().replaceFirst('Exception: ', '')}'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  Future<void> _loadVideos() async {
    // 사용자 활동으로 타이머 리셋
    _resetAutoLogoutTimer();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final config = widget.storageService.getConfig();
      if (config == null || !config.isValid) {
        throw Exception('설정이 올바르지 않습니다');
      }

      final videos = await widget.apiService.getKioskVideos(config.kioskId);

      setState(() {
        _videos = videos;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadVideo(Video video) async {
    // 사용자 활동으로 타이머 리셋
    _resetAutoLogoutTimer();

    try {
      final config = widget.storageService.getConfig();
      if (config == null) return;

      // Get download URL
      final downloadUrl = await widget.apiService.getVideoDownloadUrl(video.id);

      // Update video status
      setState(() {
        video.downloadStatus = 'downloading';
        video.downloadProgress = 0.0;
      });

      // Download file
      final localPath = await _downloadService.downloadFile(
        downloadUrl,
        config.downloadPath,
        video.filename,
        onProgress: (received, total) {
          setState(() {
            video.downloadProgress = received / total;
          });
        },
      );

      setState(() {
        video.downloadStatus = 'completed';
        video.localPath = localPath;
        video.downloadProgress = 1.0;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${video.title} 다운로드 완료')),
        );
      }
    } catch (e) {
      setState(() {
        video.downloadStatus = 'failed';
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('다운로드 실패: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.storageService.getUser();
    final config = widget.storageService.getConfig();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Text('영상 목록 - ${config?.kioskId ?? ""}'),
            const SizedBox(width: 8),
            Icon(
              _wsConnected ? Icons.cloud_done : Icons.cloud_off,
              size: 20,
              color: _wsConnected ? Colors.green : Colors.grey,
            ),
            if (_isLoggedIn) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.shade700,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.person, size: 14, color: Colors.white),
                    const SizedBox(width: 4),
                    Text(
                      user?.name ?? '로그인됨',
                      style: const TextStyle(fontSize: 12, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          // 로그인/로그아웃 버튼
          if (_isLoggedIn)
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => _performLogout(isAuto: false),
              tooltip: '로그아웃',
            )
          else
            IconButton(
              icon: const Icon(Icons.login),
              onPressed: _navigateToLogin,
              tooltip: '로그인',
            ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              _resetAutoLogoutTimer();
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SettingsScreen(
                    apiService: widget.apiService,
                    storageService: widget.storageService,
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadVideos,
            tooltip: '영상 목록 새로고침',
          ),
          IconButton(
            icon: Icon(
              _wsConnected ? Icons.sync : Icons.sync_disabled,
              color: _wsConnected ? Colors.white : Colors.grey,
            ),
            onPressed: _wsConnected
                ? () {
                    _resetAutoLogoutTimer();
                    _webSocketService.requestSync();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('동기화 요청을 보냈습니다'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  }
                : null,
            tooltip: '동기화 요청',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error, size: 64, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadVideos,
                        child: const Text('다시 시도'),
                      ),
                    ],
                  ),
                )
              : _videos.isEmpty
                  ? const Center(
                      child: Text('할당된 영상이 없습니다'),
                    )
                  : ListView.builder(
                      itemCount: _videos.length,
                      padding: const EdgeInsets.all(16),
                      itemBuilder: (context, index) {
                        final video = _videos[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 16),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  video.title,
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                if (video.description != null)
                                  Text(
                                    video.description!,
                                    style: const TextStyle(color: Colors.grey),
                                  ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Chip(
                                      label: Text(video.mediaType),
                                      backgroundColor: Colors.blue.shade100,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      video.fileSizeDisplay,
                                      style: const TextStyle(color: Colors.grey),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                                if (video.downloadStatus == 'downloading')
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      LinearProgressIndicator(
                                        value: video.downloadProgress,
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        '다운로드 중... ${(video.downloadProgress * 100).toInt()}%',
                                        textAlign: TextAlign.center,
                                      ),
                                    ],
                                  )
                                else if (video.downloadStatus == 'completed')
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.check_circle,
                                        color: Colors.green,
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        '다운로드 완료',
                                        style: TextStyle(color: Colors.green),
                                      ),
                                    ],
                                  )
                                else if (video.downloadStatus == 'failed')
                                  ElevatedButton.icon(
                                    onPressed: () => _downloadVideo(video),
                                    icon: const Icon(Icons.refresh),
                                    label: const Text('재시도'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.orange,
                                    ),
                                  )
                                else
                                  ElevatedButton.icon(
                                    onPressed: () => _downloadVideo(video),
                                    icon: const Icon(Icons.download),
                                    label: const Text('다운로드'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.blue,
                                      foregroundColor: Colors.white,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
