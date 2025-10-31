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

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/audios")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:*"})
public class AudioController {

    private final VideoService videoService;
    private final UserRepository userRepository;
    private final EntityHistoryService entityHistoryService;

    /**
     * Upload audio file to S3 (audios/uploads/ folder)
     * POST /api/audios/upload
     *
     * @param file The audio file (MP3, WAV, etc.)
     * @param title The title of the audio
     * @param description Optional description
     * @param authentication Spring Security authentication object
     * @return ResponseEntity with upload result
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> uploadAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false, defaultValue = "") String description,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            log.info("Uploading audio: {} by user: {}", title, userEmail);

            Video audio = videoService.uploadAudio(file, user.getId(), title, description);

            // Record audio upload activity to entity history
            entityHistoryService.recordVideoActivity(
                    audio.getId(),
                    audio.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_UPLOAD,
                    "음성 업로드: " + audio.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Audio uploaded successfully");
            response.put("audio", audio);

            log.info("Audio uploaded successfully: ID={}, Title={}", audio.getId(), audio.getTitle());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid audio upload request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload audio: " + e.getMessage()));
        }
    }

    /**
     * Upload TTS audio file to S3 (audios/tts/ folder)
     * POST /api/audios/upload-tts
     *
     * @param file The audio file (MP3, WAV, etc.)
     * @param title The title of the audio
     * @param description Optional description
     * @param authentication Spring Security authentication object
     * @return ResponseEntity with upload result
     */
    @PostMapping("/upload-tts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> uploadTtsAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false, defaultValue = "") String description,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            log.info("Uploading TTS audio: {} by user: {}", title, userEmail);

            Video audio = videoService.uploadAudioTts(file, user.getId(), title, description);

            // Record TTS audio upload activity to entity history
            entityHistoryService.recordVideoActivity(
                    audio.getId(),
                    audio.getTitle(),
                    user,
                    EntityHistory.ActionType.VIDEO_UPLOAD,
                    "TTS 음성 업로드: " + audio.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "TTS audio uploaded successfully");
            response.put("audio", audio);

            log.info("TTS audio uploaded successfully: ID={}, Title={}", audio.getId(), audio.getTitle());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Invalid TTS audio upload request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload TTS audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload TTS audio: " + e.getMessage()));
        }
    }
}
