package com.kiosk.backend.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * Service for Google Veo 3.1 video generation.
 * Uses Google Generative AI REST API to create videos from prompts and images.
 *
 * Note: This is a placeholder implementation. The actual API endpoints and request format
 * will need to be updated based on Google's official Veo 3.1 API documentation.
 */
@Service
@Slf4j
public class VeoService {

    @Value("${google.ai.api.key:}")
    private String apiKey;

    @Value("${google.ai.api.url:https://generativelanguage.googleapis.com/v1beta}")
    private String apiUrl;

    @Value("${google.ai.veo.model:veo-3.1-generate-preview}")
    private String veoModel;

    @Value("${google.ai.veo.aspect.ratio:16:9}")
    private String defaultAspectRatio;

    @Value("${google.ai.veo.resolution:720p}")
    private String defaultResolution;

    @Value("${google.ai.veo.duration:8}")
    private String defaultDuration;

    @Value("${google.ai.veo.poll.interval:5000}")
    private int pollIntervalMs;

    @Value("${google.ai.veo.max.poll.attempts:60}")
    private int maxPollAttempts;

    private final RestTemplate restTemplate;
    private final S3Service s3Service;

    public VeoService(S3Service s3Service) {
        this.s3Service = s3Service;
        this.restTemplate = new RestTemplate();
    }

