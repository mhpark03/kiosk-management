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
    return Video(
      id: json['id'] as int,
      title: json['title'] as String,
      description: json['description'] as String?,
      filename: json['filename'] as String,
      s3Url: json['s3Url'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      fileSizeBytes: json['fileSizeBytes'] as int?,
      videoType: json['videoType'] as String? ?? 'UPLOAD',
      mediaType: json['mediaType'] as String? ?? 'VIDEO',
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
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
