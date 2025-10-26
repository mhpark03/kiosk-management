package com.kiosk.backend.controller;

import com.kiosk.backend.dto.RunwayVideoResponse;
import com.kiosk.backend.service.VeoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;

/**
 * Controller for Google Veo 3.1 video generation.
 * Provides endpoints for text-to-video, image-to-video with first frame, and interpolation.
 */
@RestController
@RequestMapping("/api/veo")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class VeoController {

    private final VeoService veoService;

    /**
     * Generate video from text prompt only.
     *
     * @param prompt Text description of the video to generate
     * @param duration Video duration in seconds (5 or 8)
     * @param resolution Video resolution (720p or 1080p)
     * @return Response containing task ID and status
     */
    @PostMapping("/generate-from-prompt")
    public ResponseEntity<RunwayVideoResponse> generateVideoFromPrompt(
            @RequestParam("prompt") String prompt,
            @RequestParam(value = "duration", required = false, defaultValue = "4") String duration,
            @RequestParam(value = "resolution", required = false, defaultValue = "720p") String resolution,
            @RequestParam(value = "aspectRatio", required = false, defaultValue = "16:9") String aspectRatio
    ) {
        try {
            log.info("Received Veo text-to-video request");
            log.info("Prompt: {}", prompt);
            log.info("Duration: {}s, Resolution: {}, AspectRatio: {}", duration, resolution, aspectRatio);

            if (prompt == null || prompt.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("Prompt is required")
                        .build());
            }

            VeoService.VeoVideoResult result = veoService.generateVideoFromPrompt(prompt, duration, resolution, aspectRatio);

            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(result.isSuccess())
                    .taskId(result.getTaskId())
                    .videoUrl(result.getVideoUrl())
                    .status(result.isSuccess() ? "COMPLETED" : "FAILED")
                    .message(result.getMessage())
                    .build());

        } catch (Exception e) {
            log.error("Error generating video from prompt", e);
            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(false)
                    .message("Failed to generate video: " + e.getMessage())
                    .build());
        }
    }

    /**
     * Generate video from prompt with first frame image.
     *
     * @param prompt Text description of the video to generate
     * @param firstFrame First frame image file
     * @param duration Video duration in seconds (5 or 8)
     * @param resolution Video resolution (720p or 1080p)
     * @return Response containing task ID and status
     */
    @PostMapping("/generate-with-first-frame")
    public ResponseEntity<RunwayVideoResponse> generateVideoWithFirstFrame(
            @RequestParam("prompt") String prompt,
            @RequestParam("firstFrame") MultipartFile firstFrame,
            @RequestParam(value = "duration", required = false, defaultValue = "4") String duration,
            @RequestParam(value = "resolution", required = false, defaultValue = "720p") String resolution,
            @RequestParam(value = "aspectRatio", required = false, defaultValue = "16:9") String aspectRatio
    ) {
        try {
            log.info("Received Veo video generation with first frame request");
            log.info("Prompt: {}", prompt);
            log.info("First frame: {}, size: {} bytes", firstFrame.getOriginalFilename(), firstFrame.getSize());
            log.info("Duration: {}s, Resolution: {}, AspectRatio: {}", duration, resolution, aspectRatio);

            if (prompt == null || prompt.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("Prompt is required")
                        .build());
            }

            if (firstFrame == null || firstFrame.isEmpty()) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("First frame image is required")
                        .build());
            }

            VeoService.VeoVideoResult result = veoService.generateVideoWithFirstFrame(prompt, firstFrame, duration, resolution, aspectRatio);

            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(result.isSuccess())
                    .taskId(result.getTaskId())
                    .videoUrl(result.getVideoUrl())
                    .status(result.isSuccess() ? "COMPLETED" : "FAILED")
                    .message(result.getMessage())
                    .build());

        } catch (Exception e) {
            log.error("Error generating video with first frame", e);
            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(false)
                    .message("Failed to generate video: " + e.getMessage())
                    .build());
        }
    }

    /**
     * Generate video with interpolation (first and last frames).
     *
     * @param prompt Text description of the video to generate
     * @param firstFrame First frame image file
     * @param lastFrame Last frame image file
     * @param duration Video duration in seconds (5 or 8)
     * @param resolution Video resolution (720p or 1080p)
     * @return Response containing task ID and status
     */
    @PostMapping("/generate-with-interpolation")
    public ResponseEntity<RunwayVideoResponse> generateVideoWithInterpolation(
            @RequestParam("prompt") String prompt,
            @RequestParam("firstFrame") MultipartFile firstFrame,
            @RequestParam("lastFrame") MultipartFile lastFrame,
            @RequestParam(value = "duration", required = false, defaultValue = "4") String duration,
            @RequestParam(value = "resolution", required = false, defaultValue = "720p") String resolution,
            @RequestParam(value = "aspectRatio", required = false, defaultValue = "16:9") String aspectRatio
    ) {
        try {
            log.info("Received Veo video generation with interpolation request");
            log.info("Prompt: {}", prompt);
            log.info("First frame: {}, size: {} bytes", firstFrame.getOriginalFilename(), firstFrame.getSize());
            log.info("Last frame: {}, size: {} bytes", lastFrame.getOriginalFilename(), lastFrame.getSize());
            log.info("Duration: {}s, Resolution: {}, AspectRatio: {}", duration, resolution, aspectRatio);

            if (prompt == null || prompt.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("Prompt is required")
                        .build());
            }

            if (firstFrame == null || firstFrame.isEmpty()) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("First frame image is required")
                        .build());
            }

            if (lastFrame == null || lastFrame.isEmpty()) {
                return ResponseEntity.badRequest().body(RunwayVideoResponse.builder()
                        .success(false)
                        .message("Last frame image is required")
                        .build());
            }

            VeoService.VeoVideoResult result = veoService.generateVideoWithInterpolation(
                    prompt, firstFrame, lastFrame, duration, resolution, aspectRatio);

            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(result.isSuccess())
                    .taskId(result.getTaskId())
                    .videoUrl(result.getVideoUrl())
                    .status(result.isSuccess() ? "COMPLETED" : "FAILED")
                    .message(result.getMessage())
                    .build());

        } catch (Exception e) {
            log.error("Error generating video with interpolation", e);
            return ResponseEntity.ok(RunwayVideoResponse.builder()
                    .success(false)
                    .message("Failed to generate video: " + e.getMessage())
                    .build());
        }
    }

    /**
     * Proxy endpoint to stream Veo video with authentication.
     * This allows frontend to play videos that require Google API authentication.
     *
     * @param videoUrl The Google Veo video URL
     * @return Video stream response
     */
    @GetMapping("/proxy-video")
    public ResponseEntity<InputStreamResource> proxyVideo(@RequestParam("url") String videoUrl) {
        try {
            log.info("=== Veo Proxy Video Request ===");
            log.info("Received URL: {}", videoUrl);

            // Use VeoService to download video with authentication
            InputStream videoStream = veoService.downloadVideoStream(videoUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("video/mp4"));
            headers.set("Accept-Ranges", "bytes");
            headers.setCacheControl("no-cache, no-store, must-revalidate");

            log.info("✅ Successfully proxying video stream");
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new InputStreamResource(videoStream));

        } catch (Exception e) {
            log.error("❌ Error proxying video", e);
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            return ResponseEntity.status(500).body(null);
        }
    }
}
