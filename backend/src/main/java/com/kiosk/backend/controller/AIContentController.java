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

import java.util.HashMap;
import java.util.Map;

/**
 * AI Content Upload Controller
 * Unified endpoint for uploading AI-generated content (images, videos, audio)
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class AIContentController {

    private final VideoService videoService;
    private final UserRepository userRepository;
    private final EntityHistoryService entityHistoryService;

    /**
     * Upload AI-generated content (image, video, or audio)
     * POST /api/ai/upload
     *
     * The media type is automatically detected from the file's content type
     * Supported types:
     * - image/* -> MediaType.IMAGE
     * - video/* -> MediaType.VIDEO
     * - audio/* -> MediaType.AUDIO
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    @RecordActivity(
        entityType = EntityHistory.EntityType.VIDEO,
        action = EntityHistory.ActionType.VIDEO_UPLOAD,
        description = "AI 콘텐츠 업로드"
    )
    public ResponseEntity<?> uploadAIContent(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            // Get content type
            String contentType = file.getContentType();
            if (contentType == null || contentType.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Could not determine file type"));
            }

            log.info("Uploading AI-generated content: title={}, contentType={}, size={}",
                     title, contentType, file.getSize());

            // Determine media type from content type
            Video.MediaType mediaType;
            String actionDescription;

            if (contentType.startsWith("image/")) {
                mediaType = Video.MediaType.IMAGE;
                actionDescription = "AI 이미지 업로드";
            } else if (contentType.startsWith("video/")) {
                mediaType = Video.MediaType.VIDEO;
                actionDescription = "AI 영상 업로드";
            } else if (contentType.startsWith("audio/")) {
                mediaType = Video.MediaType.AUDIO;
                actionDescription = "AI 음성 업로드";
            } else {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Unsupported media type: " + contentType));
            }

            // Upload using VideoService with AI_GENERATED type
            Video video = videoService.uploadAIContent(file, user.getId(), title, description, mediaType);

            // Event recording is automatic via @RecordActivity annotation

            Map<String, Object> response = new HashMap<>();
            response.put("message", "AI content uploaded successfully");
            response.put("id", video.getId());
            response.put("title", video.getTitle());
            response.put("mediaType", mediaType.toString());
            response.put("video", video);

            log.info("AI content uploaded successfully: id={}, title={}, mediaType={}",
                     video.getId(), video.getTitle(), mediaType);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (IllegalArgumentException e) {
            log.error("Invalid AI content upload request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload AI content", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload AI content: " + e.getMessage()));
        }
    }
}
