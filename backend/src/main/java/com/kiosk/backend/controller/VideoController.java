package com.kiosk.backend.controller;

import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.entity.Video;
import com.kiosk.backend.repository.UserRepository;
import com.kiosk.backend.service.EntityHistoryService;
import com.kiosk.backend.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:5173")
public class VideoController {

    private final VideoService videoService;
    private final UserRepository userRepository;
    private final EntityHistoryService entityHistoryService;

    /**
     * Upload a video file (Admin only)
     * POST /api/videos/upload
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            Video video = videoService.uploadVideo(file, user.getId(), title, description);

            // Record video upload activity to entity history
            entityHistoryService.recordVideoActivity(
                    video.getId(),
                    video.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_UPLOAD,
                    "영상 업로드: " + video.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Video uploaded successfully");
            response.put("video", video);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid file upload request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload video", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload video: " + e.getMessage()));
        }
    }

    /**
     * Get all videos (Admin only)
     * GET /api/videos
     * Optional query param: type (UPLOAD or RUNWAY_GENERATED)
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllVideos(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String mediaType) {
        try {
            List<Video> videos;

            // Filter by type if provided
            if (type != null && !type.isEmpty()) {
                try {
                    Video.VideoType videoType = Video.VideoType.valueOf(type.toUpperCase());
                    videos = videoService.getVideosByType(videoType);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Invalid video type. Use UPLOAD or RUNWAY_GENERATED"));
                }
            } else {
                videos = videoService.getAllVideos();
            }

            // Further filter by mediaType if provided
            if (mediaType != null && !mediaType.isEmpty()) {
                try {
                    Video.MediaType mediaTypeEnum = Video.MediaType.valueOf(mediaType.toUpperCase());
                    videos = videos.stream()
                            .filter(v -> v.getMediaType() == mediaTypeEnum)
                            .collect(java.util.stream.Collectors.toList());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Invalid media type. Use VIDEO or IMAGE"));
                }
            }

            List<Map<String, Object>> videosWithUser = videos.stream().map(video -> {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("videoType", video.getVideoType().toString());
                videoMap.put("mediaType", video.getMediaType().toString());
                videoMap.put("filename", video.getFilename());
                videoMap.put("originalFilename", video.getOriginalFilename());
                videoMap.put("fileSize", video.getFileSize());
                videoMap.put("contentType", video.getContentType());
                videoMap.put("s3Key", video.getS3Key());
                videoMap.put("s3Url", video.getS3Url());
                videoMap.put("thumbnailS3Key", video.getThumbnailS3Key());

                // Generate presigned URL for thumbnail if exists
                if (video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
                    String thumbnailPresignedUrl = videoService.generateThumbnailPresignedUrl(video.getId(), 10080); // 7 days
                    videoMap.put("thumbnailUrl", thumbnailPresignedUrl);
                } else {
                    videoMap.put("thumbnailUrl", null);
                }

                videoMap.put("uploadedAt", video.getUploadedAt());
                videoMap.put("title", video.getTitle());
                videoMap.put("description", video.getDescription());
                videoMap.put("uploadedById", video.getUploadedById());

                // Add Runway ML specific fields if applicable
                if (video.getVideoType() == Video.VideoType.RUNWAY_GENERATED) {
                    videoMap.put("runwayTaskId", video.getRunwayTaskId());
                    videoMap.put("runwayModel", video.getRunwayModel());
                    videoMap.put("runwayResolution", video.getRunwayResolution());
                    videoMap.put("runwayPrompt", video.getRunwayPrompt());
                }

                // Get user information
                userRepository.findById(video.getUploadedById()).ifPresent(user -> {
                    videoMap.put("uploadedByEmail", user.getEmail());
                    videoMap.put("uploadedByName", user.getDisplayName());
                });

                return videoMap;
            }).toList();

            return ResponseEntity.ok(videosWithUser);
        } catch (Exception e) {
            log.error("Failed to retrieve videos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve videos: " + e.getMessage()));
        }
    }

    /**
     * Get videos uploaded by current user
     * GET /api/videos/my-videos
     * Optional query param: type (UPLOAD or RUNWAY_GENERATED)
     */
    @GetMapping("/my-videos")
    public ResponseEntity<?> getMyVideos(
            @RequestParam(required = false) String type,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            List<Video> videos;

            // Filter by type if provided
            if (type != null && !type.isEmpty()) {
                try {
                    Video.VideoType videoType = Video.VideoType.valueOf(type.toUpperCase());
                    videos = videoService.getVideosByUserAndType(user.getId(), videoType);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Invalid video type. Use UPLOAD or RUNWAY_GENERATED"));
                }
            } else {
                videos = videoService.getVideosByUser(user.getId());
            }

            List<Map<String, Object>> videosWithUser = videos.stream().map(video -> {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("videoType", video.getVideoType().toString());
                videoMap.put("mediaType", video.getMediaType().toString());
                videoMap.put("filename", video.getFilename());
                videoMap.put("originalFilename", video.getOriginalFilename());
                videoMap.put("fileSize", video.getFileSize());
                videoMap.put("contentType", video.getContentType());
                videoMap.put("s3Key", video.getS3Key());
                videoMap.put("s3Url", video.getS3Url());
                videoMap.put("thumbnailS3Key", video.getThumbnailS3Key());

                // Generate presigned URL for thumbnail if exists
                if (video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
                    String thumbnailPresignedUrl = videoService.generateThumbnailPresignedUrl(video.getId(), 10080); // 7 days
                    videoMap.put("thumbnailUrl", thumbnailPresignedUrl);
                } else {
                    videoMap.put("thumbnailUrl", null);
                }

                videoMap.put("uploadedAt", video.getUploadedAt());
                videoMap.put("title", video.getTitle());
                videoMap.put("description", video.getDescription());
                videoMap.put("uploadedById", video.getUploadedById());
                videoMap.put("uploadedByEmail", user.getEmail());
                videoMap.put("uploadedByName", user.getDisplayName());

                // Add Runway ML specific fields if applicable
                if (video.getVideoType() == Video.VideoType.RUNWAY_GENERATED) {
                    videoMap.put("runwayTaskId", video.getRunwayTaskId());
                    videoMap.put("runwayModel", video.getRunwayModel());
                    videoMap.put("runwayResolution", video.getRunwayResolution());
                    videoMap.put("runwayPrompt", video.getRunwayPrompt());
                }

                return videoMap;
            }).toList();

            return ResponseEntity.ok(videosWithUser);
        } catch (Exception e) {
            log.error("Failed to retrieve user videos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve videos: " + e.getMessage()));
        }
    }

    /**
     * Get a specific video by ID with presigned download URL
     * GET /api/videos/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getVideoById(@PathVariable Long id) {
        try {
            Video video = videoService.getVideoById(id);

            // Generate presigned URL for download (valid for 7 days = 10080 minutes)
            String presignedUrl = videoService.generatePresignedUrl(id, 10080);

            // Generate presigned URL for thumbnail if exists
            String thumbnailPresignedUrl = null;
            if (video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
                thumbnailPresignedUrl = videoService.generateThumbnailPresignedUrl(id, 10080);
            }

            // Create response with video details and presigned URL
            Map<String, Object> response = new HashMap<>();
            response.put("id", video.getId());
            response.put("videoType", video.getVideoType().toString());
            response.put("filename", video.getFilename());
            response.put("originalFilename", video.getOriginalFilename());
            response.put("fileSize", video.getFileSize());
            response.put("contentType", video.getContentType());
            response.put("s3Key", video.getS3Key());
            response.put("s3Url", presignedUrl);  // Use presigned URL instead of public URL
            response.put("thumbnailS3Key", video.getThumbnailS3Key());
            response.put("thumbnailUrl", thumbnailPresignedUrl);  // Use presigned URL for thumbnail
            response.put("uploadedAt", video.getUploadedAt());
            response.put("title", video.getTitle());
            response.put("description", video.getDescription());
            response.put("duration", video.getDuration());
            response.put("uploadedById", video.getUploadedById());

            // Add Runway ML specific fields if applicable
            if (video.getVideoType() == Video.VideoType.RUNWAY_GENERATED) {
                response.put("runwayTaskId", video.getRunwayTaskId());
                response.put("runwayModel", video.getRunwayModel());
                response.put("runwayResolution", video.getRunwayResolution());
                response.put("runwayPrompt", video.getRunwayPrompt());
            }

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            log.error("Video not found: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to retrieve video", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to retrieve video: " + e.getMessage()));
        }
    }

    /**
     * Generate presigned URL for video playback/download (Admin only)
     * GET /api/videos/{id}/presigned-url
     */
    @GetMapping("/{id}/presigned-url")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getPresignedUrl(
            @PathVariable Long id,
            @RequestParam(value = "duration", defaultValue = "60") int durationMinutes,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            Video video = videoService.getVideoById(id);
            String presignedUrl = videoService.generatePresignedUrl(id, durationMinutes);

            // Record video play activity to entity history
            entityHistoryService.recordVideoActivity(
                    video.getId(),
                    video.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_PLAY,
                    "영상 재생: " + video.getTitle()
            );

            return ResponseEntity.ok(Map.of("url", presignedUrl, "expiresIn", durationMinutes + " minutes"));
        } catch (RuntimeException e) {
            log.error("Failed to generate presigned URL for video: {}", id, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to generate presigned URL", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate URL: " + e.getMessage()));
        }
    }

    /**
     * Update video title and/or description (Admin only)
     * PATCH /api/videos/{id}
     */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateVideo(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            String title = request.get("title");
            String description = request.get("description");

            Video updatedVideo = videoService.updateVideo(id, title, description, user.getId());
            return ResponseEntity.ok(Map.of("message", "Video updated successfully", "video", updatedVideo));
        } catch (RuntimeException e) {
            log.error("Failed to update video: {}", id, e);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to update video", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update video: " + e.getMessage()));
        }
    }

    /**
     * Update video description (Admin only) - Backward compatibility
     * PATCH /api/videos/{id}/description
     * @deprecated Use PATCH /api/videos/{id} instead
     */
    @Deprecated
    @PatchMapping("/{id}/description")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDescription(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            String description = request.get("description");

            Video updatedVideo = videoService.updateDescription(id, description, user.getId());
            return ResponseEntity.ok(Map.of("message", "Description updated successfully", "video", updatedVideo));
        } catch (RuntimeException e) {
            log.error("Failed to update video description: {}", id, e);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to update description", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update description: " + e.getMessage()));
        }
    }

    /**
     * Regenerate thumbnail for a video (Admin only)
     * POST /api/videos/{id}/regenerate-thumbnail
     */
    @PostMapping("/{id}/regenerate-thumbnail")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> regenerateThumbnail(@PathVariable Long id, Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findById(userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail))
                    .getId())
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            Video video = videoService.regenerateThumbnail(id, user.getId());

            // Generate presigned URL for thumbnail
            String thumbnailPresignedUrl = null;
            if (video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
                thumbnailPresignedUrl = videoService.generateThumbnailPresignedUrl(id, 10080); // 7 days
            }

            // Create response with video details and presigned URL for thumbnail
            Map<String, Object> videoResponse = new HashMap<>();
            videoResponse.put("id", video.getId());
            videoResponse.put("filename", video.getFilename());
            videoResponse.put("originalFilename", video.getOriginalFilename());
            videoResponse.put("fileSize", video.getFileSize());
            videoResponse.put("contentType", video.getContentType());
            videoResponse.put("s3Key", video.getS3Key());
            videoResponse.put("s3Url", video.getS3Url());
            videoResponse.put("thumbnailS3Key", video.getThumbnailS3Key());
            videoResponse.put("thumbnailUrl", thumbnailPresignedUrl);
            videoResponse.put("uploadedAt", video.getUploadedAt());
            videoResponse.put("title", video.getTitle());
            videoResponse.put("description", video.getDescription());
            videoResponse.put("uploadedById", video.getUploadedById());

            return ResponseEntity.ok(Map.of(
                    "message", "Thumbnail regenerated successfully",
                    "video", videoResponse
            ));
        } catch (RuntimeException e) {
            log.error("Failed to regenerate thumbnail for video: {}", id, e);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to regenerate thumbnail", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to regenerate thumbnail: " + e.getMessage()));
        }
    }

    /**
     * Delete a video (Admin only)
     * DELETE /api/videos/{id}
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteVideo(@PathVariable Long id, Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            // Get video details before deletion for history recording
            Video video = videoService.getVideoById(id);

            videoService.deleteVideo(id, user.getId());

            // Record video delete activity to entity history
            entityHistoryService.recordVideoActivity(
                    video.getId(),
                    video.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_DELETE,
                    "영상 삭제: " + video.getTitle()
            );

            return ResponseEntity.ok(Map.of("message", "Video deleted successfully"));
        } catch (RuntimeException e) {
            log.error("Failed to delete video: {}", id, e);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to delete video", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete video: " + e.getMessage()));
        }
    }

    /**
     * Save Runway ML generated video from URL to S3 and database (Admin only)
     * POST /api/videos/save-runway-video
     * TODO: Re-enable @PreAuthorize("hasRole('ADMIN')") after debugging
     */
    @PostMapping("/save-runway-video")
    // @PreAuthorize("hasRole('ADMIN')") // Temporarily disabled for debugging
    public ResponseEntity<?> saveRunwayGeneratedVideo(
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            // Get user from authentication or use null
            Long userId = null;
            User user = null;
            if (authentication != null) {
                String userEmail = authentication.getName();
                user = userRepository.findByEmail(userEmail).orElse(null);
                if (user != null) {
                    userId = user.getId();
                }
            } else {
                log.warn("⚠️ No authentication, saving Runway video without user association");
            }

            String videoUrl = request.get("videoUrl");
            String title = request.get("title");
            String description = request.get("description");
            String runwayTaskId = request.get("runwayTaskId");
            String runwayModel = request.get("runwayModel");
            String runwayResolution = request.get("runwayResolution");
            String runwayPrompt = request.get("runwayPrompt");

            // Validate required fields
            if (videoUrl == null || videoUrl.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Video URL is required"));
            }
            if (title == null || title.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
            }
            if (description == null || description.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Description is required"));
            }

            Video video = videoService.saveRunwayGeneratedVideo(
                    videoUrl,
                    userId,
                    title,
                    description,
                    runwayTaskId,
                    runwayModel,
                    runwayResolution,
                    runwayPrompt
            );

            // Record video upload activity to entity history (if user is available)
            if (user != null) {
                entityHistoryService.recordVideoActivity(
                        video.getId(),
                        video.getTitle(),
                        user,
                        EntityHistory.ActionType.VIDEO_UPLOAD,
                        "Runway ML 영상 생성: " + video.getTitle()
                );
            } else {
                log.info("Skipping entity history record - no user authentication");
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Runway ML generated video saved successfully");
            response.put("video", video);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid save runway video request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to save Runway ML generated video", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save video: " + e.getMessage()));
        }
    }

    /**
     * Save Runway ML generated image from URL to S3 and database (Admin only)
     * POST /api/videos/save-runway-image
     */
    @PostMapping("/save-runway-image")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> saveRunwayGeneratedImage(
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            String imageUrl = request.get("imageUrl");
            String title = request.get("title");
            String description = request.get("description");
            String runwayTaskId = request.get("runwayTaskId");
            String runwayResolution = request.get("runwayResolution");
            String runwayPrompt = request.get("runwayPrompt");
            String imageStyle = request.get("imageStyle");

            // Validate required fields
            if (imageUrl == null || imageUrl.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Image URL is required"));
            }
            if (title == null || title.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
            }
            if (description == null || description.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Description is required"));
            }

            Video video = videoService.saveRunwayGeneratedImage(
                    imageUrl,
                    user.getId(),
                    title,
                    description,
                    runwayTaskId,
                    runwayResolution,
                    runwayPrompt,
                    imageStyle
            );

            // Record image upload activity to entity history
            entityHistoryService.recordVideoActivity(
                    video.getId(),
                    video.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_UPLOAD,
                    "Runway ML 이미지 생성: " + video.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Runway ML generated image saved successfully");
            response.put("image", video);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid save runway image request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to save Runway ML generated image", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save image: " + e.getMessage()));
        }
    }

    /**
     * Save Google Veo generated video from URL to S3 and database
     * POST /api/videos/save-veo-video
     * TODO: Re-enable @PreAuthorize("hasRole('ADMIN')") after debugging
     */
    @PostMapping("/save-veo-video")
    // @PreAuthorize("hasRole('ADMIN')") // Temporarily disabled for debugging
    public ResponseEntity<?> saveVeoGeneratedVideo(
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            log.info("=== Save Veo Video Request ===");
            log.info("Request: {}", request);
            log.info("Auth: {}", authentication != null ? authentication.getName() : "null");

            // Get user from authentication or use null
            Long userId = null;
            User user = null;
            if (authentication != null) {
                String userEmail = authentication.getName();
                user = userRepository.findByEmail(userEmail).orElse(null);
                if (user != null) {
                    userId = user.getId();
                    log.info("Authenticated user: {}", userEmail);
                } else {
                    log.warn("⚠️ User not found in database: {}", userEmail);
                }
            } else {
                log.warn("⚠️ No authentication, saving video without user association");
            }

            String videoUrl = request.get("videoUrl");
            String title = request.get("title");
            String description = request.get("description");
            String veoTaskId = request.get("veoTaskId");
            String veoPrompt = request.get("veoPrompt");

            log.info("Video URL: {}", videoUrl);
            log.info("Title: {}", title);
            log.info("User ID: {}", userId);

            // Validate required fields
            if (videoUrl == null || videoUrl.trim().isEmpty()) {
                log.error("Video URL is required");
                return ResponseEntity.badRequest().body(Map.of("error", "Video URL is required"));
            }
            if (title == null || title.trim().isEmpty()) {
                log.error("Title is required");
                return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
            }
            if (description == null || description.trim().isEmpty()) {
                log.error("Description is required");
                return ResponseEntity.badRequest().body(Map.of("error", "Description is required"));
            }

            log.info("Calling videoService.saveVeoGeneratedVideo...");
            Video video = videoService.saveVeoGeneratedVideo(
                    videoUrl,
                    userId,
                    title,
                    description,
                    veoTaskId,
                    veoPrompt
            );
            log.info("✅ Video saved successfully: {}", video.getId());

            // Record video upload activity to entity history (if user is available)
            if (user != null) {
                entityHistoryService.recordVideoActivity(
                        video.getId(),
                        video.getTitle(),
                        user,
                        EntityHistory.ActionType.VIDEO_UPLOAD,
                        "Google Veo 영상 생성: " + video.getTitle()
                );
            } else {
                log.info("Skipping entity history record (no user authentication)");
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Google Veo generated video saved successfully");
            response.put("video", video);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid save veo video request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to save Google Veo generated video", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save video: " + e.getMessage()));
        }
    }

    /**
     * Merge two videos into one (Admin only)
     * POST /api/videos/merge
     */
    @PostMapping("/merge")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> mergeVideos(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            // Extract parameters
            Long videoId1 = Long.valueOf(request.get("videoId1").toString());
            Long videoId2 = Long.valueOf(request.get("videoId2").toString());
            String title = (String) request.get("title");
            String description = (String) request.get("description");
            String transitionType = (String) request.getOrDefault("transitionType", "concat");
            Double transitionDuration = request.containsKey("transitionDuration")
                    ? Double.valueOf(request.get("transitionDuration").toString())
                    : 1.0;
            String outputQuality = (String) request.getOrDefault("outputQuality", "medium");

            log.info("Merging videos: {} + {} with transition: {}", videoId1, videoId2, transitionType);

            Video mergedVideo = videoService.mergeVideos(
                    videoId1, videoId2, title, description,
                    transitionType, transitionDuration, outputQuality, user.getId()
            );

            // Record merge activity
            entityHistoryService.recordVideoActivity(
                    mergedVideo.getId(),
                    mergedVideo.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_UPLOAD,
                    "영상 병합: " + mergedVideo.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Videos merged successfully");
            response.put("video", mergedVideo);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid merge request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to merge videos", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to merge videos: " + e.getMessage()));
        }
    }

}
