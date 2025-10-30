import 'package:dio/dio.dart';
import '../models/user.dart';
import '../models/video.dart';
import '../models/kiosk.dart';

class ApiService {
  late final Dio _dio;
  String? _authToken;
  String _baseUrl;

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
      final response = await _dio.get('/kiosks/by-kioskid/$kioskId/videos-with-status');

      print('[API] Response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final List<dynamic> videosList = response.data as List<dynamic>;
        print('[API] Received ${videosList.length} videos');
        return videosList.map((json) => Video.fromJson(json)).toList();
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

  // Get download URL for video
  Future<String> getVideoDownloadUrl(int videoId) async {
    try {
      final response = await _dio.get('/videos/$videoId/download-url');

      if (response.statusCode == 200) {
        return response.data['downloadUrl'] as String;
      } else {
        throw Exception('Failed to get download URL: ${response.statusCode}');
      }
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data['message'] != null) {
        throw Exception(e.response?.data['message']);
      } else {
        throw Exception('서버 연결에 실패했습니다: ${e.message}');
      }
    } catch (e) {
      throw Exception('다운로드 URL 조회 중 오류가 발생했습니다: $e');
    }
  }

  // Record event
  Future<void> recordEvent(
    String kioskId,
    String eventType,
    String? details,
  ) async {
    try {
      await _dio.post(
        '/kiosk-events',
        data: {
          'kioskId': kioskId,
          'eventType': eventType,
          'details': details,
        },
      );
    } catch (e) {
      // Ignore event recording errors
      print('Failed to record event: $e');
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
  Future<void> updateKioskConfig(
    String kioskId,
    String downloadPath,
    String apiUrl,
    bool autoSync,
    int syncInterval,
  ) async {
    try {
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
    } on DioException catch (e) {
      print('[CONFIG SYNC] Failed to sync configuration to server: ${e.message}');
      // Don't throw error, just log it (background operation)
    } catch (e) {
      print('[CONFIG SYNC] Error syncing configuration to server: $e');
      // Don't throw error, just log it (background operation)
    }
  }

  // Get kiosk configuration from server
  Future<Map<String, dynamic>> getKioskConfig(String kioskId) async {
    try {
      final response = await _dio.get('/kiosks/by-kioskid/$kioskId/config');

      if (response.statusCode == 200) {
        return response.data as Map<String, dynamic>;
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
}
