import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/user.dart';
import '../models/kiosk_config.dart';
import 'settings_screen.dart';
import 'video_list_screen.dart';

class LoginScreen extends StatefulWidget {
  final ApiService apiService;
  final StorageService storageService;

  const LoginScreen({
    super.key,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  String _selectedServer = ServerPresets.awsDev;
  final _customServerController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadLastServerSelection();
  }

  void _loadLastServerSelection() {
    final lastServer = widget.storageService.getLastServer();
    final customUrl = widget.storageService.getCustomServerUrl();

    if (lastServer != null) {
      // Validate that the saved server is in the dropdown options
      final validServers = [ServerPresets.awsDev, ServerPresets.local, 'custom'];

      setState(() {
        // If saved server is not in dropdown, use local as default
        _selectedServer = validServers.contains(lastServer) ? lastServer : ServerPresets.local;
        if (_selectedServer == 'custom' && customUrl != null) {
          _customServerController.text = customUrl;
        }
      });
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _customServerController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Check previous server URL from saved config
      final previousConfig = widget.storageService.getConfig();
      final previousServerUrl = previousConfig?.serverUrl;

      // Set server URL before login
      String serverUrl = _selectedServer;
      if (_selectedServer == 'custom') {
        serverUrl = _customServerController.text.trim();
        if (serverUrl.isEmpty) {
          throw Exception('서버 URL을 입력하세요');
        }
      }
      widget.apiService.setBaseUrl(serverUrl);

      final user = await widget.apiService.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      // Save user and token
      await widget.storageService.saveUser(user);
      if (user.token != null) {
        await widget.storageService.saveToken(user.token!);
      }

      // Check if server has changed
      if (previousServerUrl != null && previousServerUrl != serverUrl) {
        // Server changed - delete existing config to disconnect WebSocket
        print('Server changed from $previousServerUrl to $serverUrl');
        print('Deleting existing configuration...');
        await widget.storageService.deleteConfig();
      }

      // Record login event if config exists (kiosk is already configured)
      final config = widget.storageService.getConfig();
      if (config != null) {
        try {
          await widget.apiService.recordEvent(
            config.kioskId,
            'USER_LOGIN',
            '사용자 로그인: ${user.email}',
            metadata: '{"userEmail": "${user.email}", "userName": "${user.name}", "role": "${user.role}"}',
          );
        } catch (e) {
          print('[LOGIN EVENT] Failed to record login event: $e');
        }
      }

      if (mounted) {
        // Navigate to settings screen
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => SettingsScreen(
              apiService: widget.apiService,
              storageService: widget.storageService,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _skipLogin() {
    // Navigate to video list screen if config exists
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => VideoListScreen(
          apiService: widget.apiService,
          storageService: widget.storageService,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(isLandscape ? 12.0 : 24.0),
          child: Card(
            elevation: 4,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: EdgeInsets.all(isLandscape ? 16.0 : 32.0),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.login,
                      size: isLandscape ? 40 : 64,
                      color: Colors.blue,
                    ),
                    SizedBox(height: isLandscape ? 8 : 24),
                    Text(
                      '키오스크 다운로더',
                      style: TextStyle(
                        fontSize: isLandscape ? 20 : 28,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: isLandscape ? 4 : 8),
                    Text(
                      '로그인',
                      style: TextStyle(
                        fontSize: isLandscape ? 14 : 18,
                        color: Colors.grey,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: isLandscape ? 12 : 32),
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
                    DropdownButtonFormField<String>(
                      value: _selectedServer,
                      decoration: const InputDecoration(
                        labelText: '서버 선택',
                        prefixIcon: Icon(Icons.dns),
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: ServerPresets.awsDev,
                          child: Text('AWS 개발 서버'),
                        ),
                        DropdownMenuItem(
                          value: ServerPresets.local,
                          child: Text('로컬 서버'),
                        ),
                        DropdownMenuItem(
                          value: 'custom',
                          child: Text('직접 입력'),
                        ),
                      ],
                      onChanged: _isLoading ? null : (value) async {
                        setState(() {
                          _selectedServer = value!;
                        });
                        // Save server selection
                        await widget.storageService.saveLastServer(value!);
                      },
                    ),
                    if (_selectedServer == 'custom') ...[
                      SizedBox(height: isLandscape ? 8 : 16),
                      TextFormField(
                        controller: _customServerController,
                        decoration: const InputDecoration(
                          labelText: '서버 URL',
                          hintText: 'http://example.com/api',
                          prefixIcon: Icon(Icons.link),
                          border: OutlineInputBorder(),
                        ),
                        enabled: !_isLoading,
                        onChanged: (value) async {
                          // Save custom server URL
                          if (value.isNotEmpty) {
                            await widget.storageService.saveCustomServerUrl(value);
                          }
                        },
                        validator: (value) {
                          if (_selectedServer == 'custom' &&
                              (value == null || value.isEmpty)) {
                            return '서버 URL을 입력하세요';
                          }
                          return null;
                        },
                      ),
                    ],
                    SizedBox(height: isLandscape ? 8 : 16),
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: '이메일',
                        prefixIcon: Icon(Icons.email),
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.emailAddress,
                      enabled: !_isLoading,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return '이메일을 입력하세요';
                        }
                        return null;
                      },
                    ),
                    SizedBox(height: isLandscape ? 8 : 16),
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(
                        labelText: '비밀번호',
                        prefixIcon: Icon(Icons.lock),
                        border: OutlineInputBorder(),
                      ),
                      obscureText: true,
                      enabled: !_isLoading,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return '비밀번호를 입력하세요';
                        }
                        return null;
                      },
                    ),
                    SizedBox(height: isLandscape ? 12 : 24),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _login,
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
                              '로그인',
                              style: TextStyle(fontSize: 16),
                            ),
                    ),
                    SizedBox(height: isLandscape ? 8 : 12),
                    OutlinedButton(
                      onPressed: (_isLoading || !widget.storageService.isConfigured())
                          ? null
                          : _skipLogin,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        foregroundColor: Colors.blue,
                      ),
                      child: const Text(
                        '나중에 (로그인 없이 실행)',
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