    @PostConstruct
    public void init() {
        String maskedKey = apiKey != null && apiKey.length() > 12
            ? apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length() - 4)
            : "NOT_SET";
        log.info("Google Veo API initialized with key: {}", maskedKey);
        log.info("Google Veo API URL: {}", apiUrl);
        log.info("Google Veo model: {}", veoModel);
        log.info("Poll interval: {}ms, Max attempts: {}", pollIntervalMs, maxPollAttempts);
    }

    /**
     * Generate video from text prompt only.
     *
     * @param prompt Text prompt for video generation
     * @param duration Video duration in seconds (5 or 8)
     * @param resolution Video resolution (720p or 1080p)
     * @return Video generation result
     */
    public VeoVideoResult generateVideoFromPrompt(String prompt, String duration, String resolution, String aspectRatio) throws IOException, InterruptedException {
        log.info("Generating video from prompt: {}", prompt);
        log.info("Duration: {}s, Resolution: {}, AspectRatio: {}", duration, resolution, aspectRatio);

        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("Google AI API key is not configured");
        }

        // Build instance object with prompt
        Map<String, Object> instance = new HashMap<>();
        instance.put("prompt", prompt);

        // Build parameters object
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("aspectRatio", aspectRatio);
        parameters.put("durationSeconds", Integer.parseInt(duration));
        parameters.put("resolution", resolution);

        // Submit video generation request
        String operationName = submitVideoGenerationRequest(instance, parameters);

        // Poll for result
        return pollForVideoResult(operationName);
    }

    /**
     * Generate video from prompt with first frame image.
     *
     * @param prompt Text prompt for video generation
     * @param firstFrame First frame image file
     * @param duration Video duration in seconds (5 or 8)
     * @param resolution Video resolution (720p or 1080p)
     * @return Video generation result
     */
    public VeoVideoResult generateVideoWithFirstFrame(String prompt, MultipartFile firstFrame, String duration, String resolution, String aspectRatio)
            throws IOException, InterruptedException {
        log.info("Generating video from prompt with first frame");
        log.info("Duration: {}s, Resolution: {}, AspectRatio: {}", duration, resolution, aspectRatio);

        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("Google AI API key is not configured");
        }

        // Convert image to base64
        String imageBase64 = Base64.getEncoder().encodeToString(firstFrame.getBytes());

        // Build instance object with prompt and image
        Map<String, Object> instance = new HashMap<>();
        instance.put("prompt", prompt);

        // Add image object
        Map<String, String> imageConfig = new HashMap<>();
        imageConfig.put("bytesBase64Encoded", imageBase64);
        imageConfig.put("mimeType", firstFrame.getContentType());
        instance.put("image", imageConfig);

        // Build parameters object
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("aspectRatio", aspectRatio);
        parameters.put("durationSeconds", Integer.parseInt(duration));
        parameters.put("resolution", resolution);

        // Submit video generation request
        String operationName = submitVideoGenerationRequest(instance, parameters);

        // Poll for result
        return pollForVideoResult(operationName);
    }

    /**
     * Generate video from prompt with first and last frame images (interpolation).
     *
     * @param prompt Text prompt for video generation
     * @param firstFrame First frame image file
     * @param lastFrame Last frame image file
     * @param duration Video duration in seconds (5 or 8)
     * @param resolution Video resolution (720p or 1080p)
     * @return Video generation result
     */
    public VeoVideoResult generateVideoWithInterpolation(String prompt, MultipartFile firstFrame, MultipartFile lastFrame, String duration, String resolution, String aspectRatio)
            throws IOException, InterruptedException {
        log.info("Generating video with interpolation (first and last frames)");
        log.info("Duration: {}s, Resolution: {}, AspectRatio: {}", duration, resolution, aspectRatio);

        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("Google AI API key is not configured");
        }

        // Convert images to base64
        String firstFrameBase64 = Base64.getEncoder().encodeToString(firstFrame.getBytes());
        String lastFrameBase64 = Base64.getEncoder().encodeToString(lastFrame.getBytes());

        // Build instance object with prompt and images
        Map<String, Object> instance = new HashMap<>();
        instance.put("prompt", prompt);

        // Add first frame image
        Map<String, String> firstFrameConfig = new HashMap<>();
        firstFrameConfig.put("bytesBase64Encoded", firstFrameBase64);
        firstFrameConfig.put("mimeType", firstFrame.getContentType());
        instance.put("image", firstFrameConfig);

        // Build parameters object
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("aspectRatio", aspectRatio);
        parameters.put("durationSeconds", Integer.parseInt(duration));
        parameters.put("resolution", resolution);

        // Submit video generation request
        String operationName = submitVideoGenerationRequest(instance, parameters);

        // Poll for result
        return pollForVideoResult(operationName);
    }

    /**
     * Submit video generation request to Google Veo API.
     *
     * @param instance Instance object containing prompt and optional images
     * @param parameters Parameters object for video settings
     * @return Operation name for polling
     */
    private String submitVideoGenerationRequest(Map<String, Object> instance, Map<String, Object> parameters) {
        // Build endpoint according to Gemini API spec
        String endpoint = apiUrl + "/models/" + veoModel + ":predictLongRunning";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Use x-goog-api-key header as per Gemini API spec
        headers.set("x-goog-api-key", apiKey);

        // Build request body with instances array
        Map<String, Object> requestBody = new HashMap<>();
        java.util.List<Map<String, Object>> instances = new java.util.ArrayList<>();
        instances.add(instance);
        requestBody.put("instances", instances);
        requestBody.put("parameters", parameters);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, request, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();

                // Extract operation name from response
                if (body.containsKey("name")) {
                    String operationName = (String) body.get("name");
                    log.info("Video generation operation submitted: {}", operationName);
                    return operationName;
                }
            }

            throw new RuntimeException("Failed to submit video generation request");
        } catch (Exception e) {
            log.error("Error submitting video generation request", e);
            throw new RuntimeException("Failed to submit video generation request: " + e.getMessage(), e);
        }
    }

    /**
     * Poll for video generation result.
     *
     * @param operationName Operation name to poll
     * @return Video generation result
     */
    private VeoVideoResult pollForVideoResult(String operationName) throws InterruptedException {
        // Build poll endpoint - operation name already includes the full path
        String pollEndpoint = apiUrl + "/" + operationName;

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-goog-api-key", apiKey);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        for (int attempt = 0; attempt < maxPollAttempts; attempt++) {
            try {
                ResponseEntity<Map> response = restTemplate.exchange(
                    pollEndpoint,
                    HttpMethod.GET,
                    request,
                    Map.class
                );

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Map<String, Object> body = response.getBody();

                    // Check if operation is done
                    if (Boolean.TRUE.equals(body.get("done"))) {
                        return parseVideoResponse(body, operationName);
                    }

                    log.info("Video generation in progress... (attempt {}/{})", attempt + 1, maxPollAttempts);
                }

                // Wait before next poll
                Thread.sleep(pollIntervalMs);
            } catch (Exception e) {
                log.error("Error polling for video result", e);
            }
        }

        // Timeout
        VeoVideoResult result = new VeoVideoResult();
        result.setSuccess(false);
        result.setMessage("Video generation timed out after " + maxPollAttempts + " attempts");
        result.setTaskId(operationName);
        return result;
    }

    /**
     * Parse video generation response.
     *
     * @param response API response
     * @param operationName Operation name
     * @return Parsed video result
     */
    private VeoVideoResult parseVideoResponse(Map<String, Object> response, String operationName) {
        VeoVideoResult result = new VeoVideoResult();
        result.setTaskId(operationName);

        // Log the entire response for debugging
        log.info("=== Full API Response ===");
        log.info("Response keys: {}", response.keySet());
        log.info("Full response: {}", response);

        // Check for errors first
        if (response.containsKey("error")) {
            result.setSuccess(false);
            Map<String, Object> error = (Map<String, Object>) response.get("error");
            String errorMessage = error.containsKey("message") ?
                (String) error.get("message") : "Unknown error";
            result.setMessage("Video generation failed: " + errorMessage);
            log.error("Video generation failed: {}", errorMessage);
            log.error("Error details: {}", error);
            return result;
        }

        // Extract video URL from response according to Gemini API spec
        // Response structure: response.generateVideoResponse.generatedSamples[0].video.uri
        if (response.containsKey("response")) {
            Map<String, Object> responseData = (Map<String, Object>) response.get("response");
            log.info("Response data keys: {}", responseData.keySet());
            log.info("Response data: {}", responseData);

            // Check for generateVideoResponse
            if (responseData.containsKey("generateVideoResponse")) {
                Map<String, Object> generateVideoResponse = (Map<String, Object>) responseData.get("generateVideoResponse");
                log.info("generateVideoResponse keys: {}", generateVideoResponse.keySet());

                if (generateVideoResponse.containsKey("generatedSamples")) {
                    java.util.List<Map<String, Object>> samples =
                        (java.util.List<Map<String, Object>>) generateVideoResponse.get("generatedSamples");
                    log.info("Generated samples count: {}", samples != null ? samples.size() : 0);

                    if (samples != null && !samples.isEmpty()) {
                        Map<String, Object> firstSample = samples.get(0);
                        log.info("First sample keys: {}", firstSample.keySet());
                        log.info("First sample data: {}", firstSample);

                        if (firstSample.containsKey("video")) {
                            Map<String, Object> video = (Map<String, Object>) firstSample.get("video");
                            log.info("Video object keys: {}", video.keySet());
                            log.info("Video object: {}", video);

                            if (video.containsKey("uri")) {
                                result.setVideoUrl((String) video.get("uri"));
                                result.setSuccess(true);
                                result.setMessage("Video generated successfully");
                                log.info("Video generation completed successfully: {}", result.getVideoUrl());
                                return result;
                            } else {
                                log.error("Video object does not contain 'uri' key. Available keys: {}", video.keySet());
                            }
                        } else {
                            log.error("First sample does not contain 'video' key. Available keys: {}", firstSample.keySet());
                        }
                    } else {
                        log.error("Generated samples list is null or empty");
                    }
                } else {
                    log.error("generateVideoResponse does not contain 'generatedSamples' key. Available keys: {}", generateVideoResponse.keySet());
                }
            } else {
                log.error("Response data does not contain 'generateVideoResponse' key. Available keys: {}", responseData.keySet());
            }
        } else {
            log.error("Response does not contain 'response' key. Available keys: {}", response.keySet());
        }

        // If we reach here, video URL was not found
        result.setSuccess(false);
        result.setMessage("Video URL not found in response");
        log.error("=== Video URL not found in response ===");
        log.error("Full response was: {}", response);
        return result;
    }

    /**
     * Download video stream from Google Veo URL with authentication.
     * This is used by the proxy endpoint to stream videos to frontend.
     *
     * @param videoUrl Google Veo video URL
     * @return InputStream of the video content
     */
    public java.io.InputStream downloadVideoStream(String videoUrl) throws IOException {
        log.info("=== Downloading video stream from Google Veo ===");
        log.info("Video URL: {}", videoUrl);

        if (apiKey == null || apiKey.isEmpty()) {
            log.error("Google AI API key is not configured!");
            throw new RuntimeException("Google AI API key is not configured");
        }

        String maskedKey = apiKey.length() > 12
            ? apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length() - 4)
            : "TOO_SHORT";
        log.info("Using API key: {}", maskedKey);

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-goog-api-key", apiKey);
        headers.set("User-Agent", "Kiosk-Backend/1.0");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        log.info("Request headers: {}", headers);

        try {
            log.info("Making GET request to Google Veo...");
            ResponseEntity<byte[]> response = restTemplate.exchange(
                videoUrl,
                HttpMethod.GET,
                request,
                byte[].class
            );

            log.info("Response status: {}", response.getStatusCode());
            log.info("Response headers: {}", response.getHeaders());

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.info("✅ Video downloaded successfully, size: {} bytes", response.getBody().length);
                return new java.io.ByteArrayInputStream(response.getBody());
            }

            log.error("❌ Failed to download video - status: {}", response.getStatusCode());
            throw new RuntimeException("Failed to download video from Google Veo - status: " + response.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("❌ HTTP Client Error: {} {}", e.getStatusCode(), e.getStatusText());
            log.error("Response body: {}", e.getResponseBodyAsString());
            throw new IOException("HTTP " + e.getStatusCode() + ": " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("❌ Error downloading video stream", e);
            log.error("Exception type: {}", e.getClass().getName());
            log.error("Exception message: {}", e.getMessage());
            throw new IOException("Failed to download video: " + e.getMessage(), e);
        }
    }

    /**
     * Video generation result DTO
     */
    public static class VeoVideoResult {
        private boolean success;
        private String message;
        private String videoUrl;
        private String taskId;

        public boolean isSuccess() {
            return success;
        }

        public void setSuccess(boolean success) {
            this.success = success;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getVideoUrl() {
            return videoUrl;
        }

        public void setVideoUrl(String videoUrl) {
            this.videoUrl = videoUrl;
        }

        public String getTaskId() {
            return taskId;
        }

        public void setTaskId(String taskId) {
            this.taskId = taskId;
        }
    }
}
