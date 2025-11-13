import 'package:dio/dio.dart';
import '../models/user.dart';
import '../models/video.dart';
import '../models/kiosk.dart';
import '../utils/device_info_util.dart';
import 'event_logger.dart';

class ApiService {
  late final Dio _dio;
  String? _authToken;
  String _baseUrl;
  final EventLogger _eventLogger = EventLogger();

  // Kiosk authentication headers (for unattended operation)
  String? _kioskPosId;
  String? _kioskId;
  int? _kioskNo;

  ApiService({required String baseUrl}) : _baseUrl = baseUrl {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add interceptor for logging, token, and kiosk headers
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          // Add JWT token if available (for user authentication)
          if (_authToken != null) {
            options.headers['Authorization'] = 'Bearer $_authToken';
          }

          // Add kiosk headers for kiosk authentication (always included)
          // This allows the app to work without user login
          if (_kioskPosId != null && _kioskId != null && _kioskNo != null) {
            options.headers['X-Kiosk-PosId'] = _kioskPosId;
            options.headers['X-Kiosk-Id'] = _kioskId;
            options.headers['X-Kiosk-No'] = _kioskNo.toString();
          }

          // Add device information headers (always included)
          options.headers['X-Device-OS'] = DeviceInfoUtil.getOsType();
          options.headers['X-Device-Version'] = DeviceInfoUtil.getOsVersion();
          options.headers['X-Device-Name'] = DeviceInfoUtil.getDeviceName();

          return handler.next(options);
        },
        onError: (error, handler) {
          print('API Error: ${error.message}');
          return handler.next(error);
        },
      ),
    );
  }

  void setBaseUrl(String url) {
    _baseUrl = url;
    _dio.options.baseUrl = url;
  }

  String get baseUrl => _baseUrl;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  void setKioskAuth(String? posId, String? kioskId, int? kioskNo) {
    _kioskPosId = posId;
    _kioskId = kioskId;
    _kioskNo = kioskNo;
    print('[ApiService] Kiosk auth set: posId=$posId, kioskId=$kioskId, kioskNo=$kioskNo');
  }

  // Login
  Future<User> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
          'appType': 'KIOSK',  // Identify as kiosk app for separate token management
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        // AuthResponse: token, type, email, displayName, role
        final user = User(
          id: 0, // AuthResponse doesn't include id
          email: data['email'] as String,
          name: data['displayName'] as String,
          phoneNumber: null,
          role: data['role'] as String,
          status: 'ACTIVE', // Default status
          token: data['token'] as String,
        );
        setAuthToken(user.token!);

        // Log USER_LOGIN event
        await _eventLogger.logEvent(
          eventType: 'USER_LOGIN',
          message: '사용자 로그인 성공',
          metadata: 'email=${user.email}, role=${user.role}',
        );

        return user;
      } else {
        throw Exception('Login failed: ${response.statusCode}');
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw Exception('이메일 또는 비밀번호가 올바르지 않습니다');
      } else if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      throw Exception('로그인 중 오류가 발생했습니다: $e');
    }
  }

  // Get kiosk info by ID
  Future<Kiosk> getKiosk(String kioskId) async {
    try {
      final response = await _dio.get('/kiosks/kioskid/$kioskId');

      if (response.statusCode == 200) {
        return Kiosk.fromJson(response.data);
      } else {
        throw Exception('Kiosk not found: ${response.statusCode}');
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        throw Exception('키오스크를 찾을 수 없습니다');
      } else if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      throw Exception('키오스크 정보 조회 중 오류가 발생했습니다: $e');
    }
  }

  // Get videos assigned to kiosk
  Future<List<Video>> getKioskVideos(String kioskId) async {
    try {
      print('[API] Fetching videos for kioskId: $kioskId');

      // Log SYNC_STARTED event
      await _eventLogger.logEvent(
        eventType: 'SYNC_STARTED',
        message: '영상 동기화 시작',
      );

      final response = await _dio.get('/kiosks/by-kioskid/$kioskId/videos-with-status');

      print('[API] Response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final List<dynamic> videosList = response.data as List<dynamic>;
        print('[API] Received ${videosList.length} videos');
        final videos = videosList.map((json) => Video.fromJson(json)).toList();

        // Log SYNC_COMPLETED event
        await _eventLogger.logEvent(
          eventType: 'SYNC_COMPLETED',
          message: '영상 파일 ${videos.length} 개 동기완료',
          metadata: '{"videoCount": ${videos.length}}',
        );

        return videos;
      } else {
        throw Exception('Failed to get videos: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('[API] DioException: ${e.message}');
      if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      print('[API] Exception: $e');
      throw Exception('영상 목록 조회 중 오류가 발생했습니다: $e');
    }
  }

  // Get video info by ID
  Future<Video> getVideoById(int videoId) async {
    try {
      print('[API] Fetching video info for video ID: $videoId');
      final response = await _dio.get('/videos/$videoId');

      print('[API] Video info response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        return Video.fromJson(response.data);
      } else {
        throw Exception('Failed to get video info: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('[API] DioException getting video info for video $videoId:');
      print('  Status code: ${e.response?.statusCode}');
      print('  Response data: ${e.response?.data}');
      rethrow;
    } catch (e) {
      print('[API] Unexpected error getting video info for video $videoId: $e');
      rethrow;
    }
  }

  // Get download URL for video
  Future<String> getVideoDownloadUrl(int videoId) async {
    try {
      print('[API] Requesting download URL for video ID: $videoId');
      final response = await _dio.get('/videos/$videoId/download-url');

      print('[API] Download URL response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        final downloadUrl = response.data['downloadUrl'] as String;
        print('[API] Download URL received: ${downloadUrl.substring(0, downloadUrl.length > 100 ? 100 : downloadUrl.length)}...');
        return downloadUrl;
      } else {
        throw Exception('Failed to get download URL: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('[API] DioException getting download URL for video $videoId:');
      print('  Status code: ${e.response?.statusCode}');
      print('  Response data: ${e.response?.data}');
      print('  Error message: ${e.message}');

      if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      print('[API] Exception getting download URL for video $videoId: $e');
      throw Exception('다운로드 URL 조회 중 오류가 발생했습니다: $e');
    }
  }

  // Connect kiosk and get session token (6 months validity, auto-renewed every 7 days)
  Future<Map<String, dynamic>> connectKiosk(String kioskId, String posId, int kioskNo) async {
    try {
      final response = await _dio.post(
        '/kiosks/$kioskId/connect',
        options: Options(
          headers: {
            'X-Kiosk-PosId': posId,
            'X-Kiosk-No': kioskNo.toString(),
          },
        ),
      );

      if (response.statusCode == 200) {
        // Response: { token, sessionVersion, expiresIn, renewalInterval, message }
        final data = response.data as Map<String, dynamic>;
        final token = data['token'] as String;
        final sessionVersion = data['sessionVersion'] as int;
        final expiresIn = data['expiresIn'] as int;
        final renewalInterval = data['renewalInterval'] as int?;

        print('[CONNECT] Kiosk connected successfully');
        print('[CONNECT] Session version: $sessionVersion');
        print('[CONNECT] Token expires in: ${expiresIn / 86400} days');
        print('[CONNECT] Renewal interval: ${renewalInterval != null ? renewalInterval / 86400 : 0} days');

        // Log KIOSK_CONNECTED event
        await _eventLogger.logEvent(
          eventType: 'KIOSK_CONNECTED',
          message: '키오스크 연결 성공 (세션 버전: $sessionVersion)',
          metadata: 'posId=$posId, kioskNo=$kioskNo, sessionVersion=$sessionVersion, expiresIn=${expiresIn ~/ 86400} days',
        );

        // Set the token to be used in Authorization header for future requests
        setAuthToken(token);

        return {
          'token': token,
          'sessionVersion': sessionVersion,
          'expiresIn': expiresIn,
          'renewalInterval': renewalInterval ?? (7 * 24 * 60 * 60), // Default 7 days
        };
      } else {
        throw Exception('Connection failed: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('[CONNECT] Failed to connect kiosk: ${e.message}');
      if (e.response?.statusCode == 401) {
        throw Exception('키오스크 인증 실패: 키오스크 정보를 확인해주세요');
      } else if (e.response?.data != null && e.response?.data['error'] != null) {
        throw Exception(e.response?.data['error']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      print('[CONNECT] Exception: $e');
      throw Exception('키오스크 연결 중 오류가 발생했습니다: $e');
    }
  }

  // Get kiosk authentication token for WebSocket
  Future<String> getKioskToken(String kioskId, String posId, int kioskNo) async {
    try {
      final response = await _dio.post(
        '/kiosk-auth/token',
        data: {
          'kioskId': kioskId,
          'posId': posId,
          'kioskNo': kioskNo,
        },
      );

      if (response.statusCode == 200 && response.data['accessToken'] != null) {
        return response.data['accessToken'] as String;
      } else {
        throw Exception('No access token in response');
      }
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('키오스크 토큰 발급 실패: ${e.message}');
      }
    } catch (e) {
      throw Exception('키오스크 토큰 발급 중 오류: $e');
    }
  }

  // Update kiosk configuration on server
  // Returns the new session token from the response (null if token renewal failed)
  Future<String?> updateKioskConfig(
    String kioskId,
    String downloadPath,
    String apiUrl,
    bool autoSync,
    int syncInterval,
  ) async {
    try {
      // Log CONFIG_SAVED event before updating
      await _eventLogger.logEvent(
        eventType: 'CONFIG_SAVED',
        message: '설정 저장 시작',
        metadata: 'autoSync=$autoSync, syncInterval=$syncInterval',
      );

      final response = await _dio.patch(
        '/kiosks/by-kioskid/$kioskId/config',
        data: {
          'downloadPath': downloadPath,
          'apiUrl': apiUrl,
          'autoSync': autoSync,
          'syncInterval': syncInterval,
        },
        options: Options(
          headers: {
            'X-Kiosk-Id': kioskId,
          },
        ),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to update config: ${response.statusCode}');
      }

      print('[CONFIG SYNC] Configuration synced to server successfully');

      // Log successful config save
      await _eventLogger.logEvent(
        eventType: 'CONFIG_SAVED',
        message: '설정 저장 완료',
        metadata: 'autoSync=$autoSync, syncInterval=$syncInterval',
      );

      // Extract and return the new session token if available
      final token = response.data['token'] as String?;
      if (token != null) {
        print('[CONFIG SYNC] Received new session token, sessionVersion: ${response.data['sessionVersion']}');
        // Automatically set the new token for future requests
        setAuthToken(token);
        return token;
      } else {
        print('[CONFIG SYNC] No token in response (token renewal may have failed)');
        return null;
      }
    } on DioException catch (e) {
      print('[CONFIG SYNC] Failed to sync configuration to server: ${e.message}');
      // Don't throw error, just log it (background operation)
      return null;
    } catch (e) {
      print('[CONFIG SYNC] Error syncing configuration to server: $e');
      // Don't throw error, just log it (background operation)
      return null;
    }
  }

  // Get kiosk configuration from server
  Future<Map<String, dynamic>> getKioskConfig(String kioskId) async {
    try {
      // Log CONFIG_READ event
      await _eventLogger.logEvent(
        eventType: 'CONFIG_READ',
        message: '설정 조회 시작',
      );

      final response = await _dio.get('/kiosks/by-kioskid/$kioskId/config');

      if (response.statusCode == 200) {
        final config = response.data as Map<String, dynamic>;

        // Log successful config read
        await _eventLogger.logEvent(
          eventType: 'CONFIG_READ',
          message: '설정 조회 완료',
          metadata: 'autoSync=${config['autoSync']}, syncInterval=${config['syncInterval']}',
        );

        return config;
      } else {
        throw Exception('Failed to get config: ${response.statusCode}');
      }
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('설정 조회 실패: ${e.message}');
      }
    } catch (e) {
      throw Exception('설정 조회 중 오류: $e');
    }
  }

  // Update video download status
  Future<void> updateVideoDownloadStatus(
    String kioskId,
    int videoId,
    String status,
  ) async {
    try {
      // Log appropriate event based on download status
      String eventType;
      String eventMessage;

      switch (status.toUpperCase()) {
        case 'IN_PROGRESS':
          eventType = 'DOWNLOAD_STARTED';
          eventMessage = '영상 다운로드 시작';
          break;
        case 'COMPLETED':
          eventType = 'DOWNLOAD_COMPLETED';
          eventMessage = '영상 다운로드 완료';
          break;
        case 'FAILED':
          eventType = 'DOWNLOAD_FAILED';
          eventMessage = '영상 다운로드 실패';
          break;
        default:
          eventType = 'DOWNLOAD_STATUS_UPDATE';
          eventMessage = '영상 다운로드 상태 업데이트';
      }

      await _eventLogger.logEvent(
        eventType: eventType,
        message: eventMessage,
        metadata: 'videoId=$videoId, status=$status',
      );

      final response = await _dio.patch(
        '/kiosks/by-kioskid/${Uri.encodeComponent(kioskId)}/videos/$videoId/status',
        queryParameters: {'status': status},
        options: Options(
          headers: {
            'X-Kiosk-Id': kioskId,
          },
        ),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to update download status: ${response.statusCode}');
      }

      print('[DOWNLOAD STATUS] Updated video $videoId status to $status');
    } on DioException catch (e) {
      print('[DOWNLOAD STATUS] Failed to update status: ${e.message}');
      // Don't throw error, just log it (background operation)
    } catch (e) {
      print('[DOWNLOAD STATUS] Error updating status: $e');
      // Don't throw error, just log it (background operation)
    }
  }

  // Update menu download status
  Future<void> updateMenuDownloadStatus(
    String kioskId,
    int menuId,
    String status,
  ) async {
    try {
      // Log appropriate event based on download status
      String eventType;
      String eventMessage;

      switch (status.toUpperCase()) {
        case 'IN_PROGRESS':
          eventType = 'DOWNLOAD_STARTED';
          eventMessage = '메뉴 다운로드 시작';
          break;
        case 'COMPLETED':
          eventType = 'DOWNLOAD_COMPLETED';
          eventMessage = '메뉴 다운로드 완료';
          break;
        case 'FAILED':
          eventType = 'DOWNLOAD_FAILED';
          eventMessage = '메뉴 다운로드 실패';
          break;
        default:
          eventType = 'DOWNLOAD_STATUS_UPDATE';
          eventMessage = '메뉴 다운로드 상태 업데이트';
      }

      await _eventLogger.logEvent(
        eventType: eventType,
        message: eventMessage,
        metadata: 'menuId=$menuId, status=$status',
      );

      final response = await _dio.patch(
        '/kiosks/by-kioskid/${Uri.encodeComponent(kioskId)}/menu/status',
        queryParameters: {
          'menuId': menuId.toString(),
          'status': status,
        },
        options: Options(
          headers: {
            'X-Kiosk-Id': kioskId,
          },
        ),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to update menu download status: ${response.statusCode}');
      }

      print('[MENU DOWNLOAD STATUS] Updated menu $menuId status to $status');
    } on DioException catch (e) {
      print('[MENU DOWNLOAD STATUS] Failed to update status: ${e.message}');
      // Don't throw error, just log it (background operation)
    } catch (e) {
      print('[MENU DOWNLOAD STATUS] Error updating status: $e');
      // Don't throw error, just log it (background operation)
    }
  }

  // Report kiosk status (heartbeat) - NO AUTH REQUIRED
  // This allows monitoring even when tokens are expired
  Future<void> reportKioskStatus({
    required String kioskId,
    required String appVersion,
    required String connectionStatus, // ONLINE, ERROR
    String? errorMessage,
    required bool isLoggedIn,
    required String osType,
    required String osVersion,
    required String deviceName,
  }) async {
    try {
      print('[HEARTBEAT] Sending status report for kiosk: $kioskId');

      final response = await _dio.post(
        '/kiosk-status/heartbeat',
        data: {
          'kioskId': kioskId,
          'appVersion': appVersion,
          'connectionStatus': connectionStatus,
          'errorMessage': errorMessage,
          'isLoggedIn': isLoggedIn,
          'osType': osType,
          'osVersion': osVersion,
          'deviceName': deviceName,
        },
        options: Options(
          // Don't use default authorization headers for this request
          headers: {
            'Content-Type': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200) {
        print('[HEARTBEAT] Status reported successfully');
      } else {
        print('[HEARTBEAT] Failed to report status: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('[HEARTBEAT] Network error reporting status: ${e.message}');
      // Don't throw error - heartbeat failure should not crash the app
    } catch (e) {
      print('[HEARTBEAT] Error reporting status: $e');
      // Don't throw error - heartbeat failure should not crash the app
    }
  }

  // Get menu download URL for kiosk
  Future<Map<String, dynamic>?> getMenuDownloadUrl(String kioskId) async {
    try {
      print('[API] Requesting menu download URL for kioskId: $kioskId');
      final response = await _dio.get('/kiosks/by-kioskid/$kioskId/menu/download-url');

      print('[API] Menu download URL response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;

        // Check if kiosk has menu assigned
        if (data['hasMenu'] == false) {
          print('[API] Kiosk has no menu assigned');
          return null;
        }

        print('[API] Menu download URL received for menu ID: ${data['menuId']}');
        return data;
      } else {
        throw Exception('Failed to get menu download URL: ${response.statusCode}');
      }
    } on DioException catch (e) {
      print('[API] DioException getting menu download URL for kiosk $kioskId:');
      print('  Status code: ${e.response?.statusCode}');
      print('  Response data: ${e.response?.data}');
      print('  Error message: ${e.message}');

      if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      print('[API] Exception getting menu download URL for kiosk $kioskId: $e');
      throw Exception('메뉴 다운로드 URL 조회 중 오류가 발생했습니다: $e');
    }
  }

  /// Refresh presigned URL for a specific video
  /// Returns new presigned URL with 60 minutes validity
  Future<Map<String, dynamic>> refreshVideoUrl(String kioskId, int videoId) async {
    try {
      print('[API] Refreshing presigned URL for video $videoId (kiosk: $kioskId)');

      final response = await _dio.get(
        '/api/kiosks/by-kioskid/$kioskId/videos/$videoId/refresh-url',
      );

      print('[API] Successfully refreshed presigned URL for video $videoId');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      print('[API] DioException refreshing presigned URL for video $videoId:');
      print('  Status code: ${e.response?.statusCode}');
      print('  Response data: ${e.response?.data}');
      print('  Error message: ${e.message}');

      if (e.response?.data != null && e.response?.data['error'] != null) {
        throw Exception(e.response?.data['error']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      print('[API] Exception refreshing presigned URL for video $videoId: $e');
      throw Exception('Presigned URL 갱신 중 오류가 발생했습니다: $e');
    }
  }

  /// Refresh presigned URLs for all videos assigned to a kiosk
  /// Returns updated list of videos with fresh presigned URLs (60 minutes validity)
  Future<Map<String, dynamic>> refreshAllVideoUrls(String kioskId) async {
    try {
      print('[API] Refreshing all presigned URLs for kiosk $kioskId');

      final response = await _dio.get(
        '/api/kiosks/by-kioskid/$kioskId/videos/refresh-all-urls',
      );

      print('[API] Successfully refreshed all presigned URLs for kiosk $kioskId');
      print('[API] Refreshed ${response.data['count']} videos');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      print('[API] DioException refreshing all presigned URLs:');
      print('  Status code: ${e.response?.statusCode}');
      print('  Response data: ${e.response?.data}');
      print('  Error message: ${e.message}');

      if (e.response?.data != null && e.response?.data['error'] != null) {
        throw Exception(e.response?.data['error']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      print('[API] Exception refreshing all presigned URLs: $e');
      throw Exception('Presigned URL 일괄 갱신 중 오류가 발생했습니다: $e');
    }
  }
}
