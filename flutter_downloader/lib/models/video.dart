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
    required this.createdAt,
    required this.updatedAt,
    this.downloadStatus = 'pending',
    this.downloadProgress = 0.0,
    this.localPath,
  });

  factory Video.fromJson(Map<String, dynamic> json) {
    // Support both VideoDTO and KioskVideoDTO formats
    // KioskVideoDTO uses: fileName, fileSize, url, videoId
    // VideoDTO uses: filename, fileSizeBytes, s3Url

    // Handle id field (could be 'id' or 'videoId', and could be int or String)
    int videoId;
    if (json['videoId'] != null) {
      videoId = json['videoId'] is int
          ? json['videoId'] as int
          : int.parse(json['videoId'].toString());
    } else if (json['id'] != null) {
      videoId = json['id'] is int
          ? json['id'] as int
          : int.parse(json['id'].toString());
    } else {
      throw FormatException('Video JSON missing id or videoId field');
    }

    // Handle filename field (could be 'filename' or 'fileName')
    String videoFilename;
    if (json['fileName'] != null) {
      videoFilename = json['fileName'] as String;
    } else if (json['filename'] != null) {
      videoFilename = json['filename'] as String;
    } else {
      throw FormatException('Video JSON missing filename or fileName field');
    }

    // Handle file size (could be 'fileSizeBytes' or 'fileSize')
    int? videoFileSize;
    if (json['fileSizeBytes'] != null) {
      videoFileSize = json['fileSizeBytes'] is int
          ? json['fileSizeBytes'] as int
          : (json['fileSizeBytes'] as num).toInt();
    } else if (json['fileSize'] != null) {
      videoFileSize = json['fileSize'] is int
          ? json['fileSize'] as int
          : (json['fileSize'] as num).toInt();
    }

    // Handle URL (could be 's3Url' or 'url')
    final String? videoUrl = (json['s3Url'] as String?) ?? (json['url'] as String?);

    // Handle title
    final String title = json['title'] as String? ?? 'Untitled';

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

    return Video(
      id: videoId,
      title: title,
      description: json['description'] as String?,
      filename: videoFilename,
      s3Url: videoUrl,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      fileSizeBytes: videoFileSize,
      videoType: json['videoType'] as String? ?? 'UPLOAD',
      mediaType: json['mediaType'] as String? ?? 'VIDEO',
      createdAt: createdAtDate,
      updatedAt: updatedAtDate,
    );
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
