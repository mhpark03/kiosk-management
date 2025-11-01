import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../models/video.dart';

typedef DownloadProgressCallback = void Function(int received, int total);

class DownloadService {
  final Dio _dio = Dio();

  // Download a file with progress tracking
  Future<String> downloadFile(
    String url,
    String savePath,
    String filename, {
    DownloadProgressCallback? onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      // Normalize path separators for the current platform
      // Android is Linux-based and requires forward slashes only
      final normalizedSavePath = savePath.replaceAll('\\', '/');

      // Ensure directory exists
      final dir = Directory(normalizedSavePath);
      if (!await dir.exists()) {
        await dir.create(recursive: true);
      }

      final filePath = '$normalizedSavePath${Platform.pathSeparator}$filename';

      // Download file
      await _dio.download(
        url,
        filePath,
        onReceiveProgress: onProgress,
        cancelToken: cancelToken,
        options: Options(
          receiveTimeout: const Duration(minutes: 30),
          sendTimeout: const Duration(minutes: 30),
        ),
      );

      return filePath;
    } catch (e) {
      throw Exception('다운로드 실패: $e');
    }
  }

  // Check if file already exists
  Future<bool> fileExists(String path) async {
    final file = File(path);
    return await file.exists();
  }

  // Get file size
  Future<int> getFileSize(String path) async {
    final file = File(path);
    if (await file.exists()) {
      return await file.length();
    }
    return 0;
  }

  // Delete file
  Future<void> deleteFile(String path) async {
    final file = File(path);
    if (await file.exists()) {
      await file.delete();
    }
  }

  // Get default download directory
  Future<String> getDefaultDownloadPath() async {
    if (Platform.isWindows) {
      final dir = await getApplicationDocumentsDirectory();
      return '${dir.path}${Platform.pathSeparator}KioskVideos';
    } else if (Platform.isAndroid) {
      final dir = await getExternalStorageDirectory();
      return dir?.path ?? '/storage/emulated/0/KioskVideos';
    } else {
      final dir = await getApplicationDocumentsDirectory();
      return dir.path;
    }
  }

  // Calculate estimated time remaining
  String getEstimatedTime(int received, int total, int bytesPerSecond) {
    if (bytesPerSecond == 0) return '계산 중...';

    final remaining = total - received;
    final seconds = remaining / bytesPerSecond;

    if (seconds < 60) {
      return '${seconds.toInt()}초';
    } else if (seconds < 3600) {
      return '${(seconds / 60).toInt()}분';
    } else {
      return '${(seconds / 3600).toInt()}시간';
    }
  }

  // Format bytes to human readable
  String formatBytes(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(2)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    }
  }
}
