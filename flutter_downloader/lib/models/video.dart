class Video {
  final int id;
  final String title;
  final String? description;
  final String filename;
  final String? s3Url;
  final String? thumbnailUrl;
  final int? fileSizeBytes;
  final String videoType; // UPLOAD, RUNWAY_GENERATED, VEO_GENERATED
  final String mediaType; // VIDEO, IMAGE
  final String? menuId; // Menu ID if this is from a menu
  final DateTime createdAt;
  final DateTime updatedAt;

  // Download status (local only, not from API)
  String downloadStatus; // pending, downloading, completed, failed
  double downloadProgress; // 0.0 to 1.0
  String? localPath;

  Video({
    required this.id,
    required this.title,
    this.description,
    required this.filename,
    this.s3Url,
    this.thumbnailUrl,
    this.fileSizeBytes,
    required this.videoType,
    required this.mediaType,
    this.menuId,
    required this.createdAt,
    required this.updatedAt,
    this.downloadStatus = 'pending',
    this.downloadProgress = 0.0,
    this.localPath,
  });

  factory Video.fromJson(Map<String, dynamic> json) {
    try {
      print('[Video.fromJson] Parsing JSON: ${json.keys.toList()}');

      // Support both VideoDTO and KioskVideoDTO formats
      // KioskVideoDTO uses: fileName, fileSize, url, videoId
      // VideoDTO uses: filename, fileSizeBytes, s3Url

      // Handle id field (could be 'id' or 'videoId', and could be int or String)
      int videoId;
      if (json['videoId'] != null) {
        final rawId = json['videoId'];
        print('[Video.fromJson] videoId type: ${rawId.runtimeType}, value: $rawId');
        videoId = rawId is int ? rawId : int.parse(rawId.toString());
      } else if (json['id'] != null) {
        final rawId = json['id'];
        print('[Video.fromJson] id type: ${rawId.runtimeType}, value: $rawId');
        videoId = rawId is int ? rawId : int.parse(rawId.toString());
      } else {
        throw FormatException('Video JSON missing id or videoId field');
      }

      // Handle filename field (could be 'filename' or 'fileName')
      String videoFilename;
      if (json['fileName'] != null) {
        videoFilename = json['fileName'].toString();
      } else if (json['filename'] != null) {
        videoFilename = json['filename'].toString();
      } else {
        print('[Video.fromJson] WARNING: Missing filename, using default');
        videoFilename = 'unknown.mp4';
      }

      // Handle file size (could be 'fileSizeBytes' or 'fileSize')
      int? videoFileSize;
      if (json['fileSizeBytes'] != null) {
        final rawSize = json['fileSizeBytes'];
        videoFileSize = rawSize is int ? rawSize : (rawSize as num).toInt();
      } else if (json['fileSize'] != null) {
        final rawSize = json['fileSize'];
        videoFileSize = rawSize is int ? rawSize : (rawSize as num).toInt();
      }

      // Handle URL (could be 's3Url' or 'url')
      final String? videoUrl = (json['s3Url'] as String?) ?? (json['url'] as String?);

      // Handle thumbnail URL
      final String? thumbnailUrlValue = json['thumbnailUrl']?.toString();
      print('[Video.fromJson] thumbnailUrl: $thumbnailUrlValue');

      // Handle title
      final String title = json['title']?.toString() ?? 'Untitled';

      // Handle dates - updatedAt might not exist in KioskVideoDTO
      DateTime createdAtDate;
      if (json['createdAt'] != null) {
        createdAtDate = DateTime.parse(json['createdAt'] as String);
      } else {
        createdAtDate = DateTime.now();
      }

      final DateTime updatedAtDate = json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : createdAtDate; // Use createdAt as fallback

      // Handle menuId field
      final String? menuIdValue = json['menuId']?.toString();

      return Video(
        id: videoId,
        title: title,
        description: json['description']?.toString(),
        filename: videoFilename,
        s3Url: videoUrl,
        thumbnailUrl: thumbnailUrlValue,
        fileSizeBytes: videoFileSize,
        videoType: json['videoType']?.toString() ?? 'UPLOAD',
        mediaType: json['mediaType']?.toString() ?? 'VIDEO',
        menuId: menuIdValue,
        createdAt: createdAtDate,
        updatedAt: updatedAtDate,
      );
    } catch (e, stackTrace) {
      print('[Video.fromJson] ERROR parsing video JSON: $e');
      print('[Video.fromJson] JSON data: $json');
      print('[Video.fromJson] Stack trace: $stackTrace');
      rethrow;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'filename': filename,
      's3Url': s3Url,
      'thumbnailUrl': thumbnailUrl,
      'fileSizeBytes': fileSizeBytes,
      'videoType': videoType,
      'mediaType': mediaType,
      'menuId': menuId,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'downloadStatus': downloadStatus,
      'downloadProgress': downloadProgress,
      'localPath': localPath,
    };
  }

  Video copyWith({
    int? id,
    String? title,
    String? description,
    String? filename,
    String? s3Url,
    String? thumbnailUrl,
    int? fileSizeBytes,
    String? videoType,
    String? mediaType,
    String? menuId,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? downloadStatus,
    double? downloadProgress,
    String? localPath,
  }) {
    return Video(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      filename: filename ?? this.filename,
      s3Url: s3Url ?? this.s3Url,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      videoType: videoType ?? this.videoType,
      mediaType: mediaType ?? this.mediaType,
      menuId: menuId ?? this.menuId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      downloadStatus: downloadStatus ?? this.downloadStatus,
      downloadProgress: downloadProgress ?? this.downloadProgress,
      localPath: localPath ?? this.localPath,
    );
  }

  String get fileSizeDisplay {
    if (fileSizeBytes == null) return 'Unknown';
    final mb = fileSizeBytes! / (1024 * 1024);
    return '${mb.toStringAsFixed(2)} MB';
  }
}
