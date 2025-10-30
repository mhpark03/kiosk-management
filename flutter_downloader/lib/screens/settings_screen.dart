import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/kiosk_config.dart';
import 'video_list_screen.dart';

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

  @override
  void initState() {
    super.initState();
    _loadConfig();
    _setDefaultDownloadPath();
  }

  Future<void> _setDefaultDownloadPath() async {
    // Set default download path if not already set
    if (_downloadPathController.text.isEmpty) {
      try {
        final directory = await getDownloadsDirectory();
        if (directory != null) {
          setState(() {
            _downloadPathController.text = directory.path;
          });
        } else {
          // Fallback for Windows
          final userProfile = Platform.environment['USERPROFILE'];
          if (userProfile != null) {
            setState(() {
              _downloadPathController.text = '$userProfile\\Downloads';
            });
          }
        }
      } catch (e) {
        // Ignore errors, user can select manually
      }
    }
  }

  void _loadConfig() {
    final config = widget.storageService.getConfig();
    if (config != null) {
      setState(() {
        _kioskIdController.text = config.kioskId;
        _posIdController.text = config.posId ?? '';
        _downloadPathController.text = config.downloadPath;
        _autoSync = config.autoSync;
        _syncIntervalHours = config.syncIntervalHours;
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
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Use current API service base URL (set during login)
      final serverUrl = widget.apiService.baseUrl;

      final config = KioskConfig(
        serverUrl: serverUrl,
        kioskId: _kioskIdController.text.trim(),
        posId: _posIdController.text.trim(),
        downloadPath: _downloadPathController.text.trim(),
        autoSync: _autoSync,
        syncIntervalHours: _syncIntervalHours,
      );

      // Verify kiosk exists
      await widget.apiService.getKiosk(config.kioskId);

      // Save config
      await widget.storageService.saveConfig(config);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('설정이 저장되었습니다')),
        );

        // Navigate to video list
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
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('설정'),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await widget.storageService.clearAll();
              if (mounted) {
                Navigator.of(context).pushReplacementNamed('/');
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
              ElevatedButton(
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
                    : const Text(
                        '설정 저장',
                        style: TextStyle(fontSize: 16),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
