/// Model class for VEO video generation request and response
class VeoVideoRequest {
  final String prompt;
  final String? duration; // "4", "5", "8"
  final String? resolution; // "720p", "1080p"
  final String? aspectRatio; // "16:9", "9:16"
  final String? firstFramePath; // Local file path for first frame
  final String? lastFramePath; // Local file path for last frame (for interpolation)

  VeoVideoRequest({
    required this.prompt,
    this.duration = "4",
    this.resolution = "720p",
    this.aspectRatio = "16:9",
    this.firstFramePath,
    this.lastFramePath,
  });

  Map<String, String> toFormData() {
    final data = <String, String>{
      'prompt': prompt,
      'duration': duration ?? "4",
      'resolution': resolution ?? "720p",
      'aspectRatio': aspectRatio ?? "16:9",
    };
    return data;
  }
}

/// Model class for VEO video generation result
class VeoVideoResult {
  final bool success;
  final String? taskId;
  final String? videoUrl;
  final String? status;
  final String? message;

  VeoVideoResult({
    required this.success,
    this.taskId,
    this.videoUrl,
    this.status,
    this.message,
  });

  factory VeoVideoResult.fromJson(Map<String, dynamic> json) {
    return VeoVideoResult(
      success: json['success'] as bool? ?? false,
      taskId: json['taskId'] as String?,
      videoUrl: json['videoUrl'] as String?,
      status: json['status'] as String?,
      message: json['message'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'taskId': taskId,
      'videoUrl': videoUrl,
      'status': status,
      'message': message,
    };
  }
}

/// Enum for VEO generation mode (simplified to Image to Video only)
enum VeoGenerationMode {
  withFirstFrame('Image to Video');

  final String displayName;
  const VeoGenerationMode(this.displayName);
}
