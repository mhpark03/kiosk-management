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
  Kiosk? _kiosk; // Store kiosk info for display

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

    // 설정이 없거나 유효하지 않으면 WebSocket 연결 안 함
    if (config == null || !config.isValid) {
      print('WebSocket: 설정이 없어 연결하지 않습니다');
      return;
    }

    // kioskId가 없으면 WebSocket 연결 안 함
    if (config.kioskId.isEmpty) {
      print('WebSocket: kioskId가 없어 연결하지 않습니다');
      return;
    }

    try {
      // Get kiosk info to obtain kiosk number
      print('WebSocket: Fetching kiosk info for ${config.kioskId}...');
      final kiosk = await widget.apiService.getKiosk(config.kioskId);

      // Store kiosk info for display
      if (mounted) {
        setState(() {
          _kiosk = kiosk;
        });
      }

      // kioskNumber가 없으면 WebSocket 연결 안 함
      if (kiosk.kioskNumber == null) {
        print('WebSocket: kioskNumber가 설정되지 않아 연결하지 않습니다');
        print('WebSocket: 실시간 동기화를 사용하려면 백엔드에서 kiosk_number를 설정하세요');
        // WebSocket 없이도 앱은 정상 동작 (수동 새로고침 사용)
        return;
      }

      // posId가 없으면 WebSocket 연결 안 함
      if (config.posId == null || config.posId!.isEmpty) {
        print('WebSocket: posId가 없어 연결하지 않습니다');
        return;
      }

      // Get kiosk authentication token
      print('WebSocket: Requesting kiosk token...');
      final kioskToken = await widget.apiService.getKioskToken(
        config.kioskId,
        config.posId!,
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
      print('WebSocket: 앱은 WebSocket 없이 계속 동작합니다 (수동 새로고침 사용 가능)');
      // WebSocket 연결 실패는 치명적이지 않음 - 조용히 실패하고 수동 새로고침만 사용
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

      // Fetch kiosk info if not already loaded
      if (_kiosk == null) {
        try {
          final kiosk = await widget.apiService.getKiosk(config.kioskId);
          if (mounted) {
            setState(() {
              _kiosk = kiosk;
            });
          }
        } catch (e) {
          print('Failed to fetch kiosk info: $e');
        }
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
        automaticallyImplyLeading: false, // Remove back button from main screen
        title: Row(
          children: [
            Text('영상 목록 - ${_kiosk?.posname ?? ""} ${_kiosk?.kioskNumber != null ? "#${_kiosk!.kioskNumber}" : ""}'),
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
            onPressed: () {
              _resetAutoLogoutTimer();

              // kioskId 검증
              final config = widget.storageService.getConfig();
              if (config == null || config.kioskId.isEmpty) {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red),
                        SizedBox(width: 8),
                        Text('동기화 오류'),
                      ],
                    ),
                    content: const Text(
                      '키오스크 ID가 설정되지 않았습니다.\n설정 화면에서 키오스크 정보를 입력해주세요.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('확인'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => SettingsScreen(
                                apiService: widget.apiService,
                                storageService: widget.storageService,
                              ),
                            ),
                          );
                        },
                        child: const Text('설정으로 이동'),
                      ),
                    ],
                  ),
                );
                return;
              }

              // WebSocket 연결 확인
              if (!_wsConnected) {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Row(
                      children: [
                        Icon(Icons.cloud_off, color: Colors.orange),
                        SizedBox(width: 8),
                        Text('연결 오류'),
                      ],
                    ),
                    content: const Text(
                      'WebSocket이 연결되지 않았습니다.\n\n가능한 원인:\n• 키오스크 번호(kiosk_number)가 설정되지 않음\n• POS ID가 설정되지 않음\n• 서버 연결 실패\n\n수동 새로고침 버튼을 사용하세요.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('확인'),
                      ),
                    ],
                  ),
                );
                return;
              }

              // 동기화 요청
              _webSocketService.requestSync();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('동기화 요청을 보냈습니다'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
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
