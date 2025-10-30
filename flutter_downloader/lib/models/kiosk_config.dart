class KioskConfig {
  final String serverUrl;
  final String kioskId;
  final String? posId;
  final String downloadPath;
  final bool autoSync;
  final int syncIntervalHours;
  final DateTime? lastSyncTime;

  KioskConfig({
    required this.serverUrl,
    required this.kioskId,
    this.posId,
    required this.downloadPath,
    this.autoSync = false,
    this.syncIntervalHours = 12,
    this.lastSyncTime,
  });

  factory KioskConfig.fromJson(Map<String, dynamic> json) {
    return KioskConfig(
      serverUrl: json['serverUrl'] as String,
      kioskId: json['kioskId'] as String,
      posId: json['posId'] as String?,
      downloadPath: json['downloadPath'] as String,
      autoSync: json['autoSync'] as bool? ?? false,
      syncIntervalHours: json['syncIntervalHours'] as int? ?? 12,
      lastSyncTime: json['lastSyncTime'] != null
          ? DateTime.parse(json['lastSyncTime'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'serverUrl': serverUrl,
      'kioskId': kioskId,
      'posId': posId,
      'downloadPath': downloadPath,
      'autoSync': autoSync,
      'syncIntervalHours': syncIntervalHours,
      'lastSyncTime': lastSyncTime?.toIso8601String(),
    };
  }

  KioskConfig copyWith({
    String? serverUrl,
    String? kioskId,
    String? posId,
    String? downloadPath,
    bool? autoSync,
    int? syncIntervalHours,
    DateTime? lastSyncTime,
  }) {
    return KioskConfig(
      serverUrl: serverUrl ?? this.serverUrl,
      kioskId: kioskId ?? this.kioskId,
      posId: posId ?? this.posId,
      downloadPath: downloadPath ?? this.downloadPath,
      autoSync: autoSync ?? this.autoSync,
      syncIntervalHours: syncIntervalHours ?? this.syncIntervalHours,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
    );
  }

  bool get isValid {
    return serverUrl.isNotEmpty &&
           kioskId.isNotEmpty &&
           (posId?.isNotEmpty ?? false) &&
           downloadPath.isNotEmpty;
  }
}

// Server presets
class ServerPresets {
  static const String awsDev =
      'http://kiosk-backend-env.eba-32jx2nbm.ap-northeast-2.elasticbeanstalk.com/api';
  static const String local = 'http://10.0.2.2:8080/api'; // Android emulator localhost
}
