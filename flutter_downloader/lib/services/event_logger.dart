import 'dart:io';
import 'package:intl/intl.dart';
import 'package:path/path.dart' as path;

class EventLogger {
  static final EventLogger _instance = EventLogger._internal();
  factory EventLogger() => _instance;
  EventLogger._internal();

  String? _logDirectory;

  /// Initialize logger with download path
  void initialize(String downloadPath) {
    _logDirectory = path.join(downloadPath, 'logs');
    _ensureLogDirectoryExists();
  }

  /// Ensure logs directory exists
  void _ensureLogDirectoryExists() {
    if (_logDirectory != null) {
      final dir = Directory(_logDirectory!);
      if (!dir.existsSync()) {
        dir.createSync(recursive: true);
        print('[EventLogger] Created logs directory: $_logDirectory');
      }
    }
  }

  /// Log an event to file
  Future<void> logEvent({
    required String eventType,
    required String message,
    String? metadata,
  }) async {
    if (_logDirectory == null) {
      print('[EventLogger] Warning: Logger not initialized');
      return;
    }

    try {
      _ensureLogDirectoryExists();

      // Create log file name with current date (YYYYMMDD.log)
      final now = DateTime.now();
      final dateStr = DateFormat('yyyyMMdd').format(now);
      final logFilePath = path.join(_logDirectory!, 'events_$dateStr.log');

      // Format timestamp
      final timestamp = DateFormat('yyyy-MM-dd HH:mm:ss').format(now);

      // Build log entry
      final logEntry = StringBuffer();
      logEntry.write('[$timestamp] ');
      logEntry.write('[$eventType] ');
      logEntry.write(message);
      if (metadata != null && metadata.isNotEmpty) {
        logEntry.write(' | metadata: $metadata');
      }
      logEntry.writeln();

      // Append to log file
      final file = File(logFilePath);
      await file.writeAsString(
        logEntry.toString(),
        mode: FileMode.append,
        flush: true,
      );

      print('[EventLogger] Logged: $eventType - $message');
    } catch (e) {
      print('[EventLogger] Error writing log: $e');
    }
  }

  /// Delete old log files (older than specified days)
  Future<void> cleanOldLogs({int keepDays = 30}) async {
    if (_logDirectory == null) return;

    try {
      final dir = Directory(_logDirectory!);
      if (!dir.existsSync()) return;

      final now = DateTime.now();
      final cutoffDate = now.subtract(Duration(days: keepDays));

      await for (final entity in dir.list()) {
        if (entity is File && entity.path.endsWith('.log')) {
          final stat = await entity.stat();
          if (stat.modified.isBefore(cutoffDate)) {
            await entity.delete();
            print('[EventLogger] Deleted old log: ${path.basename(entity.path)}');
          }
        }
      }
    } catch (e) {
      print('[EventLogger] Error cleaning old logs: $e');
    }
  }

  /// Get current log file path for debugging
  String? getCurrentLogPath() {
    if (_logDirectory == null) return null;
    final dateStr = DateFormat('yyyyMMdd').format(DateTime.now());
    return path.join(_logDirectory!, 'events_$dateStr.log');
  }
}
