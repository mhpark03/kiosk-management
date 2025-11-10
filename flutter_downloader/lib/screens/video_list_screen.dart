import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/download_service.dart';
import '../services/websocket_service.dart';
import '../services/event_logger.dart';
import '../utils/device_info_util.dart';
import '../models/video.dart';
import '../models/kiosk.dart';
import '../models/coffee_order.dart';
import '../widgets/coffee_kiosk_overlay.dart';
import 'settings_screen.dart';
import 'login_screen.dart';
import 'video_player_screen.dart';
import 'auto_kiosk_screen.dart';

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
  Timer? _tokenRenewalTimer;
  Timer? _statusHeartbeatTimer; // Timer for periodic status reporting
  bool _isLoggedIn = false;
  Kiosk? _kiosk; // Store kiosk info for display
  bool _isNavigating = false; // Flag to prevent duplicate navigation

  // Menu file status
  String? _menuFilename;
  bool _hasMenu = false;
  bool _menuDownloaded = false;
  Video? _menuVideo; // Store menu video info for title/description

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
    _connectKiosk(); // Connect kiosk and get session token
    _loadVideos();
    _initWebSocket();
    _startAutoLogoutTimer();
    _startStatusHeartbeat(); // Start periodic status reporting
  }

  @override
  void dispose() {
    _webSocketService.dispose();
    _autoLogoutTimer?.cancel();
    _tokenRenewalTimer?.cancel();
    _statusHeartbeatTimer?.cancel();
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

  // Connect kiosk and get session token (6-month validity, renewed every 7 days)
  Future<void> _connectKiosk() async {
    final config = widget.storageService.getConfig();

    // 설정이 없거나 유효하지 않으면 연결 안 함
    if (config == null || !config.isValid) {
      print('[CONNECT] 설정이 없어 키오스크 연결하지 않습니다');
      return;
    }

    // kioskId가 없으면 연결 안 함
    if (config.kioskId.isEmpty) {
      print('[CONNECT] kioskId가 없어 연결하지 않습니다');
      return;
    }

    // posId가 없으면 연결 안 함
    if (config.posId == null || config.posId!.isEmpty) {
      print('[CONNECT] posId가 없어 연결하지 않습니다');
      return;
    }

    try {
      // Get kiosk info to obtain kiosk number
      print('[CONNECT] Fetching kiosk info for ${config.kioskId}...');
      final kiosk = await widget.apiService.getKiosk(config.kioskId);

      // kioskNumber가 없으면 연결 안 함
      if (kiosk.kioskNumber == null) {
        print('[CONNECT] kioskNumber가 설정되지 않아 연결하지 않습니다');
        return;
      }

      // Store kiosk info for display
      if (mounted) {
        setState(() {
          _kiosk = kiosk;
        });
      }

      // Set kiosk authentication headers for API requests (for unattended operation)
      widget.apiService.setKioskAuth(
        config.posId,
        config.kioskId,
        kiosk.kioskNumber,
      );

      // Call /connect endpoint to get session token
      print('[CONNECT] Calling /connect endpoint...');
      final connectResponse = await widget.apiService.connectKiosk(
        config.kioskId,
        config.posId!,
        kiosk.kioskNumber!,
      );

      // Token is automatically set in ApiService by connectKiosk()
      final renewalInterval = connectResponse['renewalInterval'] as int;
      print('[CONNECT] Connection successful, token will be renewed every ${renewalInterval / 86400} days');

      // Start token renewal timer (renew every 7 days)
      _startTokenRenewalTimer(renewalInterval);

    } catch (e) {
      print('[CONNECT] Failed to connect kiosk: $e');
      // 연결 실패는 치명적이지 않음 - 조용히 실패하고 기존 인증 방식 사용
    }
  }

  // Start timer to renew token every 7 days
  void _startTokenRenewalTimer(int renewalIntervalSeconds) {
    _tokenRenewalTimer?.cancel();

    final renewalDuration = Duration(seconds: renewalIntervalSeconds);
    print('[TOKEN RENEWAL] Setting up renewal timer: ${renewalDuration.inDays} days');

    _tokenRenewalTimer = Timer.periodic(renewalDuration, (timer) {
      print('[TOKEN RENEWAL] Timer triggered, renewing token...');
      _connectKiosk(); // Renew token by calling connect again
    });
  }

  // Start periodic status heartbeat (every 2 minutes)
  // This allows admin to monitor kiosk health even when tokens are expired
  void _startStatusHeartbeat() {
    _statusHeartbeatTimer?.cancel();

    // Send heartbeat immediately
    _reportKioskStatus();

    // Then every 2 minutes
    _statusHeartbeatTimer = Timer.periodic(const Duration(minutes: 2), (timer) {
      _reportKioskStatus();
    });

    print('[HEARTBEAT] Status reporting started (every 2 minutes)');
  }

  // Report kiosk status to server (no auth required)
  Future<void> _reportKioskStatus() async {
    final config = widget.storageService.getConfig();
    if (config == null || config.kioskId.isEmpty) {
      print('[HEARTBEAT] No config, skipping status report');
      return;
    }

    try {
      // Determine connection status
      String connectionStatus = 'ONLINE';
      String? errorMessage;

      if (_errorMessage != null && _errorMessage!.isNotEmpty) {
        connectionStatus = 'ERROR';
        errorMessage = _errorMessage;
      }

      // Report status to server
      await widget.apiService.reportKioskStatus(
        kioskId: config.kioskId,
        appVersion: '1.0.0', // TODO: Get from package info
        connectionStatus: connectionStatus,
        errorMessage: errorMessage,
        isLoggedIn: _isLoggedIn,
        osType: DeviceInfoUtil.getOsType(),
        osVersion: DeviceInfoUtil.getOsVersion(),
        deviceName: DeviceInfoUtil.getDeviceName(),
      );

      print('[HEARTBEAT] Status reported - Status: $connectionStatus, Logged in: $_isLoggedIn, WS: $_wsConnected');
    } catch (e) {
      print('[HEARTBEAT] Failed to report status: $e');
      // Don't crash app on heartbeat failure
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

      // Store kiosk info for display (if not already set by _connectKiosk)
      if (mounted && _kiosk == null) {
        setState(() {
          _kiosk = kiosk;
        });
      }

      // Set kiosk authentication headers for API requests (for unattended operation)
      // (if not already set by _connectKiosk)
      if (config.posId != null && config.posId!.isNotEmpty && kiosk.kioskNumber != null) {
        widget.apiService.setKioskAuth(
          config.posId,
          config.kioskId,
          kiosk.kioskNumber,
        );
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
      _setupWebSocketCallbacks();

      // Connect
      _webSocketService.connect();
    } catch (e) {
      print('WebSocket: Initialization failed: $e');

      // Auto-recovery: If logged in + config exists, attempt token renewal
      if (_isLoggedIn && config.kioskId.isNotEmpty) {
        print('WebSocket: 로그인 상태이므로 토큰 갱신 시도...');
        await _attemptTokenRenewalAndReconnect(config, _kiosk);
      } else if (!_isLoggedIn) {
        // Not logged in - show login required notification
        print('WebSocket: 로그인이 필요하여 연결할 수 없습니다');
        _showLoginRequiredForWebSocket();
      } else {
        print('WebSocket: 앱은 WebSocket 없이 계속 동작합니다 (수동 새로고침 사용 가능)');
      }
    }
  }

  /// Setup WebSocket callbacks (extracted to avoid code duplication)
  void _setupWebSocketCallbacks() {
    _webSocketService.onSyncCommand = () {
      print('WebSocket: Sync command received, reloading videos...');
      _loadVideos();
    };

    _webSocketService.onConfigUpdate = () {
      print('WebSocket: Config update received, reloading config from server...');
      _handleConfigUpdate();
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
  }

  /// Attempt to renew token and reconnect WebSocket when connection fails
  Future<void> _attemptTokenRenewalAndReconnect(
    dynamic config,
    Kiosk? kiosk,
  ) async {
    try {
      print('[TOKEN RENEWAL] 설정 값을 서버에 재전송하여 토큰 갱신 시작...');

      // Call updateKioskConfig API to get new token
      final newToken = await widget.apiService.updateKioskConfig(
        config.kioskId,
        config.downloadPath,
        config.serverUrl,
        config.autoSync,
        config.syncIntervalHours,
      );

      if (newToken != null) {
        print('[TOKEN RENEWAL] 새 토큰 발급 성공, 저장 중...');

        // Save new token to secure storage
        await widget.storageService.saveToken(newToken);

        // Set new token in ApiService
        widget.apiService.setAuthToken(newToken);

        print('[TOKEN RENEWAL] 토큰 갱신 완료, WebSocket 재연결 시도...');

        // Re-request kiosk WebSocket token
        if (kiosk?.kioskNumber != null && config.posId != null) {
          final kioskToken = await widget.apiService.getKioskToken(
            config.kioskId,
            config.posId!,
            kiosk!.kioskNumber!,
          );

          // Reconfigure WebSocket with new kiosk token
          _webSocketService.configure(
            config.serverUrl,
            config.kioskId,
            kioskToken,
          );

          // Re-setup callbacks
          _setupWebSocketCallbacks();

          // Attempt connection
          _webSocketService.connect();

          print('[TOKEN RENEWAL] WebSocket 재연결 성공!');

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('토큰 갱신 후 실시간 연결 복구됨'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 3),
              ),
            );
          }
        }
      } else {
        print('[TOKEN RENEWAL] 서버에서 토큰을 반환하지 않음 (갱신 실패)');
        _showTokenRenewalFailedMessage();
      }
    } catch (e) {
      print('[TOKEN RENEWAL] 토큰 갱신 실패: $e');
      _showTokenRenewalFailedMessage();
    }
  }

  /// Show notification when token renewal fails
  void _showTokenRenewalFailedMessage() {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('실시간 연결 실패 (수동 새로고침으로 사용 가능)'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  /// Show dialog when login is required for WebSocket connection
  void _showLoginRequiredForWebSocket() {
    if (!mounted) return;

    // Delay to ensure widget is fully built
    Future.delayed(const Duration(milliseconds: 500), () {
      if (!mounted) return;

      showDialog(
        context: context,
        barrierDismissible: false, // Must take action
        builder: (context) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning, color: Colors.orange),
              SizedBox(width: 8),
              Text('로그인 필요'),
            ],
          ),
          content: const Text(
            'WebSocket 실시간 연결을 위해서는 로그인이 필요합니다.\n\n'
            '무인 환경에서 토큰 문제가 발생했습니다.\n'
            '관리자가 로그인하여 문제를 해결해주세요.\n\n'
            '※ 로그인 없이도 수동 새로고침으로 앱을 계속 사용할 수 있습니다.',
            style: TextStyle(fontSize: 14),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                // Show info that manual refresh is available
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('수동 새로고침 버튼으로 영상 목록을 갱신할 수 있습니다'),
                    backgroundColor: Colors.blue,
                    duration: Duration(seconds: 4),
                  ),
                );
              },
              child: const Text('나중에'),
            ),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                _navigateToLogin();
              },
              icon: const Icon(Icons.login),
              label: const Text('로그인'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      );
    });
  }

  Future<void> _handleConfigUpdate() async {
    print('[CONFIG UPDATE] Received config update notification from server');

    final config = widget.storageService.getConfig();
    if (config == null || config.kioskId.isEmpty) {
      print('[CONFIG UPDATE] No config available, skipping update');
      return;
    }

    try {
      // Fetch latest config from server
      final serverConfig = await widget.apiService.getKioskConfig(config.kioskId);
      print('[CONFIG UPDATE] Fetched latest config from server: $serverConfig');

      // Extract config fields
      final downloadPath = serverConfig['downloadPath'] as String?;
      final apiUrl = serverConfig['apiUrl'] as String?;
      final autoSync = serverConfig['autoSync'] as bool?;
      final syncInterval = serverConfig['syncInterval'] as int?;

      // Update local config with server values
      final updatedConfig = config.copyWith(
        downloadPath: downloadPath ?? config.downloadPath,
        serverUrl: apiUrl ?? config.serverUrl,
        autoSync: autoSync ?? config.autoSync,
        syncIntervalHours: syncInterval ?? config.syncIntervalHours,
      );

      // Save updated config locally
      await widget.storageService.saveConfig(updatedConfig);

      print('[CONFIG UPDATE] Local config updated successfully from server');

      // Reload videos and menu to check for updates
      print('[CONFIG UPDATE] Checking for menu and video updates...');
      await _loadVideos();
      await _downloadMenuFile(updatedConfig);

      // Show notification to user
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('관리자가 설정을 변경했습니다. 메뉴를 확인하는 중...'),
            duration: Duration(seconds: 3),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      print('[CONFIG UPDATE] Failed to update config from server: $e');
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
        // 설정이 없으면 영상 목록 clear
        setState(() {
          _videos = [];
          _isLoading = false;
          _errorMessage = null;
        });
        return;
      }

      // Initialize EventLogger with download path
      EventLogger().initialize(config.downloadPath);

      // Log sync started event
      await EventLogger().logEvent(
        eventType: 'SYNC_STARTED',
        message: '영상 동기화 시작',
      );

      // Always fetch fresh kiosk info from server
      try {
        final kiosk = await widget.apiService.getKiosk(config.kioskId);
        if (mounted) {
          setState(() {
            _kiosk = kiosk;
          });
        }
      } catch (e) {
        print('Failed to fetch kiosk info: $e');
        // Continue with video sync even if kiosk info fetch fails
      }

      // Get all files (videos, images, menu XML) from kiosk_video table
      final videos = await widget.apiService.getKioskVideos(config.kioskId);

      // Sort videos by mediaType: VIDEO -> DOCUMENT -> IMAGE
      videos.sort((a, b) {
        const typeOrder = {'VIDEO': 0, 'DOCUMENT': 1, 'IMAGE': 2, 'AUDIO': 3};
        final orderA = typeOrder[a.mediaType] ?? 99;
        final orderB = typeOrder[b.mediaType] ?? 99;
        return orderA.compareTo(orderB);
      });

      // Check local file existence and update download status
      await _checkLocalFiles(videos, config);

      // Remove files that are not in the server list
      await _removeUnassignedFiles(videos, config);

      setState(() {
        _videos = videos;
        _isLoading = false;
      });

      // Log sync completed event
      await EventLogger().logEvent(
        eventType: 'SYNC_COMPLETED',
        message: '파일 ${videos.length} 개 동기완료 (영상, 이미지, 메뉴)',
        metadata: '{"videoCount": ${videos.length}}',
      );

      // Auto-download pending files (videos, images, menu XML) in background
      _downloadPendingVideosInBackground();
    } catch (e) {
      final config = widget.storageService.getConfig();
      if (config != null) {
        // Log sync failed event
        await EventLogger().logEvent(
          eventType: 'SYNC_FAILED',
          message: '동기화 실패: ${e.toString()}',
          metadata: '{"error": "${e.toString()}"}',
        );
      }

      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _checkLocalFiles(List<Video> videos, dynamic config) async {
    print('[CHECK FILES] Checking local file existence for ${videos.length} videos');
    print('[CHECK FILES] Download path from config: ${config.downloadPath}');

    for (final video in videos) {
      final fileName = '${video.filename}';
      // Files with menuId (menu-related media) are stored in menu/ subfolder
      String filePath;
      if (video.menuId != null && video.menuId!.isNotEmpty) {
        filePath = '${config.downloadPath}/${config.kioskId}/menu/$fileName';
      } else {
        filePath = '${config.downloadPath}/${config.kioskId}/$fileName';
      }
      print('[CHECK FILES] Checking: $filePath');

      try {
        final file = File(filePath);
        final exists = await file.exists();

        if (exists && video.downloadStatus != 'completed') {
          print('[CHECK FILES] File exists but status is ${video.downloadStatus}, marking as completed: $fileName');
          video.downloadStatus = 'completed';
          video.localPath = filePath;
          print('[CHECK FILES] localPath set to: $filePath');

          // Update status in backend
          await widget.apiService.updateVideoDownloadStatus(config.kioskId, video.id, 'COMPLETED');
        } else if (!exists && video.downloadStatus == 'completed') {
          print('[CHECK FILES] File missing but status is completed, marking as pending: $fileName');
          video.downloadStatus = 'pending';
          video.localPath = null;

          // Update status in backend
          await widget.apiService.updateVideoDownloadStatus(config.kioskId, video.id, 'PENDING');
        } else if (exists) {
          print('[CHECK FILES] File exists: $fileName');
          video.downloadStatus = 'completed';
          video.localPath = filePath;

          // Update status in backend
          await widget.apiService.updateVideoDownloadStatus(config.kioskId, video.id, 'COMPLETED');
        } else {
          print('[CHECK FILES] File missing: $fileName');
          video.downloadStatus = 'pending';
        }
      } catch (e) {
        print('[CHECK FILES] Error checking file $fileName: $e');
        video.downloadStatus = 'pending';
      }
    }
  }

  Future<void> _removeUnassignedFiles(List<Video> videos, dynamic config) async {
    print('[CLEANUP] Checking for unassigned files to remove');

    try {
      final kioskDir = Directory('${config.downloadPath}/${config.kioskId}');

      // Check if directory exists
      if (!await kioskDir.exists()) {
        print('[CLEANUP] Kiosk directory does not exist: ${kioskDir.path}');
        return;
      }

      // Get list of assigned filenames from server
      final assignedFilenames = videos.map((v) => v.filename).toSet();
      print('[CLEANUP] ${assignedFilenames.length} files assigned from server');

      int removedCount = 0;

      // Scan local directory for files
      await for (final entity in kioskDir.list()) {
        if (entity is File) {
          final fileName = entity.path.split(Platform.pathSeparator).last;

          // Skip menu directory (handled separately)
          if (entity.path.contains('${Platform.pathSeparator}menu${Platform.pathSeparator}')) {
            continue;
          }

          // Check if file is in assigned list
          if (!assignedFilenames.contains(fileName)) {
            print('[CLEANUP] Removing unassigned file: $fileName');

            try {
              await entity.delete();
              removedCount++;

              // Log file removal
              await EventLogger().logEvent(
                eventType: 'FILE_REMOVED',
                message: '미할당 파일 삭제: $fileName',
                metadata: '{"filename": "$fileName"}',
              );
            } catch (e) {
              print('[CLEANUP] Failed to delete file $fileName: $e');
            }
          }
        }
      }

      // Also check menu folder for DOCUMENT files
      final menuDir = Directory('${config.downloadPath}/${config.kioskId}/menu');
      if (await menuDir.exists()) {
        print('[CLEANUP] Checking menu folder for unassigned documents');

        await for (final entity in menuDir.list()) {
          if (entity is File) {
            final fileName = entity.path.split(Platform.pathSeparator).last;

            // Check if file is in assigned list
            if (!assignedFilenames.contains(fileName)) {
              print('[CLEANUP] Removing unassigned menu file: $fileName');

              try {
                await entity.delete();
                removedCount++;

                // Log file removal
                await EventLogger().logEvent(
                  eventType: 'FILE_REMOVED',
                  message: '미할당 메뉴 파일 삭제: $fileName',
                  metadata: '{"filename": "$fileName", "folder": "menu"}',
                );
              } catch (e) {
                print('[CLEANUP] Failed to delete menu file $fileName: $e');
              }
            }
          }
        }
      }

      if (removedCount > 0) {
        print('[CLEANUP] Removed $removedCount unassigned files');
        await EventLogger().logEvent(
          eventType: 'CLEANUP_COMPLETED',
          message: '미할당 파일 $removedCount 개 삭제 완료',
          metadata: '{"removedCount": $removedCount}',
        );
      } else {
        print('[CLEANUP] No unassigned files found');
      }
    } catch (e) {
      print('[CLEANUP] Error during cleanup: $e');
      await EventLogger().logEvent(
        eventType: 'CLEANUP_FAILED',
        message: '미할당 파일 삭제 실패: ${e.toString()}',
        metadata: '{"error": "${e.toString()}"}',
      );
    }
  }

  Future<void> _downloadMenuFile(dynamic config) async {
    try {
      print('[MENU DOWNLOAD] Checking menu file for kiosk: ${config.kioskId}');

      // Get menu download URL from server
      final menuData = await widget.apiService.getMenuDownloadUrl(config.kioskId);

      if (menuData == null) {
        print('[MENU DOWNLOAD] No menu assigned to this kiosk');
        return;
      }

      final downloadUrl = menuData['downloadUrl'] as String;
      final filename = menuData['filename'] as String;
      final menuId = menuData['menuId'] as int;

      // Create menu directory path
      final menuDirPath = '${config.downloadPath}/${config.kioskId}/menu';
      final menuFilePath = '$menuDirPath/$filename';

      // Check if the exact menu file already exists
      final menuFile = File(menuFilePath);
      final menuFileExists = await menuFile.exists();

      // Check for any existing XML files in the menu directory
      final menuDir = Directory(menuDirPath);
      bool hasOldMenuFiles = false;

      if (await menuDir.exists()) {
        await for (final file in menuDir.list()) {
          if (file is File && file.path.endsWith('.xml')) {
            final existingFilename = file.path.split(Platform.pathSeparator).last;
            if (existingFilename != filename) {
              // Found an old menu file with different name - menu has been updated
              hasOldMenuFiles = true;
              print('[MENU DOWNLOAD] Found old menu file: ${file.path}');
              print('[MENU DOWNLOAD] Current menu file should be: $filename');
              break;
            }
          }
        }
      }

      // Check if menu ID has changed (menu has been updated on server)
      final bool menuIdChanged = _kiosk != null && _kiosk!.menuId != menuId;

      // If the current menu file exists, menu ID hasn't changed, and there are no old files, skip download
      if (menuFileExists && !menuIdChanged && !hasOldMenuFiles) {
        print('[MENU DOWNLOAD] Menu file already up-to-date: $filename (ID: $menuId)');

        // Update menu download status in backend
        try {
          await widget.apiService.updateMenuDownloadStatus(config.kioskId, menuId, 'COMPLETED');
          print('[MENU DOWNLOAD] Updated menu download status to COMPLETED for menu ID: $menuId');
        } catch (e) {
          print('[MENU DOWNLOAD] Failed to update menu download status: $e');
        }

        // Update menu download status
        if (mounted) {
          setState(() {
            _menuDownloaded = true;
          });
        }
        return;
      }

      // If menu ID has changed, download the new menu even if filename is the same
      if (menuIdChanged) {
        print('[MENU DOWNLOAD] Menu ID changed from ${_kiosk!.menuId} to $menuId, downloading new menu');
      }

      // Delete all old menu files (menu has been updated)
      if (await menuDir.exists()) {
        await for (final file in menuDir.list()) {
          if (file is File && file.path.endsWith('.xml')) {
            print('[MENU DOWNLOAD] Deleting old menu file: ${file.path}');
            await file.delete();

            // Log old menu file deletion
            await EventLogger().logEvent(
              eventType: 'MENU_UPDATED',
              message: '이전 메뉴 파일 삭제: ${file.path.split(Platform.pathSeparator).last}',
              metadata: '{"newMenuId": $menuId, "newFilename": "$filename"}',
            );
          }
        }
      }

      print('[MENU DOWNLOAD] Downloading new menu file: $filename (ID: $menuId)');

      // Log menu download start
      await EventLogger().logEvent(
        eventType: 'DOWNLOAD_STARTED',
        message: '메뉴 파일 다운로드 시작: $filename',
        metadata: '{"menuId": $menuId, "filename": "$filename"}',
      );

      // Download menu file with original filename
      await _downloadService.downloadFile(
        downloadUrl,
        menuDirPath,
        filename,
      );

      print('[MENU DOWNLOAD] Menu file downloaded successfully: $filename');

      // Update menu download status in backend
      try {
        await widget.apiService.updateMenuDownloadStatus(config.kioskId, menuId, 'COMPLETED');
        print('[MENU DOWNLOAD] Updated menu download status to COMPLETED for menu ID: $menuId');
      } catch (e) {
        print('[MENU DOWNLOAD] Failed to update menu download status: $e');
      }

      // Update menu download status
      if (mounted) {
        setState(() {
          _menuDownloaded = true;
        });
      }

      // Log menu download complete
      await EventLogger().logEvent(
        eventType: 'DOWNLOAD_COMPLETED',
        message: '메뉴 파일 다운로드 완료: $filename',
        metadata: '{"menuId": $menuId, "filename": "$filename"}',
      );
    } catch (e) {
      print('[MENU DOWNLOAD] Failed to download menu file: $e');

      // Log menu download failed
      await EventLogger().logEvent(
        eventType: 'DOWNLOAD_FAILED',
        message: '메뉴 파일 다운로드 실패: ${e.toString()}',
        metadata: '{"error": "${e.toString()}"}',
      );
      // Don't throw error - menu download failure should not stop video sync
    }
  }

  Future<void> _downloadPendingVideosInBackground() async {
    final pendingVideos = _videos.where((v) => v.downloadStatus == 'pending').toList();

    if (pendingVideos.isEmpty) {
      print('[AUTO DOWNLOAD] No pending videos to download');
      return;
    }

    print('[AUTO DOWNLOAD] Found ${pendingVideos.length} pending videos, starting background download...');

    // Download videos sequentially in background (don't wait)
    Future.microtask(() async {
      for (final video in pendingVideos) {
        try {
          print('[AUTO DOWNLOAD] Starting download: ${video.title}');
          await _downloadVideo(video, isBackgroundDownload: true);
          // Small delay between downloads
          await Future.delayed(const Duration(milliseconds: 500));
        } catch (e) {
          print('[AUTO DOWNLOAD] Failed to download ${video.title}: $e');
          // Continue with next video even if one fails
        }
      }
      print('[AUTO DOWNLOAD] Background download completed');
    });
  }

  Future<void> _downloadVideo(Video video, {bool isBackgroundDownload = false}) async {
    // 사용자 활동으로 타이머 리셋
    _resetAutoLogoutTimer();

    try {
      print('[DOWNLOAD] Starting download for video: ${video.title} (ID: ${video.id})');
      final config = widget.storageService.getConfig();
      if (config == null) {
        print('[DOWNLOAD] Config is null, aborting download');
        return;
      }

      // Check if video has S3 URL
      if (video.s3Url == null || video.s3Url!.isEmpty) {
        print('[DOWNLOAD] Video ${video.id} has no S3 URL');
        throw Exception('영상 다운로드 URL이 없습니다');
      }

      // Log download started event
      await EventLogger().logEvent(
        eventType: 'DOWNLOAD_STARTED',
        message: '다운로드 시작: ${video.title}',
        metadata: '{"videoId": ${video.id}, "title": "${video.title}"}',
      );

      // Update video download status on server to DOWNLOADING
      await widget.apiService.updateVideoDownloadStatus(
        config.kioskId,
        video.id,
        'DOWNLOADING',
      );

      // Use S3 URL directly (like kiosk-downloader does)
      final downloadUrl = video.s3Url!;
      print('[DOWNLOAD] Using S3 URL: ${downloadUrl.substring(0, downloadUrl.length > 100 ? 100 : downloadUrl.length)}...');

      // Create kioskId subdirectory: Downloads/KioskVideos/[KioskId]
      // Files with menuId (menu-related media) go to menu/ subfolder
      String kioskDownloadPath = '${config.downloadPath}\\${config.kioskId}';
      if (video.menuId != null && video.menuId!.isNotEmpty) {
        kioskDownloadPath = '${config.downloadPath}\\${config.kioskId}\\menu';
        print('[DOWNLOAD] Menu-related file (menuId: ${video.menuId}) will be saved to menu folder: $kioskDownloadPath');
      }

      // Update video status
      setState(() {
        video.downloadStatus = 'downloading';
        video.downloadProgress = 0.0;
      });

      // Download file
      final localPath = await _downloadService.downloadFile(
        downloadUrl,
        kioskDownloadPath,
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

      // Log download completed event
      await EventLogger().logEvent(
        eventType: 'DOWNLOAD_COMPLETED',
        message: '다운로드 완료: ${video.title}',
        metadata: '{"videoId": ${video.id}, "title": "${video.title}", "fileSize": ${video.fileSizeBytes}}',
      );

      // Update video download status on server
      await widget.apiService.updateVideoDownloadStatus(
        config.kioskId,
        video.id,
        'COMPLETED',
      );

      // Only show SnackBar for manual downloads (not background auto-downloads)
      if (mounted && !isBackgroundDownload) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${video.title} 다운로드 완료')),
        );
      }
    } catch (e) {
      print('[DOWNLOAD] Error downloading video ${video.title} (ID: ${video.id}): $e');

      final config = widget.storageService.getConfig();
      if (config != null) {
        // Log download failed event
        await EventLogger().logEvent(
          eventType: 'DOWNLOAD_FAILED',
          message: '다운로드 실패: ${video.title}',
          metadata: '{"videoId": ${video.id}, "title": "${video.title}", "error": "${e.toString()}"}',
        );

        // Update video download status on server to FAILED
        await widget.apiService.updateVideoDownloadStatus(
          config.kioskId,
          video.id,
          'FAILED',
        );
      }

      setState(() {
        video.downloadStatus = 'failed';
      });

      // Only show SnackBar for manual downloads (not background auto-downloads)
      if (mounted && !isBackgroundDownload) {
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
    final hasConfig = config != null && config.isValid;
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    final screenWidth = MediaQuery.of(context).size.width;
    final isLargeScreen = screenWidth >= 600; // 태블릿 크기 (600dp 이상)

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false, // Remove back button from main screen
        title: Row(
          children: [
            Expanded(
              child: Text(
                hasConfig && _kiosk != null
                  ? '${_kiosk!.posname ?? ""} ${_kiosk!.kioskNumber != null ? "#${_kiosk!.kioskNumber}" : ""}'
                  : '설정 필요',
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 2),
            Icon(
              _wsConnected ? Icons.cloud_done : Icons.cloud_off,
              size: 14,
              color: _wsConnected ? Colors.green : Colors.grey,
            ),
            if (_isLoggedIn) ...[
              const SizedBox(width: 2),
              if (isLargeScreen) // 태블릿 이상 크기에서는 항상 이름 표시
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.green.shade700,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.person, size: 12, color: Colors.white),
                      const SizedBox(width: 2),
                      Text(
                        user?.name ?? '로그인됨',
                        style: const TextStyle(fontSize: 11, color: Colors.white),
                      ),
                    ],
                  ),
                )
              else
                Icon(Icons.person, size: 14, color: Colors.green.shade700),
            ],
          ],
        ),
        actions: [
          // 로그인/로그아웃 버튼
          if (_isLoggedIn)
            IconButton(
              icon: const Icon(Icons.logout, size: 20),
              onPressed: () => _performLogout(isAuto: false),
              tooltip: '로그아웃',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            )
          else
            IconButton(
              icon: const Icon(Icons.login, size: 20),
              onPressed: _navigateToLogin,
              tooltip: '로그인',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            ),
          IconButton(
            icon: const Icon(Icons.settings, size: 20),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
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
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: hasConfig ? _loadVideos : null,
            tooltip: hasConfig ? '영상 목록 새로고침' : '설정이 필요합니다',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          ),
          IconButton(
            icon: Icon(
              _wsConnected ? Icons.sync : Icons.sync_disabled,
              size: 20,
              color: hasConfig && _wsConnected ? Colors.white : Colors.grey,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            onPressed: !hasConfig ? null : () {
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
              : Stack(
                  children: [
                    (_videos.isEmpty && !_hasMenu)
                        ? const Center(
                            child: Text('할당된 영상이 없습니다'),
                          )
                        : ListView.builder(
                      itemCount: (_hasMenu ? 1 : 0) + _videos.length,
                      padding: const EdgeInsets.all(16),
                      itemBuilder: (context, index) {
                        // First item is menu card if menu exists
                        if (_hasMenu && index == 0) {
                          final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
                          final thumbnailSize = isLandscape ? 60.0 : 48.0;

                          return Card(
                            margin: EdgeInsets.only(bottom: isLandscape ? 12 : 8),
                            child: Padding(
                              padding: EdgeInsets.all(isLandscape ? 12 : 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Menu icon (same size as video thumbnail)
                                  Container(
                                    width: thumbnailSize,
                                    height: thumbnailSize,
                                    decoration: BoxDecoration(
                                      color: Colors.amber.shade100,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Icon(
                                      Icons.restaurant_menu,
                                      size: isLandscape ? 28 : 24,
                                      color: Colors.amber.shade800,
                                    ),
                                  ),
                                  SizedBox(width: isLandscape ? 12 : 8),

                                  // Title and description
                                  Expanded(
                                    child: isLandscape
                                      ? Row(
                                          children: [
                                            // Menu ID (same style as video)
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                horizontal: 6,
                                                vertical: 2,
                                              ),
                                              decoration: BoxDecoration(
                                                color: Colors.grey.shade300,
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                '#${_menuVideo?.id ?? _kiosk?.menuId ?? 0}',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.grey.shade700,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            // Menu title
                                            Flexible(
                                              flex: 2,
                                              child: Text(
                                                _menuVideo?.title ?? _menuFilename ?? '메뉴 파일',
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            if (_menuVideo?.description != null) ...[
                                              const SizedBox(width: 12),
                                              // Description
                                              Flexible(
                                                flex: 3,
                                                child: Text(
                                                  _menuVideo!.description!,
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    color: Colors.grey.shade600,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ],
                                        )
                                      : Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            // Menu ID and title
                                            Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 5,
                                                    vertical: 2,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: Colors.grey.shade300,
                                                    borderRadius: BorderRadius.circular(3),
                                                  ),
                                                  child: Text(
                                                    '#${_menuVideo?.id ?? _kiosk?.menuId ?? 0}',
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      color: Colors.grey.shade700,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(width: 6),
                                                Expanded(
                                                  child: Text(
                                                    _menuVideo?.title ?? _menuFilename ?? '메뉴 파일',
                                                    style: const TextStyle(
                                                      fontSize: 14,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            if (_menuVideo?.description != null) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                _menuVideo!.description!,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey.shade600,
                                                ),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                            if (_menuVideo?.fileSizeDisplay != null) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                _menuVideo!.fileSizeDisplay,
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  color: Colors.grey.shade500,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                  ),

                                  // File size (landscape only)
                                  if (isLandscape) ...[
                                    const SizedBox(width: 8),
                                    SizedBox(
                                      width: 60,
                                      child: Text(
                                        _menuVideo?.fileSizeDisplay ?? '',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.grey.shade600,
                                        ),
                                        textAlign: TextAlign.right,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(width: 8),

                                  // Download status (same as videos)
                                  SizedBox(
                                    width: isLandscape ? 120 : 70,
                                    child: _menuDownloaded
                                        ? isLandscape
                                          ? Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                const Icon(
                                                  Icons.check_circle,
                                                  color: Colors.green,
                                                  size: 16,
                                                ),
                                                const SizedBox(width: 4),
                                                const Text(
                                                  '완료',
                                                  style: TextStyle(
                                                    color: Colors.green,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ],
                                            )
                                          : const Icon(
                                              Icons.check_circle,
                                              color: Colors.green,
                                              size: 24,
                                            )
                                        : isLandscape
                                          ? Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Icon(
                                                  Icons.pending,
                                                  color: Colors.grey.shade600,
                                                  size: 16,
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  '대기',
                                                  style: TextStyle(
                                                    color: Colors.grey.shade600,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ],
                                            )
                                          : Icon(
                                              Icons.pending,
                                              color: Colors.grey.shade600,
                                              size: 24,
                                            ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }

                        // Video items (adjust index if menu card is shown)
                        final videoIndex = _hasMenu ? index - 1 : index;
                        final video = _videos[videoIndex];
                        final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
                        final thumbnailSize = isLandscape ? 60.0 : 48.0;

                        return Card(
                          margin: EdgeInsets.only(bottom: isLandscape ? 12 : 8),
                          child: Padding(
                            padding: EdgeInsets.all(isLandscape ? 12 : 8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // 썸네일
                                GestureDetector(
                                  onTap: () async {
                                    print('[VIDEO LIST] Thumbnail tapped for video: ${video.id}');
                                    print('[VIDEO LIST] Video status: ${video.downloadStatus}');
                                    print('[VIDEO LIST] Video mediaType: ${video.mediaType}');
                                    print('[VIDEO LIST] Video localPath: ${video.localPath}');

                                    // Only VIDEO mediaType files can be played
                                    if (video.mediaType != 'VIDEO') {
                                      print('[VIDEO LIST] Non-video file tapped: ${video.mediaType}');
                                      String fileTypeMessage = '이미지 파일';
                                      if (video.mediaType == 'DOCUMENT') {
                                        fileTypeMessage = '문서 파일';
                                      } else if (video.mediaType == 'AUDIO') {
                                        fileTypeMessage = '오디오 파일';
                                      }
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('$fileTypeMessage은 재생할 수 없습니다'),
                                          duration: const Duration(seconds: 2),
                                        ),
                                      );
                                      return;
                                    }

                                    // 다운로드 완료된 동영상만 재생 가능
                                    if (video.downloadStatus == 'completed' && video.localPath != null) {
                                      print('[VIDEO LIST] Opening video player...');
                                      final config = widget.storageService.getConfig();

                                      // Convert Android path to actual Windows path if needed
                                      String actualPath = await _downloadService.getActualFilePath(video.localPath!);
                                      print('[VIDEO LIST] Original path: ${video.localPath}');
                                      print('[VIDEO LIST] Actual path: $actualPath');

                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) => VideoPlayerScreen(
                                            videoPath: actualPath,
                                            videoTitle: video.title,
                                            downloadPath: config?.downloadPath,
                                            kioskId: config?.kioskId,
                                            menuFilename: _kiosk?.menuFilename,
                                          ),
                                        ),
                                      );
                                    } else if (video.downloadStatus == 'pending' || video.downloadStatus == 'failed') {
                                      print('[VIDEO LIST] Video not downloaded yet');
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('동영상을 먼저 다운로드해주세요'),
                                          duration: Duration(seconds: 2),
                                        ),
                                      );
                                    } else if (video.downloadStatus == 'downloading') {
                                      print('[VIDEO LIST] Video is downloading');
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('동영상 다운로드 중입니다'),
                                          duration: Duration(seconds: 2),
                                        ),
                                      );
                                    } else {
                                      print('[VIDEO LIST] Unexpected video status: ${video.downloadStatus}, localPath: ${video.localPath}');
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('재생할 수 없습니다. 상태: ${video.downloadStatus}'),
                                          duration: const Duration(seconds: 2),
                                        ),
                                      );
                                    }
                                  },
                                  child: Container(
                                    width: thumbnailSize,
                                    height: thumbnailSize,
                                    decoration: BoxDecoration(
                                      color: Colors.grey.shade200,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Stack(
                                      children: [
                                        // 썸네일 이미지 또는 아이콘
                                        video.mediaType == 'DOCUMENT'
                                            ? Container(
                                                width: thumbnailSize,
                                                height: thumbnailSize,
                                                decoration: BoxDecoration(
                                                  color: Colors.amber.shade100,
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Icon(
                                                  Icons.restaurant_menu,
                                                  size: isLandscape ? 28 : 24,
                                                  color: Colors.amber.shade800,
                                                ),
                                              )
                                            : video.mediaType == 'IMAGE'
                                                ? Container(
                                                    width: thumbnailSize,
                                                    height: thumbnailSize,
                                                    decoration: BoxDecoration(
                                                      color: Colors.blue.shade50,
                                                      borderRadius: BorderRadius.circular(6),
                                                    ),
                                                    child: video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty
                                                        ? ClipRRect(
                                                            borderRadius: BorderRadius.circular(6),
                                                            child: Image.network(
                                                              video.thumbnailUrl!,
                                                              fit: BoxFit.cover,
                                                              width: thumbnailSize,
                                                              height: thumbnailSize,
                                                              errorBuilder: (context, error, stackTrace) {
                                                                return Icon(
                                                                  Icons.image,
                                                                  size: isLandscape ? 28 : 24,
                                                                  color: Colors.blue.shade600,
                                                                );
                                                              },
                                                            ),
                                                          )
                                                        : Icon(
                                                            Icons.image,
                                                            size: isLandscape ? 28 : 24,
                                                            color: Colors.blue.shade600,
                                                          ),
                                                  )
                                                : video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty
                                                    ? ClipRRect(
                                                        borderRadius: BorderRadius.circular(6),
                                                        child: Image.network(
                                                          video.thumbnailUrl!,
                                                          fit: BoxFit.cover,
                                                          width: thumbnailSize,
                                                          height: thumbnailSize,
                                                          errorBuilder: (context, error, stackTrace) {
                                                            return Icon(
                                                              Icons.videocam,
                                                              size: isLandscape ? 28 : 24,
                                                              color: Colors.grey.shade600,
                                                            );
                                                          },
                                                        ),
                                                      )
                                                    : Icon(
                                                        Icons.videocam,
                                                        size: isLandscape ? 28 : 24,
                                                        color: Colors.grey.shade600,
                                                      ),
                                        // 재생 아이콘 오버레이 (다운로드 완료된 VIDEO만)
                                        if (video.downloadStatus == 'completed' && video.mediaType == 'VIDEO')
                                          Center(
                                            child: Container(
                                              decoration: BoxDecoration(
                                                color: Colors.black54,
                                                shape: BoxShape.circle,
                                              ),
                                              padding: const EdgeInsets.all(8),
                                              child: Icon(
                                                Icons.play_arrow,
                                                color: Colors.white,
                                                size: isLandscape ? 20 : 16,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                                SizedBox(width: isLandscape ? 12 : 8),

                                // 제목과 설명
                                Expanded(
                                  child: isLandscape
                                    ? Row(
                                        children: [
                                          // 영상 ID와 메뉴 배지
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 6,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: Colors.grey.shade300,
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  '#${video.id}',
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    color: Colors.grey.shade700,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ),
                                              // 메뉴 배지 (menuId가 있는 경우)
                                              if (video.menuId != null && video.menuId!.isNotEmpty) ...[
                                                const SizedBox(height: 2),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 4,
                                                    vertical: 1,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: Colors.amber.shade100,
                                                    borderRadius: BorderRadius.circular(3),
                                                    border: Border.all(
                                                      color: Colors.amber.shade600,
                                                      width: 0.5,
                                                    ),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(
                                                        Icons.restaurant_menu,
                                                        size: 8,
                                                        color: Colors.amber.shade800,
                                                      ),
                                                      const SizedBox(width: 2),
                                                      Text(
                                                        '메뉴',
                                                        style: TextStyle(
                                                          fontSize: 8,
                                                          color: Colors.amber.shade900,
                                                          fontWeight: FontWeight.w600,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(width: 8),
                                          // 제목
                                          Flexible(
                                            flex: 2,
                                            child: Text(
                                              video.title,
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          if (video.description != null) ...[
                                            const SizedBox(width: 12),
                                            // 설명
                                            Flexible(
                                              flex: 3,
                                              child: Text(
                                                video.description!,
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: Colors.grey.shade600,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ],
                                      )
                                    : Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          // 영상 ID와 제목
                                          Row(
                                            children: [
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(
                                                      horizontal: 5,
                                                      vertical: 2,
                                                    ),
                                                    decoration: BoxDecoration(
                                                      color: Colors.grey.shade300,
                                                      borderRadius: BorderRadius.circular(3),
                                                    ),
                                                    child: Text(
                                                      '#${video.id}',
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        color: Colors.grey.shade700,
                                                        fontWeight: FontWeight.w600,
                                                      ),
                                                    ),
                                                  ),
                                                  // 메뉴 배지 (menuId가 있는 경우)
                                                  if (video.menuId != null && video.menuId!.isNotEmpty) ...[
                                                    const SizedBox(height: 2),
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(
                                                        horizontal: 3,
                                                        vertical: 1,
                                                      ),
                                                      decoration: BoxDecoration(
                                                        color: Colors.amber.shade100,
                                                        borderRadius: BorderRadius.circular(2),
                                                        border: Border.all(
                                                          color: Colors.amber.shade600,
                                                          width: 0.5,
                                                        ),
                                                      ),
                                                      child: Row(
                                                        mainAxisSize: MainAxisSize.min,
                                                        children: [
                                                          Icon(
                                                            Icons.restaurant_menu,
                                                            size: 7,
                                                            color: Colors.amber.shade800,
                                                          ),
                                                          const SizedBox(width: 2),
                                                          Text(
                                                            '메뉴',
                                                            style: TextStyle(
                                                              fontSize: 7,
                                                              color: Colors.amber.shade900,
                                                              fontWeight: FontWeight.w600,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  video.title,
                                                  style: const TextStyle(
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ),
                                          if (video.description != null) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              video.description!,
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey.shade600,
                                              ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                          const SizedBox(height: 4),
                                          Text(
                                            video.fileSizeDisplay,
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: Colors.grey.shade500,
                                            ),
                                          ),
                                        ],
                                      ),
                                ),

                                // 가로 모드일 때만 파일 크기 표시
                                if (isLandscape) ...[
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    width: 60,
                                    child: Text(
                                      video.fileSizeDisplay,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade600,
                                      ),
                                      textAlign: TextAlign.right,
                                    ),
                                  ),
                                ],
                                const SizedBox(width: 8),

                                // 다운로드 상태 및 버튼
                                SizedBox(
                                  width: isLandscape ? 120 : 70,
                                  child: video.downloadStatus == 'downloading'
                                      ? Column(
                                          crossAxisAlignment: CrossAxisAlignment.stretch,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            LinearProgressIndicator(
                                              value: video.downloadProgress,
                                            ),
                                            if (isLandscape) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                '${(video.downloadProgress * 100).toInt()}%',
                                                textAlign: TextAlign.center,
                                                style: const TextStyle(fontSize: 11),
                                              ),
                                            ],
                                          ],
                                        )
                                      : video.downloadStatus == 'completed'
                                          ? isLandscape
                                            ? Row(
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  const Icon(
                                                    Icons.check_circle,
                                                    color: Colors.green,
                                                    size: 16,
                                                  ),
                                                  const SizedBox(width: 4),
                                                  const Text(
                                                    '완료',
                                                    style: TextStyle(
                                                      color: Colors.green,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
                                              )
                                            : const Icon(
                                                Icons.check_circle,
                                                color: Colors.green,
                                                size: 24,
                                              )
                                          : video.downloadStatus == 'failed'
                                              ? isLandscape
                                                ? ElevatedButton.icon(
                                                    onPressed: () => _downloadVideo(video),
                                                    icon: const Icon(Icons.refresh, size: 16),
                                                    label: const Text('재시도', style: TextStyle(fontSize: 12)),
                                                    style: ElevatedButton.styleFrom(
                                                      backgroundColor: Colors.orange,
                                                      padding: const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 6,
                                                      ),
                                                    ),
                                                  )
                                                : IconButton(
                                                    onPressed: () => _downloadVideo(video),
                                                    icon: const Icon(Icons.refresh),
                                                    color: Colors.orange,
                                                    iconSize: 28,
                                                    padding: EdgeInsets.zero,
                                                    constraints: const BoxConstraints(),
                                                  )
                                              : isLandscape
                                                ? ElevatedButton.icon(
                                                    onPressed: () => _downloadVideo(video),
                                                    icon: const Icon(Icons.download, size: 16),
                                                    label: const Text('다운', style: TextStyle(fontSize: 12)),
                                                    style: ElevatedButton.styleFrom(
                                                      backgroundColor: Colors.blue,
                                                      foregroundColor: Colors.white,
                                                      padding: const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 6,
                                                      ),
                                                    ),
                                                  )
                                                : IconButton(
                                                    onPressed: () => _downloadVideo(video),
                                                    icon: const Icon(Icons.download),
                                                    color: Colors.blue,
                                                    iconSize: 28,
                                                    padding: EdgeInsets.zero,
                                                    constraints: const BoxConstraints(),
                                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
      floatingActionButton: FloatingActionButton.extended(
          onPressed: () async {
            // Prevent duplicate navigation
            if (_isNavigating) return;

            // Get only VIDEO files with local paths (exclude IMAGE, DOCUMENT, and menu items)
            final availableVideos = _videos
                .where((v) => v.localPath != null && v.mediaType == 'VIDEO' && (v.menuId == null || v.menuId!.isEmpty))
                .toList();

            if (availableVideos.isEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('다운로드된 영상이 없습니다. 영상을 먼저 다운로드해주세요.'),
                  backgroundColor: Colors.orange,
                ),
              );
              return;
            }

            // Set navigation flag
            setState(() {
              _isNavigating = true;
            });

            try {
              // Enter auto kiosk screen (idle mode -> kiosk mode)
              if (mounted) {
                final config = widget.storageService.getConfig();

                // Use camera detection for person detection (all platforms)
                final detectionMode = DetectionMode.camera;

                print('[VIDEO LIST] Using detection mode: $detectionMode for platform: $defaultTargetPlatform');

                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AutoKioskScreen(
                      videos: availableVideos,
                      downloadPath: config?.downloadPath,
                      kioskId: config?.kioskId,
                      menuFilename: _kiosk?.menuFilename,
                      detectionMode: detectionMode,
                    ),
                  ),
                );
              }
            } finally {
              // Clear navigation flag
              if (mounted) {
                setState(() {
                  _isNavigating = false;
                });
              }
            }
          },
          icon: const Icon(Icons.coffee),
          label: const Text('커피 키오스크'),
          backgroundColor: Colors.brown,
        ),
    );
  }
}
