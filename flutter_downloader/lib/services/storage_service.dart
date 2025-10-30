import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../models/kiosk_config.dart';

class StorageService {
  static const String _keyUser = 'user';
  static const String _keyConfig = 'kiosk_config';
  static const String _keyToken = 'auth_token';
  static const String _keyLastServer = 'last_server';
  static const String _keyCustomServerUrl = 'custom_server_url';

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secureStorage;

  StorageService(this._prefs, this._secureStorage);

  // Initialize storage service
  static Future<StorageService> init() async {
    final prefs = await SharedPreferences.getInstance();
    const secureStorage = FlutterSecureStorage();
    return StorageService(prefs, secureStorage);
  }

  // User management
  Future<void> saveUser(User user) async {
    final json = jsonEncode(user.toJson());
    await _prefs.setString(_keyUser, json);
  }

  User? getUser() {
    final json = _prefs.getString(_keyUser);
    if (json == null) return null;
    return User.fromJson(jsonDecode(json));
  }

  Future<void> deleteUser() async {
    await _prefs.remove(_keyUser);
  }

  // Token management (secure storage)
  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _keyToken, value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: _keyToken);
  }

  Future<void> deleteToken() async {
    await _secureStorage.delete(key: _keyToken);
  }

  // Config management
  Future<void> saveConfig(KioskConfig config) async {
    final json = jsonEncode(config.toJson());
    await _prefs.setString(_keyConfig, json);
  }

  KioskConfig? getConfig() {
    final json = _prefs.getString(_keyConfig);
    if (json == null) return null;
    return KioskConfig.fromJson(jsonDecode(json));
  }

  Future<void> deleteConfig() async {
    await _prefs.remove(_keyConfig);
  }

  // Update last sync time
  Future<void> updateLastSyncTime(DateTime time) async {
    final config = getConfig();
    if (config != null) {
      await saveConfig(config.copyWith(lastSyncTime: time));
    }
  }

  // Clear all data
  Future<void> clearAll() async {
    await _prefs.clear();
    await _secureStorage.deleteAll();
  }

  // Check if user is logged in
  bool isLoggedIn() {
    return getUser() != null;
  }

  // Check if config is set
  bool isConfigured() {
    final config = getConfig();
    return config != null && config.isValid;
  }

  // Server selection management
  Future<void> saveLastServer(String serverValue) async {
    await _prefs.setString(_keyLastServer, serverValue);
  }

  String? getLastServer() {
    return _prefs.getString(_keyLastServer);
  }

  Future<void> saveCustomServerUrl(String url) async {
    await _prefs.setString(_keyCustomServerUrl, url);
  }

  String? getCustomServerUrl() {
    return _prefs.getString(_keyCustomServerUrl);
  }
}
