import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../models/veo_video.dart';

/// Service for Google VEO 3.1 video generation
/// Communicates with backend VEO API endpoints
class VeoService {
  final Dio _dio;
  final String baseUrl;

  VeoService({required this.baseUrl}) : _dio = Dio() {
    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 30);
    _dio.options.receiveTimeout = const Duration(minutes: 10); // VEO takes time
  }

  /// Generate video from text prompt only
  ///
  /// Parameters:
  /// - [request]: VEO video request with prompt and settings
  ///
  /// Returns:
  /// - [VeoVideoResult]: Generation result with video URL or error
  Future<VeoVideoResult> generateFromPrompt(VeoVideoRequest request) async {
    try {
      debugPrint('🎬 VEO: Generating video from prompt');
      debugPrint('📝 Prompt: ${request.prompt}');
      debugPrint('⏱️ Duration: ${request.duration}s');
      debugPrint('📐 Resolution: ${request.resolution}');
      debugPrint('📏 Aspect Ratio: ${request.aspectRatio}');

      final response = await _dio.post(
        '/api/veo/generate-from-prompt',
        data: FormData.fromMap(request.toFormData()),
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );

      debugPrint('✅ VEO: Response received');
      debugPrint('Response: ${response.data}');

      return VeoVideoResult.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      debugPrint('❌ VEO: Dio error - ${e.message}');
      return VeoVideoResult(
        success: false,
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      debugPrint('❌ VEO: Unexpected error - $e');
      return VeoVideoResult(
        success: false,
        message: 'Unexpected error: $e',
      );
    }
  }

  /// Generate video from prompt with first frame image
  ///
  /// Parameters:
  /// - [request]: VEO video request with prompt, settings, and first frame path
  ///
  /// Returns:
  /// - [VeoVideoResult]: Generation result with video URL or error
  Future<VeoVideoResult> generateWithFirstFrame(VeoVideoRequest request) async {
    if (request.firstFramePath == null) {
      return VeoVideoResult(
        success: false,
        message: 'First frame image is required',
      );
    }

    try {
      debugPrint('🎬 VEO: Generating video with first frame');
      debugPrint('📝 Prompt: ${request.prompt}');
      debugPrint('🖼️ First Frame: ${request.firstFramePath}');

      final formData = FormData.fromMap({
        ...request.toFormData(),
        'firstFrame': await MultipartFile.fromFile(
          request.firstFramePath!,
          filename: request.firstFramePath!.split('/').last,
        ),
      });

      final response = await _dio.post(
        '/api/veo/generate-with-first-frame',
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );

      debugPrint('✅ VEO: Response received');
      return VeoVideoResult.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      debugPrint('❌ VEO: Dio error - ${e.message}');
      return VeoVideoResult(
        success: false,
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      debugPrint('❌ VEO: Unexpected error - $e');
      return VeoVideoResult(
        success: false,
        message: 'Unexpected error: $e',
      );
    }
  }

  /// Generate video with interpolation (first and last frames)
  ///
  /// Parameters:
  /// - [request]: VEO video request with prompt, settings, and both frame paths
  ///
  /// Returns:
  /// - [VeoVideoResult]: Generation result with video URL or error
  Future<VeoVideoResult> generateWithInterpolation(VeoVideoRequest request) async {
    if (request.firstFramePath == null || request.lastFramePath == null) {
      return VeoVideoResult(
        success: false,
        message: 'Both first and last frame images are required',
      );
    }

    try {
      debugPrint('🎬 VEO: Generating video with interpolation');
      debugPrint('📝 Prompt: ${request.prompt}');
      debugPrint('🖼️ First Frame: ${request.firstFramePath}');
      debugPrint('🖼️ Last Frame: ${request.lastFramePath}');

      final formData = FormData.fromMap({
        ...request.toFormData(),
        'firstFrame': await MultipartFile.fromFile(
          request.firstFramePath!,
          filename: request.firstFramePath!.split('/').last,
        ),
        'lastFrame': await MultipartFile.fromFile(
          request.lastFramePath!,
          filename: request.lastFramePath!.split('/').last,
        ),
      });

      final response = await _dio.post(
        '/api/veo/generate-with-interpolation',
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );

      debugPrint('✅ VEO: Response received');
      return VeoVideoResult.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      debugPrint('❌ VEO: Dio error - ${e.message}');
      return VeoVideoResult(
        success: false,
        message: 'Network error: ${e.message}',
      );
    } catch (e) {
      debugPrint('❌ VEO: Unexpected error - $e');
      return VeoVideoResult(
        success: false,
        message: 'Unexpected error: $e',
      );
    }
  }

  /// Get proxy video URL for playing VEO-generated videos
  ///
  /// Parameters:
  /// - [videoUrl]: Original Google VEO video URL
  ///
  /// Returns:
  /// - Proxy URL that can be used in video player
  String getProxyVideoUrl(String videoUrl) {
    final encodedUrl = Uri.encodeComponent(videoUrl);
    return '$baseUrl/api/veo/proxy-video?url=$encodedUrl';
  }
}
