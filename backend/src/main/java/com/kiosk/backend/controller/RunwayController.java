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
            @RequestParam(value = "image1", required = false) MultipartFile image1,
            @RequestParam(value = "image2", required = false) MultipartFile image2,
            @RequestParam(value = "image1Url", required = false) String image1Url,
            @RequestParam(value = "image2Url", required = false) String image2Url,
            @RequestParam("prompt") String prompt,
            @RequestParam(value = "duration", defaultValue = "5") int duration,
            @RequestParam(value = "model", defaultValue = "gen3a_turbo") String model,
            @RequestParam(value = "resolution", defaultValue = "1280:768") String resolution
    ) {
        try {
            log.info("Received video generation request");

            // Validate that at least one source for each image is provided
            if ((image1 == null || image1.isEmpty()) && (image1Url == null || image1Url.isEmpty())) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("Image 1 is required (either file upload or URL)")
                        .build());
            }
            if ((image2 == null || image2.isEmpty()) && (image2Url == null || image2Url.isEmpty())) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("Image 2 is required (either file upload or URL)")
                        .build());
            }

            if (image1 != null && !image1.isEmpty()) {
                log.info("Image 1 (file): {}, size: {} bytes", image1.getOriginalFilename(), image1.getSize());
            } else {
                log.info("Image 1 (URL): {}", image1Url);
            }

            if (image2 != null && !image2.isEmpty()) {
                log.info("Image 2 (file): {}, size: {} bytes", image2.getOriginalFilename(), image2.getSize());
            } else {
                log.info("Image 2 (URL): {}", image2Url);
            }

            log.info("Prompt: {}", prompt);
            log.info("Duration: {} seconds", duration);
            log.info("Model: {}", model);
            log.info("Resolution: {}", resolution);

            // Generate video (images will be converted to base64 internally)
            Map<String, Object> result = runwayService.generateVideo(image1, image2, image1Url, image2Url, prompt, duration, model, resolution);

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

    @PostMapping("/generate-image")
    public ResponseEntity<RunwayVideoResponse> generateImage(
            @RequestParam(value = "images", required = false) MultipartFile[] images,
            @RequestParam(value = "imageUrls", required = false) String[] imageUrls,
            @RequestParam("prompt") String prompt,
            @RequestParam(value = "aspectRatio", defaultValue = "1:1") String aspectRatio
    ) {
        try {
            log.info("Received image generation request");
            log.info("Number of uploaded images: {}", images != null ? images.length : 0);
            log.info("Number of S3 image URLs: {}", imageUrls != null ? imageUrls.length : 0);
            log.info("Prompt: {}", prompt);
            log.info("Aspect Ratio: {}", aspectRatio);

            // Validate that at least one image source is provided
            if ((images == null || images.length == 0) && (imageUrls == null || imageUrls.length == 0)) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("At least one reference image is required")
                        .build());
            }

            // Log uploaded images
            if (images != null) {
                for (int i = 0; i < images.length; i++) {
                    if (images[i] != null && !images[i].isEmpty()) {
                        log.info("Uploaded Image {}: {}, size: {} bytes", i + 1, images[i].getOriginalFilename(), images[i].getSize());
                    }
                }
            }

            // Log S3 URLs
            if (imageUrls != null) {
                for (int i = 0; i < imageUrls.length; i++) {
                    if (imageUrls[i] != null && !imageUrls[i].isEmpty()) {
                        log.info("S3 Image URL {}: {}", i + 1, imageUrls[i]);
                    }
                }
            }

            // Generate image (images will be converted to base64 internally)
            Map<String, Object> result = runwayService.generateImage(images, imageUrls, prompt, aspectRatio);

            String taskId = (String) result.get("id");

            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(true)
                    .taskId(taskId)
                    .status("PENDING")
                    .message("Image generation task created successfully")
                    .build());

        } catch (Exception e) {
            log.error("Error generating image", e);
            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(false)
                    .message("Failed to generate image: " + e.getMessage())
                    .build());
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
