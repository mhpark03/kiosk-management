class Kiosk {
  final int? id; // Database ID
  final String kioskid;
  final String? posid;
  final String? posname;
  final int? kioskNumber;
  final String? location;
  final String? status;
  final String? downloadPath;
  final bool? autoSyncEnabled;
  final int? syncIntervalHours;
  final DateTime? lastSyncTime;
  final int? menuId; // Associated menu (XML file with imagePurpose=MENU)
  final String? menuFilename; // Menu file name (original filename from video)
  final DateTime createdAt;
  final DateTime updatedAt;

  Kiosk({
    this.id,
    required this.kioskid,
    this.posid,
    this.posname,
    this.kioskNumber,
    this.location,
    this.status,
    this.downloadPath,
    this.autoSyncEnabled,
    this.syncIntervalHours,
    this.lastSyncTime,
    this.menuId,
    this.menuFilename,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Kiosk.fromJson(Map<String, dynamic> json) {
    return Kiosk(
      id: json['id'] as int?,
      kioskid: json['kioskid'] as String,
      posid: json['posid'] as String?,
      posname: json['posname'] as String?,
      kioskNumber: json['kiosk_number'] != null
          ? json['kiosk_number'] as int
          : (json['kioskno'] != null ? json['kioskno'] as int : null),
      location: json['location'] as String?,
      status: json['status'] as String?,
      downloadPath: json['download_path'] as String?,
      autoSyncEnabled: json['auto_sync_enabled'] as bool?,
      syncIntervalHours: json['sync_interval_hours'] as int?,
      lastSyncTime: json['last_sync_time'] != null
          ? DateTime.parse(json['last_sync_time'] as String)
          : null,
      menuId: json['menuId'] as int?,
      menuFilename: json['menuFilename'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'kioskid': kioskid,
      'posid': posid,
      'posname': posname,
      'kiosk_number': kioskNumber,
      'location': location,
      'status': status,
      'download_path': downloadPath,
      'auto_sync_enabled': autoSyncEnabled,
      'sync_interval_hours': syncIntervalHours,
      'last_sync_time': lastSyncTime?.toIso8601String(),
      'menuId': menuId,
      'menuFilename': menuFilename,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
