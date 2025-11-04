package com.kiosk.backend.service;

import com.kiosk.backend.entity.User;
import com.kiosk.backend.entity.Video;
import com.kiosk.backend.repository.KioskVideoRepository;
import com.kiosk.backend.repository.UserRepository;
import com.kiosk.backend.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;

@Service
@Slf4j
public class VideoService {

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final KioskVideoRepository kioskVideoRepository;
    private final S3Service s3Service;

    public VideoService(VideoRepository videoRepository, UserRepository userRepository,
                       KioskVideoRepository kioskVideoRepository,
                       S3Service s3Service) {
        this.videoRepository = videoRepository;
        this.userRepository = userRepository;
        this.kioskVideoRepository = kioskVideoRepository;
        this.s3Service = s3Service;
    }

    // S3 folder structure
    private static final String VIDEO_UPLOAD_FOLDER = "videos/uploads/";
    private static final String VIDEO_RUNWAY_FOLDER = "videos/runway/";
    private static final String VIDEO_AI_FOLDER = "videos/ai/";
    private static final String IMAGE_UPLOAD_FOLDER = "images/uploads/";
    private static final String IMAGE_RUNWAY_FOLDER = "images/runway/";
    private static final String IMAGE_AI_FOLDER = "images/ai/";
    private static final String AUDIO_UPLOAD_FOLDER = "audios/uploads/";
    private static final String AUDIO_TTS_FOLDER = "audios/tts/";
    private static final String AUDIO_AI_FOLDER = "audios/ai/";
    private static final String THUMBNAIL_UPLOAD_FOLDER = "thumbnails/uploads/";
    private static final String THUMBNAIL_RUNWAY_FOLDER = "thumbnails/runway/";
    private static final String THUMBNAIL_AI_FOLDER = "thumbnails/ai/";
    private static final long MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

    // Database column length limits
    private static final int MAX_TITLE_LENGTH = 255;
    private static final int MAX_FILENAME_LENGTH = 255;

