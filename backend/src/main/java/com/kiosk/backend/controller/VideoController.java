package com.kiosk.backend.controller;

import com.kiosk.backend.annotation.RecordActivity;
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
     * Helper method to extract actual user email from authentication
     * Removes KIOSK_ prefix if present (for kiosk authentication tokens)
     */
    private String extractUserEmail(Authentication authentication) {
        String userEmail = authentication.getName();
        // Remove KIOSK_ prefix if present
        if (userEmail.startsWith("KIOSK_")) {
            userEmail = userEmail.substring(6); // Remove "KIOSK_" prefix
        }
        return userEmail;
    }

    /**
     * Upload a video file (Admin only)
     * POST /api/videos/upload
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    @RecordActivity(
        entityType = EntityHistory.EntityType.VIDEO,
        action = EntityHistory.ActionType.VIDEO_UPLOAD,
        description = "영상 업로드"
    )
    public ResponseEntity<?> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            @RequestParam(value = "imagePurpose", required = false) String imagePurpose,
            Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            // Parse imagePurpose if provided
            Video.ImagePurpose purposeEnum = null;
            if (imagePurpose != null && !imagePurpose.trim().isEmpty()) {
                try {
                    purposeEnum = Video.ImagePurpose.valueOf(imagePurpose.toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Invalid image purpose. Use GENERAL, REFERENCE, or MENU"));
                }
            }

            Video video = videoService.uploadVideo(file, user.getId(), title, description, purposeEnum);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Video uploaded successfully");
            response.put("id", video.getId());
            response.put("title", video.getTitle());
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
     * Optional query params: type (e.g., UPLOAD, AI_GENERATED), mediaType (VIDEO, IMAGE, AUDIO), imagePurpose (GENERAL, REFERENCE, MENU)
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllVideos(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String mediaType,
            @RequestParam(required = false) String imagePurpose) {
        try {
            List<Video> videos;

            // Filter by type if provided
            if (type != null && !type.isEmpty()) {
                try {
                    Video.VideoType videoType = Video.VideoType.valueOf(type.toUpperCase());
                    videos = videoService.getVideosByType(videoType);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Invalid video type"));
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
                            .body(Map.of("error", "Invalid media type. Use VIDEO, IMAGE, or AUDIO"));
                }
            }

            // Further filter by imagePurpose if provided (only for images)
            if (imagePurpose != null && !imagePurpose.isEmpty()) {
                try {
                    Video.ImagePurpose purposeEnum = Video.ImagePurpose.valueOf(imagePurpose.toUpperCase());
                    videos = videos.stream()
                            .filter(v -> v.getMediaType() == Video.MediaType.IMAGE && v.getImagePurpose() == purposeEnum)
                            .collect(java.util.stream.Collectors.toList());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Invalid image purpose. Use GENERAL, REFERENCE, or MENU"));
                }
            }

            List<Map<String, Object>> videosWithUser = videos.stream().map(video -> {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("videoType", video.getVideoType().toString());
                videoMap.put("mediaType", video.getMediaType().toString());
                videoMap.put("imagePurpose", video.getImagePurpose() != null ? video.getImagePurpose().toString() : null);
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
                videoMap.put("downloadable", video.getDownloadable());
                videoMap.put("uploadedById", video.getUploadedById());

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
     * Optional query param: type (e.g., UPLOAD, AI_GENERATED)
     */
    @GetMapping("/my-videos")
    public ResponseEntity<?> getMyVideos(
            @RequestParam(required = false) String type,
            Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
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
                            .body(Map.of("error", "Invalid video type"));
                }
            } else {
                videos = videoService.getVideosByUser(user.getId());
            }

            List<Map<String, Object>> videosWithUser = videos.stream().map(video -> {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("videoType", video.getVideoType().toString());
                videoMap.put("mediaType", video.getMediaType().toString());
                videoMap.put("imagePurpose", video.getImagePurpose() != null ? video.getImagePurpose().toString() : null);
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
                videoMap.put("downloadable", video.getDownloadable());
                videoMap.put("uploadedById", video.getUploadedById());
                videoMap.put("uploadedByEmail", user.getEmail());
                videoMap.put("uploadedByName", user.getDisplayName());

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
    @RecordActivity(
        entityType = EntityHistory.EntityType.VIDEO,
        action = EntityHistory.ActionType.VIDEO_PLAY,
        description = "영상 재생",
        entityIdParam = "id"
    )
    public ResponseEntity<?> getPresignedUrl(
            @PathVariable Long id,
            @RequestParam(value = "duration", defaultValue = "60") int durationMinutes,
            Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            Video video = videoService.getVideoById(id);
            String presignedUrl = videoService.generatePresignedUrl(id, durationMinutes);

            return ResponseEntity.ok(Map.of(
                    "id", video.getId(),
                    "title", video.getTitle(),
                    "url", presignedUrl,
                    "expiresIn", durationMinutes + " minutes"
            ));
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
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            String title = (String) request.get("title");
            String description = (String) request.get("description");

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
     * Toggle video downloadable flag (Admin only)
     * PATCH /api/videos/{id}/downloadable
     */
    @PatchMapping("/{id}/downloadable")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> toggleDownloadable(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> request,
            Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            Boolean downloadable = request.get("downloadable");
            if (downloadable == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "downloadable field is required"));
            }

            Video updatedVideo = videoService.updateDownloadable(id, downloadable, user.getId());
            return ResponseEntity.ok(Map.of("message", "Video downloadable flag updated successfully", "video", updatedVideo));
        } catch (RuntimeException e) {
            log.error("Failed to update video downloadable flag: {}", id, e);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to update downloadable flag", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update downloadable flag: " + e.getMessage()));
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
            String userEmail = extractUserEmail(authentication);
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
     * Regenerate thumbnail for a video
     * POST /api/videos/{id}/regenerate-thumbnail
     */
    @PostMapping("/{id}/regenerate-thumbnail")
    public ResponseEntity<?> regenerateThumbnail(@PathVariable Long id, Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
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
    @RecordActivity(
        entityType = EntityHistory.EntityType.VIDEO,
        action = EntityHistory.ActionType.VIDEO_DELETE,
        description = "영상 삭제",
        entityIdParam = "id"
    )
    public ResponseEntity<?> deleteVideo(@PathVariable Long id, Authentication authentication) {
        try {
            String userEmail = extractUserEmail(authentication);
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            // Get video details before deletion for history recording
            Video video = videoService.getVideoById(id);

            videoService.deleteVideo(id, user.getId());

            return ResponseEntity.ok(Map.of(
                    "message", "Video deleted successfully",
                    "id", video.getId(),
                    "title", video.getTitle()
            ));
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
     * Get presigned download URL for a video/audio file
     * GET /api/videos/{id}/download-url
     */
    @GetMapping("/{id}/download-url")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getDownloadUrl(@PathVariable Long id) {
        try {
            log.info("Getting download URL for video ID: {}", id);

            Video video = videoService.getVideoById(id);
            if (video == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Video not found with ID: " + id));
            }

            String downloadUrl = videoService.getPresignedDownloadUrl(video.getS3Key());

            Map<String, Object> response = new HashMap<>();
            response.put("url", downloadUrl);
            response.put("filename", video.getOriginalFilename());
            response.put("title", video.getTitle());

            log.info("Download URL generated for video ID: {}", id);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to get download URL for video ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate download URL: " + e.getMessage()));
        }
    }

}
