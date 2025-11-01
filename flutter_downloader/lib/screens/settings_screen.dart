import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/kiosk_config.dart';
import 'video_list_screen.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  final ApiService apiService;
  final StorageService storageService;

  const SettingsScreen({
    super.key,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _kioskIdController = TextEditingController();
  final _posIdController = TextEditingController();
  final _downloadPathController = TextEditingController();

  bool _autoSync = true;  // Default to ON
  int _syncIntervalHours = 12;
  bool _isLoading = false;
  String? _errorMessage;
  bool _isLoggedIn = false;
  bool _hasExistingConfig = false;

  // Original values for change detection
  String _originalKioskId = '';
  String _originalPosId = '';
  String _originalDownloadPath = '';
  bool _originalAutoSync = true;
  int _originalSyncInterval = 12;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
    _loadConfig();
    _setDefaultDownloadPath();
  }

  void _checkLoginStatus() {
    setState(() {
      _isLoggedIn = widget.storageService.isLoggedIn();
    });
  }

  Future<void> _setDefaultDownloadPath() async {
    // Set default download path if not already set
    if (_downloadPathController.text.isEmpty) {
      String basePath = '';

      try {
        // Try getDownloadsDirectory first
        final directory = await getDownloadsDirectory();
        if (directory != null) {
          basePath = directory.path;
        }
      } catch (e) {
        // Ignore and try fallback
      }

      // Fallback for Windows
      if (basePath.isEmpty) {
        try {
          final userProfile = Platform.environment['USERPROFILE'];
          if (userProfile != null && userProfile.isNotEmpty) {
            basePath = '$userProfile\\Downloads';
          }
        } catch (e) {
          // Ignore
        }
      }

      // Final fallback
      if (basePath.isEmpty) {
        basePath = 'C:\\Downloads';
      }

      // Add KioskVideos subdirectory
      setState(() {
        _downloadPathController.text = '$basePath\\KioskVideos';
      });
    }
  }

  void _loadConfig() {
    final config = widget.storageService.getConfig();
    if (config != null) {
      setState(() {
        _hasExistingConfig = true;
        _kioskIdController.text = config.kioskId;
        _posIdController.text = config.posId ?? '';
        _downloadPathController.text = config.downloadPath;
        _autoSync = config.autoSync;
        _syncIntervalHours = config.syncIntervalHours;

        // Save original values for change detection
        _originalKioskId = config.kioskId;
        _originalPosId = config.posId ?? '';
        _originalDownloadPath = config.downloadPath;
        _originalAutoSync = config.autoSync;
        _originalSyncInterval = config.syncIntervalHours;
      });
    }
  }

  @override
  void dispose() {
    _kioskIdController.dispose();
    _posIdController.dispose();
    _downloadPathController.dispose();
    super.dispose();
  }

  Future<void> _pickDirectory() async {
    String? path = await FilePicker.platform.getDirectoryPath();
    if (path != null) {
      setState(() {
        _downloadPathController.text = path;
      });
    }
  }

  Future<void> _saveSettings() async {
    // Check login status
    if (!_isLoggedIn) {
      _showLoginRequiredDialog();
      return;
    }

    if (!_formKey.currentState!.validate()) return;

    // Check if anything changed
    if (_hasExistingConfig) {
      final kioskId = _kioskIdController.text.trim().padLeft(12, '0');
      final posId = _posIdController.text.trim().padLeft(8, '0');
      final downloadPath = _downloadPathController.text.trim();

      if (kioskId == _originalKioskId &&
          posId == _originalPosId &&
          downloadPath == _originalDownloadPath &&
          _autoSync == _originalAutoSync &&
          _syncIntervalHours == _originalSyncInterval) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('변경된 내용이 없습니다'),
            duration: Duration(seconds: 2),
          ),
        );
        return;
      }
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Use current API service base URL (set during login)
      final serverUrl = widget.apiService.baseUrl;

      // Validate download path
      final downloadPath = _downloadPathController.text.trim();
      if (downloadPath.isEmpty) {
        throw Exception('다운로드 경로가 설정되지 않았습니다');
      }

      // Pad kiosk ID to 12 digits and POS ID to 8 digits
      final kioskId = _kioskIdController.text.trim().padLeft(12, '0');
      final posId = _posIdController.text.trim().padLeft(8, '0');

      final config = KioskConfig(
        serverUrl: serverUrl,
        kioskId: kioskId,
        posId: posId,
        downloadPath: downloadPath,
        autoSync: _autoSync,
        syncIntervalHours: _syncIntervalHours,
      );

      // Verify kiosk exists
      await widget.apiService.getKiosk(config.kioskId);

      // Save config locally
      await widget.storageService.saveConfig(config);

      // Sync config to server (background operation, don't wait)
      widget.apiService.updateKioskConfig(
        config.kioskId,
        config.downloadPath,
        config.serverUrl,
        config.autoSync,
        config.syncIntervalHours,
      ).catchError((e) {
        print('[CONFIG SYNC] Failed to sync to server: $e');
        // Don't show error to user, this is a background operation
      });

      // Connect kiosk and renew session token after config change
      try {
        final kiosk = await widget.apiService.getKiosk(config.kioskId);
        if (kiosk.kioskNumber != null) {
          print('[SETTINGS] Calling /connect after config change...');
          await widget.apiService.connectKiosk(
            config.kioskId,
            posId,
            kiosk.kioskNumber!,
          );
          print('[SETTINGS] Token renewed after config change');
        }
      } catch (e) {
        print('[SETTINGS] Failed to renew token after config change: $e');
        // Don't show error to user, this is a background operation
      }

      // Update original values after successful save
      setState(() {
        _hasExistingConfig = true;
        _originalKioskId = kioskId;
        _originalPosId = posId;
        _originalDownloadPath = downloadPath;
        _originalAutoSync = _autoSync;
        _originalSyncInterval = _syncIntervalHours;
      });

      // Navigate to video list
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => VideoListScreen(
              apiService: widget.apiService,
              storageService: widget.storageService,
            ),
          ),
        );
      }
    } catch (e) {
      print('Settings save error: $e');
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        // 뒤로가기 시 항상 새로운 VideoListScreen으로 이동 (목록 초기화)
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => VideoListScreen(
              apiService: widget.apiService,
              storageService: widget.storageService,
            ),
          ),
        );
        return false; // 기본 뒤로가기 동작 방지
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('설정'),
          actions: [
          TextButton.icon(
            onPressed: () async {
              // 사용자만 로그아웃 (설정은 유지하여 무인 동작 가능)
              final config = widget.storageService.getConfig();
              final user = widget.storageService.getUser();

              await widget.storageService.deleteUser();
              await widget.storageService.deleteToken();
              widget.apiService.setAuthToken(null);

              // Record logout event if config exists
              if (config != null) {
                try {
                  await widget.apiService.recordEvent(
                    config.kioskId,
                    'USER_LOGOUT',
                    '사용자 로그아웃: ${user?.email ?? "unknown"}',
                    metadata: user != null
                        ? '{"userEmail": "${user.email}", "userName": "${user.name}"}'
                        : null,
                  );
                } catch (e) {
                  print('[LOGOUT EVENT] Failed to record logout event: $e');
                }
              }

              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('로그아웃되었습니다 (설정은 유지됨)')),
                );
              }
            },
            icon: const Icon(Icons.logout, color: Colors.white),
            label: const Text(
              '로그아웃',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    border: Border.all(color: Colors.red),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '키오스크 정보',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _kioskIdController,
                        decoration: const InputDecoration(
                          labelText: '키오스크 ID',
                          helperText: '12자리 키오스크 ID (예: 000000000001)',
                          border: OutlineInputBorder(),
                        ),
                        autocorrect: false,
                        enableSuggestions: false,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return '키오스크 ID를 입력하세요';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _posIdController,
                        decoration: const InputDecoration(
                          labelText: '매장 ID (POS ID)',
                          helperText: '8자리 매장 ID (예: 00000001)',
                          border: OutlineInputBorder(),
                        ),
                        autocorrect: false,
                        enableSuggestions: false,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return '매장 ID를 입력하세요';
                          }
                          return null;
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '다운로드 설정',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _downloadPathController,
                              decoration: const InputDecoration(
                                labelText: '다운로드 경로',
                                border: OutlineInputBorder(),
                              ),
                              readOnly: true,
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return '다운로드 경로를 선택하세요';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: _pickDirectory,
                            child: const Text('찾아보기'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SwitchListTile(
                        title: const Text('자동 동기화'),
                        subtitle: const Text('주기적으로 자동 영상 다운로드'),
                        value: _autoSync,
                        onChanged: (value) {
                          setState(() => _autoSync = value);
                        },
                      ),
                      if (_autoSync)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                          child: DropdownButtonFormField<int>(
                            value: _syncIntervalHours,
                            decoration: const InputDecoration(
                              labelText: '동기화 간격',
                              border: OutlineInputBorder(),
                            ),
                            items: [1, 3, 6, 12, 24]
                                .map((hours) => DropdownMenuItem(
                                      value: hours,
                                      child: Text('$hours시간'),
                                    ))
                                .toList(),
                            onChanged: (value) {
                              if (value != null) {
                                setState(() => _syncIntervalHours = value);
                              }
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _saveSettings,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor:
                                    AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : Text(
                              _hasExistingConfig ? '설정 수정' : '설정 저장',
                              style: const TextStyle(fontSize: 16),
                            ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 1,
                    child: OutlinedButton(
                      onPressed: _isLoading
                          ? null
                          : () async {
                        // Check login status
                        if (!_isLoggedIn) {
                          _showLoginRequiredDialog();
                          return;
                        }

                        // 확인 대화상자
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('설정 초기화 확인'),
                            content: const Text(
                              '모든 설정 값을 기본값으로 되돌립니다.\n계속하시겠습니까?',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('취소'),
                              ),
                              TextButton(
                                onPressed: () => Navigator.pop(context, true),
                                style: TextButton.styleFrom(
                                  foregroundColor: Colors.red,
                                ),
                                child: const Text('초기화'),
                              ),
                            ],
                          ),
                        );

                        if (confirm == true && mounted) {
                          _resetToDefaults();
                          }
                        },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        foregroundColor: Colors.red,
                      ),
                      child: const Text(
                        '설정 초기화',
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
    ); // WillPopScope 닫는 괄호
  }

  void _showLoginRequiredDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.lock, color: Colors.orange),
            SizedBox(width: 8),
            Text('로그인 필요'),
          ],
        ),
        content: const Text('설정을 변경하려면 로그인이 필요합니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _navigateToLogin();
            },
            child: const Text('로그인'),
          ),
        ],
      ),
    );
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
      setState(() {});
    }
  }

  void _resetToDefaults() async {
    // Delete saved configuration
    await widget.storageService.deleteConfig();

    // Get default download path
    String basePath = '';
    try {
      final directory = await getDownloadsDirectory();
      if (directory != null) {
        basePath = directory.path;
      }
    } catch (e) {
      // Fallback for Windows
      final userProfile = Platform.environment['USERPROFILE'];
      if (userProfile != null && userProfile.isNotEmpty) {
        basePath = '$userProfile\\Downloads';
      } else {
        basePath = 'C:\\Downloads';
      }
    }

    setState(() {
      // Reset form fields to defaults
      _kioskIdController.text = '';
      _posIdController.text = '';
      _downloadPathController.text = '$basePath\\KioskVideos';
      _autoSync = true;
      _syncIntervalHours = 12;

      // Reset original values
      _originalKioskId = '';
      _originalPosId = '';
      _originalDownloadPath = '$basePath\\KioskVideos';
      _originalAutoSync = true;
      _originalSyncInterval = 12;

      // Mark as no existing config
      _hasExistingConfig = false;
    });

    // Navigate to fresh video list screen to disconnect WebSocket and reset state
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => VideoListScreen(
            apiService: widget.apiService,
            storageService: widget.storageService,
          ),
        ),
      );
    }
  }
}
