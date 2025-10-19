package com.kiosk.backend.controller;

import com.kiosk.backend.entity.Video;
import com.kiosk.backend.service.VideoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    /**
     * Upload a video file (Admin only)
     * POST /api/videos/upload
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "description", required = false) String description,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            Video video = videoService.uploadVideo(file, userEmail, description);

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
            return ResponseEntity.ok(videos);
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
            List<Video> videos = videoService.getVideosByUser(userEmail);
            return ResponseEntity.ok(videos);
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
            @RequestParam(value = "duration", defaultValue = "60") int durationMinutes) {
        try {
            String presignedUrl = videoService.generatePresignedUrl(id, durationMinutes);
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
     * Update video description (Admin only)
     * PATCH /api/videos/{id}/description
     */
    @PatchMapping("/{id}/description")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDescription(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            String description = request.get("description");

            Video updatedVideo = videoService.updateDescription(id, description, userEmail);
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
            videoService.deleteVideo(id, userEmail);
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
