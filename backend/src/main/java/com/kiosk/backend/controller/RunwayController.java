package com.kiosk.backend.controller;

import com.kiosk.backend.dto.RunwayVideoResponse;
import com.kiosk.backend.service.RunwayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/runway")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class RunwayController {

    private final RunwayService runwayService;

    @PostMapping("/generate-video")
    public ResponseEntity<RunwayVideoResponse> generateVideo(
            @RequestParam("image1") MultipartFile image1,
            @RequestParam("image2") MultipartFile image2,
            @RequestParam("prompt") String prompt,
            @RequestParam(value = "duration", defaultValue = "5") int duration,
            @RequestParam(value = "model", defaultValue = "gen3a_turbo") String model,
            @RequestParam(value = "resolution", defaultValue = "1280:768") String resolution
    ) {
        try {
            log.info("Received video generation request");
            log.info("Image 1: {}, size: {} bytes", image1.getOriginalFilename(), image1.getSize());
            log.info("Image 2: {}, size: {} bytes", image2.getOriginalFilename(), image2.getSize());
            log.info("Prompt: {}", prompt);
            log.info("Duration: {} seconds", duration);
            log.info("Model: {}", model);
            log.info("Resolution: {}", resolution);

            // Generate video (images will be converted to base64 internally)
            Map<String, Object> result = runwayService.generateVideo(image1, image2, prompt, duration, model, resolution);

            String taskId = (String) result.get("id");

            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(true)
                    .taskId(taskId)
                    .status("PENDING")
                    .message("Video generation task created successfully")
                    .build());

        } catch (Exception e) {
            log.error("Error generating video", e);
            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(false)
                    .message("Failed to generate video: " + e.getMessage())
                    .build());
        }
    }

    @GetMapping("/task-status/{taskId}")
    public ResponseEntity<Map<String, Object>> getTaskStatus(@PathVariable String taskId) {
        try {
            log.info("Checking task status: {}", taskId);
            Map<String, Object> status = runwayService.getTaskStatus(taskId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            log.error("Error getting task status", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/test-api-key")
    public ResponseEntity<Map<String, Object>> testApiKey() {
        try {
            log.info("Testing Runway API key");
            Map<String, Object> result = runwayService.testApiKey();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error testing API key", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
