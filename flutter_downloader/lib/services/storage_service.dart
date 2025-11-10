import 'dart:convert';
import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../models/kiosk_config.dart';
import '../models/video.dart';

class StorageService {
  static const String _keyUser = 'user';
  static const String _keyConfig = 'kiosk_config';
  static const String _keyToken = 'auth_token';
  static const String _keyLastServer = 'last_server';
  static const String _keyCustomServerUrl = 'custom_server_url';
  static const String _keyCachedVideos = 'cached_videos'; // 오프라인 모드용 비디오 캐시

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

    // Save to SharedPreferences
    await _prefs.setString(_keyConfig, json);

    // Also save to file in download path for easy access
    try {
      final configFile = File('${config.downloadPath}/kiosk_config.json');
      await configFile.writeAsString(jsonEncode(config.toJson()));
      print('[CONFIG] Saved to file: ${configFile.path}');
    } catch (e) {
      print('[CONFIG] Failed to save config file: $e');
      // Don't throw error - SharedPreferences save already succeeded
    }
  }

  KioskConfig? getConfig() {
    // Try SharedPreferences first
    final json = _prefs.getString(_keyConfig);
    if (json != null) {
      return KioskConfig.fromJson(jsonDecode(json));
    }

    // If not in SharedPreferences, try to load from file
    // Look for kiosk_config.json in common locations
    print('[CONFIG] No config in SharedPreferences, checking files...');
    return null;
  }

  Future<void> deleteConfig() async {
    // Get config first to know where the file is
    final config = getConfig();

    // Delete from SharedPreferences
    await _prefs.remove(_keyConfig);

    // Delete file if config exists
    if (config != null) {
      try {
        final configFile = File('${config.downloadPath}/kiosk_config.json');
        if (await configFile.exists()) {
          await configFile.delete();
          print('[CONFIG] Deleted config file: ${configFile.path}');
        }
      } catch (e) {
        print('[CONFIG] Failed to delete config file: $e');
        // Don't throw error
      }
    }
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

  // Video cache management (for offline operation)
  Future<void> cacheVideos(List<Video> videos) async {
    try {
      final jsonList = videos.map((v) => v.toJson()).toList();
      final json = jsonEncode(jsonList);
      await _prefs.setString(_keyCachedVideos, json);
      print('[STORAGE] Cached ${videos.length} videos for offline use');
    } catch (e) {
      print('[STORAGE] Failed to cache videos: $e');
      // Don't throw - caching failure is not critical
    }
  }

  List<Video>? getCachedVideos() {
    try {
      final json = _prefs.getString(_keyCachedVideos);
      if (json == null) return null;

      final jsonList = jsonDecode(json) as List;
      final videos = jsonList.map((item) => Video.fromJson(item as Map<String, dynamic>)).toList();
      print('[STORAGE] Loaded ${videos.length} cached videos');
      return videos;
    } catch (e) {
      print('[STORAGE] Failed to load cached videos: $e');
      return null;
    }
  }

  Future<void> clearCachedVideos() async {
    await _prefs.remove(_keyCachedVideos);
    print('[STORAGE] Cleared cached videos');
  }
}
