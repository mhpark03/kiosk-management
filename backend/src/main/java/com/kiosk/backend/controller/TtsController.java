package com.kiosk.backend.controller;

import com.kiosk.backend.entity.Audio;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.repository.UserRepository;
import com.kiosk.backend.service.EntityHistoryService;
import com.kiosk.backend.service.TtsService;
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
@RequestMapping("/api/tts")
@RequiredArgsConstructor
@Slf4j
public class TtsController {

    private final TtsService ttsService;
    private final UserRepository userRepository;
    private final EntityHistoryService entityHistoryService;

    /**
     * Upload audio file
     * POST /api/tts/upload
     */
    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> uploadAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            log.info("Uploading audio file: name={}, size={}, type={}",
                    file.getOriginalFilename(), file.getSize(), file.getContentType());

            Audio audio = ttsService.uploadAudio(file, title, description, user.getId());

            // Record activity
            entityHistoryService.recordVideoActivity(
                    audio.getId(),
                    audio.getTitle(),
                    user,
                    com.kiosk.backend.entity.EntityHistory.ActionType.CREATE,
                    "음성 파일 업로드: " + audio.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Audio uploaded successfully");
            response.put("audio", audio);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (IllegalArgumentException e) {
            log.error("Invalid upload request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload audio: " + e.getMessage()));
        }
    }

    /**
     * Generate audio from text using Google Cloud TTS
     * POST /api/tts/generate
     */
    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> generateAudio(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            // Extract parameters
            String text = (String) request.get("text");
            String title = (String) request.get("title");
            String description = (String) request.get("description");
            String languageCode = (String) request.getOrDefault("languageCode", "ko-KR");
            String voiceName = (String) request.getOrDefault("voiceName", "ko-KR-Standard-A");
            String genderStr = (String) request.getOrDefault("gender", "FEMALE");
            Double speakingRate = request.containsKey("speakingRate")
                    ? Double.valueOf(request.get("speakingRate").toString())
                    : 1.0;
            Double pitch = request.containsKey("pitch")
                    ? Double.valueOf(request.get("pitch").toString())
                    : 0.0;

            // Validate
            Audio.VoiceGender gender;
            try {
                gender = Audio.VoiceGender.valueOf(genderStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                gender = Audio.VoiceGender.FEMALE;
            }

            log.info("Generating audio: text length={}, voice={}, language={}",
                    text != null ? text.length() : 0, voiceName, languageCode);

            Audio audio = ttsService.generateAudio(
                    text, title, description, languageCode, voiceName,
                    gender, speakingRate, pitch, user.getId()
            );

            // Record activity
            entityHistoryService.recordVideoActivity(
                    audio.getId(),
                    audio.getTitle(),
                    user,
                    com.kiosk.backend.entity.EntityHistory.ActionType.CREATE,
                    "TTS 음성 생성: " + audio.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Audio generated successfully");
            response.put("audio", audio);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (IllegalArgumentException e) {
            log.error("Invalid TTS request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to generate audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate audio: " + e.getMessage()));
        }
    }

    /**
     * Get all audios
     * GET /api/tts
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllAudios() {
        try {
            List<Audio> audios = ttsService.getAllAudios();
            return ResponseEntity.ok(audios);
        } catch (Exception e) {
            log.error("Failed to fetch audios", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch audios: " + e.getMessage()));
        }
    }

    /**
     * Get audio by ID
     * GET /api/tts/{id}
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAudioById(@PathVariable Long id) {
        try {
            Audio audio = ttsService.getAudioById(id);
            return ResponseEntity.ok(audio);
        } catch (RuntimeException e) {
            log.error("Audio not found: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to fetch audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch audio: " + e.getMessage()));
        }
    }

    /**
     * Get audios by user
     * GET /api/tts/user/{userId}
     */
    @GetMapping("/user/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAudiosByUser(@PathVariable Long userId) {
        try {
            List<Audio> audios = ttsService.getAudiosByUser(userId);
            return ResponseEntity.ok(audios);
        } catch (Exception e) {
            log.error("Failed to fetch user audios", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch user audios: " + e.getMessage()));
        }
    }

    /**
     * Update audio metadata (title, description)
     * PUT /api/tts/{id}
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateAudio(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            String title = request.get("title");
            String description = request.get("description");

            if (title == null || title.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
            }

            log.info("Updating audio {}: title={}", id, title);

            Audio audio = ttsService.updateAudio(id, title, description);

            // Record activity
            entityHistoryService.recordVideoActivity(
                    audio.getId(),
                    audio.getTitle(),
                    user,
                    com.kiosk.backend.entity.EntityHistory.ActionType.UPDATE,
                    "음성 정보 수정: " + audio.getTitle()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Audio updated successfully");
            response.put("audio", audio);

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            log.error("Audio not found: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to update audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update audio: " + e.getMessage()));
        }
    }

    /**
     * Delete audio
     * DELETE /api/tts/{id}
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteAudio(
            @PathVariable Long id,
            Authentication authentication) {
        try {
            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

            Audio audio = ttsService.getAudioById(id);

            // Record activity before deletion
            entityHistoryService.recordVideoActivity(
                    audio.getId(),
                    audio.getTitle(),
                    user,
                    com.kiosk.backend.entity.EntityHistory.ActionType.DELETE,
                    "음성 삭제: " + audio.getTitle()
            );

            ttsService.deleteAudio(id);

            return ResponseEntity.ok(Map.of("message", "Audio deleted successfully"));

        } catch (RuntimeException e) {
            log.error("Audio not found: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to delete audio", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete audio: " + e.getMessage()));
        }
    }
}