    /**
     * Truncate string to maximum length if needed
     */
    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        if (value.length() <= maxLength) {
            return value;
        }
        log.warn("Truncating string from {} to {} characters: {}", value.length(), maxLength, value.substring(0, Math.min(50, value.length())) + "...");
        return value.substring(0, maxLength);
    }
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "video/mp4",
            "video/mpeg",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-ms-wmv",
            "video/webm",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/bmp",
            "image/svg+xml"
    );

    /**
     * Generate a thumbnail from a video file
     * @param videoFile Video file to extract thumbnail from
     * @return Byte array of the thumbnail image (JPEG), or null if failed
     */
    private byte[] generateThumbnail(MultipartFile videoFile) {
        Path tempVideoPath = null;
        Path tempThumbnailPath = null;

        try {
            // Create temporary files
            String originalFilename = videoFile.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".mp4";

            tempVideoPath = Files.createTempFile("video_", extension);
            tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

            // Save uploaded video to temp file
            videoFile.transferTo(tempVideoPath.toFile());

            // Use FFmpeg to extract thumbnail at 1 second
            // Use -loglevel error to minimize output and prevent buffer issues
            ProcessBuilder processBuilder = new ProcessBuilder(
                "ffmpeg",
                "-loglevel", "error",  // Only output errors, drastically reduces output
                "-i", tempVideoPath.toString(),
                "-ss", "00:00:01.000",
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                tempThumbnailPath.toString()
            );

            // Discard stdout/stderr to prevent buffer blocking
            processBuilder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            processBuilder.redirectError(ProcessBuilder.Redirect.DISCARD);

            Process process = processBuilder.start();

            // Wait for FFmpeg process with 30 second timeout
            boolean completed = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);

            if (!completed) {
                log.warn("FFmpeg thumbnail generation timed out after 30 seconds");
                process.destroyForcibly();
                return null;
            }

            int exitCode = process.exitValue();

            if (exitCode == 0 && Files.exists(tempThumbnailPath)) {
                byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);
                log.info("Thumbnail generated successfully, size: {} bytes", thumbnailBytes.length);
                return thumbnailBytes;
            } else {
                log.warn("FFmpeg failed to generate thumbnail, exit code: {}", exitCode);
                return null;
            }
        } catch (Exception e) {
            log.error("Failed to generate thumbnail: {}", e.getMessage());
            return null;
        } finally {
            // Clean up temporary files
            try {
                if (tempVideoPath != null && Files.exists(tempVideoPath)) {
                    Files.delete(tempVideoPath);
                }
                if (tempThumbnailPath != null && Files.exists(tempThumbnailPath)) {
                    Files.delete(tempThumbnailPath);
                }
            } catch (IOException e) {
                log.error("Failed to delete temporary files: {}", e.getMessage());
            }
        }
    }

    /**
     * Generate a thumbnail from video bytes
     * This version accepts byte array instead of MultipartFile to avoid InputStream exhaustion
     * @param videoBytes Video file bytes
     * @param originalFilename Original filename for extension detection
     * @return Byte array of the thumbnail image (JPEG), or null if failed
     */
    private byte[] generateThumbnailFromBytes(byte[] videoBytes, String originalFilename) {
        Path tempVideoPath = null;
        Path tempThumbnailPath = null;

        try {
            // Create temporary files
            String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".mp4";

            tempVideoPath = Files.createTempFile("video_", extension);
            tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

            // Write bytes to temp file
            Files.write(tempVideoPath, videoBytes);
            log.info("Video bytes written to temp file: {} ({} bytes)", tempVideoPath, videoBytes.length);

            // Use FFmpeg to extract thumbnail at 1 second
            // Use -loglevel error to minimize output and prevent buffer issues
            ProcessBuilder processBuilder = new ProcessBuilder(
                "ffmpeg",
                "-loglevel", "error",  // Only output errors, drastically reduces output
                "-i", tempVideoPath.toString(),
                "-ss", "00:00:01.000",
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                tempThumbnailPath.toString()
            );

            // Discard stdout/stderr to prevent buffer blocking
            processBuilder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            processBuilder.redirectError(ProcessBuilder.Redirect.DISCARD);

            Process process = processBuilder.start();
            log.info("FFmpeg process started for thumbnail generation");

            // Wait for FFmpeg process with 30 second timeout
            boolean completed = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);

            if (!completed) {
                log.warn("FFmpeg thumbnail generation timed out after 30 seconds");
                process.destroyForcibly();
                return null;
            }

            int exitCode = process.exitValue();
            log.info("FFmpeg process completed with exit code: {}", exitCode);

            if (exitCode == 0 && Files.exists(tempThumbnailPath)) {
                byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);
                log.info("Thumbnail generated successfully, size: {} bytes", thumbnailBytes.length);
                return thumbnailBytes;
            } else {
                log.warn("FFmpeg failed to generate thumbnail, exit code: {}", exitCode);
                return null;
            }
        } catch (Exception e) {
            log.error("Failed to generate thumbnail from bytes: {}", e.getMessage(), e);
            return null;
        } finally {
            // Clean up temporary files
            try {
                if (tempVideoPath != null && Files.exists(tempVideoPath)) {
                    Files.delete(tempVideoPath);
                }
                if (tempThumbnailPath != null && Files.exists(tempThumbnailPath)) {
                    Files.delete(tempThumbnailPath);
                }
            } catch (IOException e) {
                log.error("Failed to delete temporary files: {}", e.getMessage());
            }
        }
    }

    /**
     * Upload a video file to S3 and save metadata to database
     * @param file Video file to upload
     * @param uploadedById User ID of the user uploading the video
     * @param title Title of the video
     * @param description Optional description of the video
     * @return Saved Video entity
     */
    @Transactional
    public Video uploadVideo(MultipartFile file, Long uploadedById, String title, String description) throws IOException {
        // Validate file
        validateFile(file);

        // Validate title and description
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("Description is required");
        }

        // Check for duplicate by original filename
        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null && videoRepository.existsByOriginalFilename(originalFilename)) {
            log.warn("Duplicate video file detected: {}", originalFilename);
            throw new IllegalArgumentException("동일한 파일명의 영상이 이미 업로드되어 있습니다: " + originalFilename);
        }

        // Determine mediaType based on contentType
        String contentType = file.getContentType();
        Video.MediaType mediaType = Video.MediaType.VIDEO; // default
        if (contentType != null && contentType.toLowerCase().startsWith("image/")) {
            mediaType = Video.MediaType.IMAGE;
        }

        // Read file bytes ONCE to avoid MultipartFile InputStream exhaustion
        // MultipartFile.getInputStream() can only be read once, so we need to cache the bytes
        byte[] fileBytes = file.getBytes();
        log.info("File bytes cached: {} bytes", fileBytes.length);

        // Generate thumbnail BEFORE S3 upload (using cached bytes)
        byte[] thumbnailBytes = null;
        try {
            // For images, use the original image as thumbnail
            if (mediaType == Video.MediaType.IMAGE) {
                thumbnailBytes = fileBytes;
                log.info("Using original image as thumbnail");
            } else {
                // For videos, generate thumbnail using FFmpeg
                log.info("Generating thumbnail from video bytes...");
                thumbnailBytes = generateThumbnailFromBytes(fileBytes, file.getOriginalFilename());
                if (thumbnailBytes != null) {
                    log.info("Thumbnail generated successfully: {} bytes", thumbnailBytes.length);
                } else {
                    log.warn("Thumbnail generation returned null");
                }
            }
        } catch (Exception e) {
            log.error("Failed to generate thumbnail, continuing without thumbnail: {}", e.getMessage(), e);
            thumbnailBytes = null;
        }

        // Upload video file to S3 (uploads folder)
        log.info("Uploading file to S3...");
        String s3Key = s3Service.uploadFile(file, VIDEO_UPLOAD_FOLDER);
        String s3Url = s3Service.getFileUrl(s3Key);
        log.info("File uploaded to S3: {}", s3Key);

        // Upload thumbnail to S3 if generated
        String thumbnailS3Key = null;
        String thumbnailUrl = null;
        if (thumbnailBytes != null) {
            try {
                // Remove file extension and add _thumb with appropriate extension
                String filenameWithExt = extractFilename(s3Key);
                int lastDotIndex = filenameWithExt.lastIndexOf(".");
                String filenameWithoutExt = (lastDotIndex > 0)
                    ? filenameWithExt.substring(0, lastDotIndex)
                    : filenameWithExt;
                String extension = (mediaType == Video.MediaType.IMAGE)
                    ? filenameWithExt.substring(lastDotIndex)
                    : ".jpg";
                String thumbnailFilename = filenameWithoutExt + "_thumb" + extension;

                String thumbContentType = (mediaType == Video.MediaType.IMAGE)
                    ? contentType
                    : "image/jpeg";
                thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, THUMBNAIL_UPLOAD_FOLDER, thumbnailFilename, thumbContentType);
                thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);
            } catch (Exception e) {
                log.error("Failed to upload thumbnail to S3, continuing without thumbnail: {}", e.getMessage(), e);
            }
        }

        // Save metadata to database with UPLOAD type
        log.info("Saving video metadata to database...");
        Video video = Video.builder()
                .videoType(Video.VideoType.UPLOAD)
                .mediaType(mediaType)
                .filename(truncate(extractFilename(s3Key), MAX_FILENAME_LENGTH))
                .originalFilename(truncate(file.getOriginalFilename(), MAX_FILENAME_LENGTH))
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .s3Key(s3Key)
                .s3Url(s3Url)
                .thumbnailS3Key(thumbnailS3Key)
                .thumbnailUrl(thumbnailUrl)
                .uploadedById(uploadedById)
                .title(truncate(title, MAX_TITLE_LENGTH))
                .description(description) // TEXT column - no limit
                .build();

        Video savedVideo = videoRepository.save(video);
        log.info("Video uploaded successfully: {} (ID: {}) by user ID {}", savedVideo.getOriginalFilename(), savedVideo.getId(), uploadedById);

        return savedVideo;
    }

    /**
