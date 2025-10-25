package com.kiosk.backend.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class RunwayService {

    @Value("${runway.api.key:key_51795ced3da73579936a7ac67742b9f42e5d62e77673ccdf33ecb52af57dda1a37206045addb88294a3bc97849a7506b666b8901c49e6b9782ab1712df06a232}")
    private String apiKey;

    @Value("${runway.api.url:https://api.runwayml.com/v1}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final S3Service s3Service;

    public RunwayService(S3Service s3Service) {
        this.s3Service = s3Service;
    }

    @PostConstruct
    public void init() {
        // Log the API key being used (masked for security)
        String maskedKey = apiKey != null && apiKey.length() > 12
            ? apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length() - 4)
            : "NOT_SET";
        log.info("Runway API initialized with key: {}", maskedKey);
        log.info("Runway API URL: {}", apiUrl);
    }

    /**
     * Convert image to base64
     */
    private String imageToBase64(MultipartFile file) throws Exception {
        byte[] imageBytes = file.getBytes();
        return java.util.Base64.getEncoder().encodeToString(imageBytes);
    }

    /**
     * Extract S3 key from S3 URL
     * @param s3Url S3 URL (e.g., https://bucket.s3.region.amazonaws.com/path/to/file)
     * @return S3 key (e.g., path/to/file)
     */
    private String extractS3KeyFromUrl(String s3Url) {
        try {
            // URL format: https://bucket.s3.region.amazonaws.com/path/to/file
            // or: https://bucket.s3.amazonaws.com/path/to/file
            java.net.URI uri = new java.net.URI(s3Url);
            String path = uri.getPath();
            // Remove leading slash
            if (path.startsWith("/")) {
                path = path.substring(1);
            }
            return path;
        } catch (Exception e) {
            log.error("Failed to extract S3 key from URL: {}", s3Url, e);
            throw new RuntimeException("Invalid S3 URL: " + s3Url);
        }
    }

    /**
     * Download image from S3 URL using S3Service
     */
    private byte[] downloadImageFromS3Url(String s3Url) throws Exception {
        log.info("Downloading image from S3 URL: {}", s3Url);
        String s3Key = extractS3KeyFromUrl(s3Url);
        log.info("Extracted S3 key: {}", s3Key);

        byte[] imageBytes = s3Service.downloadFile(s3Key);
        if (imageBytes == null || imageBytes.length == 0) {
            throw new RuntimeException("Failed to download image from S3: " + s3Url);
        }
        log.info("Downloaded {} bytes from S3", imageBytes.length);
        return imageBytes;
    }

    /**
     * Adjust image aspect ratio by adding padding (Runway ML requires 0.5 to 2.0)
     */
    private byte[] adjustImageAspectRatio(java.awt.image.BufferedImage image) throws Exception {
        if (image == null) {
            throw new RuntimeException("Failed to read image: image is null. The file may be corrupted or not a valid image format.");
        }

        int width = image.getWidth();
        int height = image.getHeight();
        double aspectRatio = (double) width / height;

        log.info("Original image aspect ratio: {} ({}x{})", aspectRatio, width, height);

        // If already within acceptable range, return original
        if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(image, "png", baos);
            return baos.toByteArray();
        }

        // Calculate new dimensions with padding
        int canvasWidth, canvasHeight;
        int drawX, drawY;

        if (aspectRatio < 0.5) {
            // Too tall (narrow) - add padding on left and right
            double targetRatio = 0.7;
            canvasHeight = height;
            canvasWidth = (int) (canvasHeight * targetRatio);
            drawX = (canvasWidth - width) / 2;
            drawY = 0;
        } else {
            // Too wide - add padding on top and bottom
            double targetRatio = 1.5;
            canvasWidth = width;
            canvasHeight = (int) (canvasWidth / targetRatio);
            drawX = 0;
            drawY = (canvasHeight - height) / 2;
        }

        // Create new image with padding
        java.awt.image.BufferedImage paddedImage = new java.awt.image.BufferedImage(
            canvasWidth, canvasHeight, java.awt.image.BufferedImage.TYPE_INT_RGB
        );

        java.awt.Graphics2D g2d = paddedImage.createGraphics();

        // Fill background with black
        g2d.setColor(java.awt.Color.BLACK);
        g2d.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw original image centered
        g2d.drawImage(image, drawX, drawY, null);
        g2d.dispose();

        double newAspectRatio = (double) canvasWidth / canvasHeight;
        log.info("Adjusted image aspect ratio (padding added): {} → {} ({}x{})",
                 aspectRatio, newAspectRatio, canvasWidth, canvasHeight);

        // Convert to byte array
        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(paddedImage, "png", baos);
        return baos.toByteArray();
    }

    /**
     * Generate video using Runway API with configurable model and resolution
     * Models and their constraints:
     * - veo3: duration must be 8, resolution: 1280:720, 720:1280, 1080:1920, 1920:1080
     * - veo3.1: duration must be 4, 6, or 8, resolution: 1280:720, 720:1280, 1080:1920, 1920:1080
     * - veo3.1_fast: duration must be 4, 6, or 8, resolution: 1280:720, 720:1280, 1080:1920, 1920:1080
     * - gen3a_turbo: duration must be 5 or 10, ratio: 1280:768, 768:1280
     * - gen4_turbo: duration must be 2-10, ratio: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672
     */
    public Map<String, Object> generateVideo(MultipartFile image1, MultipartFile image2, String image1Url, String image2Url, String prompt, int duration, String model, String resolution) {
        log.info("Generating video with Runway");
        log.info("Model: {}", model);
        log.info("Prompt: {}", prompt);
        log.info("Duration: {} seconds", duration);
        log.info("Resolution: {}", resolution);

        try {
            // Process image 1
            java.awt.image.BufferedImage bufferedImage1;
            if (image1 != null && !image1.isEmpty()) {
                log.info("Image 1 from file: {}", image1.getOriginalFilename());
                bufferedImage1 = javax.imageio.ImageIO.read(image1.getInputStream());
                if (bufferedImage1 == null) {
                    throw new RuntimeException("Failed to read first image: " + image1.getOriginalFilename() + ". The file may be corrupted or not a valid image format.");
                }
            } else {
                log.info("Image 1 from URL: {}", image1Url);
                byte[] imageBytes = downloadImageFromS3Url(image1Url);
                java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(imageBytes);
                bufferedImage1 = javax.imageio.ImageIO.read(bais);
                if (bufferedImage1 == null) {
                    throw new RuntimeException("Failed to read image from URL: " + image1Url + ". The image may be corrupted or not a valid image format.");
                }
            }

            // Process image 2
            java.awt.image.BufferedImage bufferedImage2;
            if (image2 != null && !image2.isEmpty()) {
                log.info("Image 2 from file: {}", image2.getOriginalFilename());
                bufferedImage2 = javax.imageio.ImageIO.read(image2.getInputStream());
                if (bufferedImage2 == null) {
                    throw new RuntimeException("Failed to read second image: " + image2.getOriginalFilename() + ". The file may be corrupted or not a valid image format.");
                }
            } else {
                log.info("Image 2 from URL: {}", image2Url);
                byte[] imageBytes = downloadImageFromS3Url(image2Url);
                java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(imageBytes);
                bufferedImage2 = javax.imageio.ImageIO.read(bais);
                if (bufferedImage2 == null) {
                    throw new RuntimeException("Failed to read image from URL: " + image2Url + ". The image may be corrupted or not a valid image format.");
                }
            }

            byte[] adjustedImage1 = adjustImageAspectRatio(bufferedImage1);
            byte[] adjustedImage2 = adjustImageAspectRatio(bufferedImage2);

            // Convert images to base64
            String image1Base64 = "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(adjustedImage1);
            String image2Base64 = "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(adjustedImage2);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);
            headers.set("X-Runway-Version", "2024-11-06");

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", model);
            requestBody.put("promptText", prompt);
            requestBody.put("duration", duration);

            // All models use promptImage as the starting frame
            requestBody.put("promptImage", image1Base64);

            // Add the second image as lastFrame
            requestBody.put("lastFrame", image2Base64);
            log.info("DEBUG: Added promptImage (first image) and lastFrame (second image)");

            // All models use "ratio" parameter (e.g., "16:9" or "1280:720")
            requestBody.put("ratio", resolution);
            log.info("DEBUG: Using ratio parameter for all models: {}", resolution);

            log.info("DEBUG: Final request body keys: {}", requestBody.keySet());

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    apiUrl + "/v1/image_to_video",
                    HttpMethod.POST,
                    requestEntity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.info("Video generation task created successfully");
                return response.getBody();
            } else {
                throw new RuntimeException("Failed to create video generation task: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Error generating video with Runway", e);
            throw new RuntimeException("Video generation failed: " + e.getMessage());
        }
    }

    /**
     * Check video generation task status
     */
    public Map<String, Object> getTaskStatus(String taskId) {
        log.info("Checking task status: {}", taskId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("X-Runway-Version", "2024-11-06");

        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    apiUrl + "/v1/tasks/" + taskId,
                    HttpMethod.GET,
                    requestEntity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.info("DEBUG: Task status response body: {}", response.getBody());
                return response.getBody();
            } else {
                throw new RuntimeException("Failed to get task status: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Error getting task status from Runway", e);
            throw new RuntimeException("Failed to get task status: " + e.getMessage());
        }
    }

    /**
     * Generate image using Runway gen4_image model
     * Supports multiple reference images (up to 5)
     * Reference images can be mentioned in prompt using @tag syntax
     *
     * @param images Array of reference images (1-5 images)
     * @param prompt Text prompt describing the image to generate
     * @param aspectRatio Aspect ratio (e.g., "16:9", "1:1", "9:16")
     * @return Task information including task ID
     */
    public Map<String, Object> generateImage(MultipartFile[] images, String[] imageUrls, String prompt, String aspectRatio) {
        log.info("Generating image with Runway gen4_image model");
        log.info("Number of uploaded reference images: {}", images != null ? images.length : 0);
        log.info("Number of S3 reference image URLs: {}", imageUrls != null ? imageUrls.length : 0);
        log.info("Prompt: {}", prompt);
        log.info("Aspect Ratio: {}", aspectRatio);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);
            headers.set("X-Runway-Version", "2024-11-06");

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", "gen4_image");
            requestBody.put("promptText", prompt);
            requestBody.put("ratio", aspectRatio);

            // Add reference images as array of objects with uri and tag
            List<Map<String, String>> referenceImages = new ArrayList<>();
            int imageCounter = 1;

            // Process uploaded files
            if (images != null) {
                for (int i = 0; i < images.length; i++) {
                    if (images[i] != null && !images[i].isEmpty()) {
                        // Adjust aspect ratio by adding padding if needed
                        java.awt.image.BufferedImage bufferedImage = javax.imageio.ImageIO.read(images[i].getInputStream());
                        if (bufferedImage == null) {
                            throw new RuntimeException("Failed to read uploaded image " + (i + 1) + ": " + images[i].getOriginalFilename() + ". The file may be corrupted or not a valid image format.");
                        }
                        byte[] adjustedImageBytes = adjustImageAspectRatio(bufferedImage);

                        String imageBase64 = "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(adjustedImageBytes);
                        String tag = "image" + imageCounter++;

                        Map<String, String> imageObj = new HashMap<>();
                        imageObj.put("uri", imageBase64);
                        imageObj.put("tag", tag);

                        referenceImages.add(imageObj);
                        log.info("Added uploaded reference image with tag: @{}", tag);
                    }
                }
            }

            // Process S3 URLs
            if (imageUrls != null) {
                for (int i = 0; i < imageUrls.length; i++) {
                    if (imageUrls[i] != null && !imageUrls[i].isEmpty()) {
                        byte[] imageBytes = downloadImageFromS3Url(imageUrls[i]);

                        // Adjust aspect ratio by adding padding if needed
                        java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(imageBytes);
                        java.awt.image.BufferedImage bufferedImage = javax.imageio.ImageIO.read(bais);
                        if (bufferedImage == null) {
                            throw new RuntimeException("Failed to read image from URL " + (i + 1) + ": " + imageUrls[i] + ". The image may be corrupted or not a valid image format.");
                        }
                        byte[] adjustedImageBytes = adjustImageAspectRatio(bufferedImage);

                        String imageBase64 = "data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(adjustedImageBytes);
                        String tag = "image" + imageCounter++;

                        Map<String, String> imageObj = new HashMap<>();
                        imageObj.put("uri", imageBase64);
                        imageObj.put("tag", tag);

                        referenceImages.add(imageObj);
                        log.info("Added S3 reference image with tag: @{}", tag);
                    }
                }
            }

            if (!referenceImages.isEmpty()) {
                requestBody.put("referenceImages", referenceImages);
            }

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

            log.info("Sending image generation request to Runway API");
            ResponseEntity<Map> response = restTemplate.exchange(
                    apiUrl + "/v1/text_to_image",
                    HttpMethod.POST,
                    requestEntity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.info("Image generation task created successfully");
                log.info("Task ID: {}", response.getBody().get("id"));
                return response.getBody();
            } else {
                throw new RuntimeException("Failed to create image generation task: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Error generating image with Runway", e);
            throw new RuntimeException("Image generation failed: " + e.getMessage());
        }
    }

    /**
     * Test API key by making a simple request to Runway API
     */
    public Map<String, Object> testApiKey() {
        log.info("Testing Runway API key...");

        String maskedKey = apiKey != null && apiKey.length() > 12
            ? apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length() - 4)
            : "NOT_SET";

        Map<String, Object> result = new HashMap<>();
        result.put("apiKeyMasked", maskedKey);
        result.put("apiUrl", apiUrl);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("X-Runway-Version", "2024-11-06");

        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        try {
            // Try to list tasks (simple GET request that should work with valid API key)
            ResponseEntity<Map> response = restTemplate.exchange(
                    apiUrl + "/v1/tasks?limit=1",
                    HttpMethod.GET,
                    requestEntity,
                    Map.class
            );

            result.put("status", "SUCCESS");
            result.put("statusCode", response.getStatusCode().value());
            result.put("message", "API key is valid and working");
            result.put("response", response.getBody());
            log.info("API key test successful");

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            result.put("status", "FAILED");
            result.put("statusCode", e.getStatusCode().value());
            result.put("error", e.getStatusText());
            result.put("message", "API key test failed: " + e.getMessage());
            log.error("API key test failed with status {}: {}", e.getStatusCode(), e.getMessage());
        } catch (Exception e) {
            result.put("status", "ERROR");
            result.put("error", e.getMessage());
            result.put("message", "Unexpected error during API key test");
            log.error("API key test error", e);
        }

        return result;
    }
}
