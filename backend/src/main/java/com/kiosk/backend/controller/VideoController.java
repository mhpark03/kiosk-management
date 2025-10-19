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
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllVideos() {
        try {
            List<Video> videos = videoService.getAllVideos();
            List<Map<String, Object>> videosWithUser = videos.stream().map(video -> {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("filename", video.getFilename());
                videoMap.put("originalFilename", video.getOriginalFilename());
                videoMap.put("fileSize", video.getFileSize());
                videoMap.put("contentType", video.getContentType());
                videoMap.put("s3Key", video.getS3Key());
                videoMap.put("s3Url", video.getS3Url());
                videoMap.put("thumbnailS3Key", video.getThumbnailS3Key());
                videoMap.put("thumbnailUrl", video.getThumbnailUrl());
                videoMap.put("uploadedAt", video.getUploadedAt());
                videoMap.put("title", video.getTitle());
                videoMap.put("description", video.getDescription());
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
     */
    @GetMapping("/my-videos")
    public ResponseEntity<?> getMyVideos(Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            List<Video> videos = videoService.getVideosByUser(user.getId());
            List<Map<String, Object>> videosWithUser = videos.stream().map(video -> {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("filename", video.getFilename());
                videoMap.put("originalFilename", video.getOriginalFilename());
                videoMap.put("fileSize", video.getFileSize());
                videoMap.put("contentType", video.getContentType());
                videoMap.put("s3Key", video.getS3Key());
                videoMap.put("s3Url", video.getS3Url());
                videoMap.put("thumbnailS3Key", video.getThumbnailS3Key());
                videoMap.put("thumbnailUrl", video.getThumbnailUrl());
                videoMap.put("uploadedAt", video.getUploadedAt());
                videoMap.put("title", video.getTitle());
                videoMap.put("description", video.getDescription());
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
     * Get a specific video by ID (Admin only)
     * GET /api/videos/{id}
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getVideoById(@PathVariable Long id) {
        try {
            Video video = videoService.getVideoById(id);
            return ResponseEntity.ok(video);
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

}
