package com.kiosk.backend.service;

import com.kiosk.backend.entity.KioskVideo;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.entity.Video;
import com.kiosk.backend.repository.KioskVideoRepository;
import com.kiosk.backend.repository.UserRepository;
import com.kiosk.backend.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
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
    private static final String VIDEO_AI_FOLDER = "videos/ai/";
    private static final String IMAGE_UPLOAD_FOLDER = "images/uploads/";
    private static final String IMAGE_AI_FOLDER = "images/ai/";
    private static final String AUDIO_UPLOAD_FOLDER = "audios/uploads/";
    private static final String AUDIO_AI_FOLDER = "audios/ai/";
    private static final String DOCUMENT_FOLDER = "documents/";
    private static final String THUMBNAIL_UPLOAD_FOLDER = "thumbnails/uploads/";
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
            "image/svg+xml",
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/wave",
            "audio/x-wav",
            "audio/aac",
            "audio/ogg",
            "audio/webm",
            "audio/flac",
            "text/xml",
            "application/xml"
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
     * @param imagePurpose Purpose of the image (only applies to images)
     * @return Saved Video entity
     */
    @Transactional
    public Video uploadVideo(MultipartFile file, Long uploadedById, String title, String description, Video.ImagePurpose imagePurpose) throws IOException {
        // Validate file
        validateFile(file);

        // Validate title and description
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("Description is required");
        }

        // Determine mediaType based on contentType (BEFORE duplicate check for better error message)
        String contentType = file.getContentType();
        Video.MediaType mediaType = Video.MediaType.VIDEO; // default
        if (contentType != null) {
            String lowerContentType = contentType.toLowerCase();
            if (lowerContentType.startsWith("image/")) {
                mediaType = Video.MediaType.IMAGE;
            } else if (lowerContentType.startsWith("audio/")) {
                mediaType = Video.MediaType.AUDIO;
            } else if (lowerContentType.contains("xml")) {
                mediaType = Video.MediaType.DOCUMENT;
            }
        }

        // Check for duplicate by original filename (with media-type-specific error message)
        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null && videoRepository.existsByOriginalFilename(originalFilename)) {
            String mediaTypeKorean = switch (mediaType) {
                case VIDEO -> "영상";
                case IMAGE -> "이미지";
                case AUDIO -> "음성";
                case DOCUMENT -> "문서";
            };
            log.warn("Duplicate {} file detected: {}", mediaTypeKorean, originalFilename);
            throw new IllegalArgumentException(
                String.format("동일한 파일명의 %s이 이미 업로드되어 있습니다: %s", mediaTypeKorean, originalFilename)
            );
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
            } else if (mediaType == Video.MediaType.VIDEO) {
                // For videos, generate thumbnail using FFmpeg
                log.info("Generating thumbnail from video bytes...");
                thumbnailBytes = generateThumbnailFromBytes(fileBytes, file.getOriginalFilename());
                if (thumbnailBytes != null) {
                    log.info("Thumbnail generated successfully: {} bytes", thumbnailBytes.length);
                } else {
                    log.warn("Thumbnail generation returned null");
                }
            } else {
                // For audio and documents, no thumbnail needed
                log.info("{} file detected, skipping thumbnail generation", mediaType);
            }
        } catch (Exception e) {
            log.error("Failed to generate thumbnail, continuing without thumbnail: {}", e.getMessage(), e);
            thumbnailBytes = null;
        }

        // Determine S3 folder based on media type
        String s3Folder = switch (mediaType) {
            case VIDEO -> VIDEO_UPLOAD_FOLDER;
            case IMAGE -> IMAGE_UPLOAD_FOLDER;
            case AUDIO -> AUDIO_UPLOAD_FOLDER;
            case DOCUMENT -> DOCUMENT_FOLDER;
        };

        // Upload file to S3 (appropriate folder based on media type)
        log.info("Uploading {} file to S3 folder: {}", mediaType, s3Folder);
        String s3Key = s3Service.uploadFile(file, s3Folder);
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

        // IMAGE and DOCUMENT types are always downloadable
        // VIDEO type uses downloadable flag to distinguish between REFERENCE (edit-only) and downloadable
        boolean isDownloadable = (mediaType == Video.MediaType.IMAGE || mediaType == Video.MediaType.DOCUMENT);

        Video.VideoBuilder videoBuilder = Video.builder()
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
                .downloadable(isDownloadable); // Auto-set for IMAGE and DOCUMENT

        // Set imagePurpose if provided (for any media type, including XML files)
        if (imagePurpose != null) {
            videoBuilder.imagePurpose(imagePurpose);
        }

        log.info("Media type: {}, Auto-downloadable: {}", mediaType, isDownloadable);

        Video video = videoBuilder.build();

        Video savedVideo = videoRepository.save(video);
        log.info("Video uploaded successfully: {} (ID: {}) by user ID {}", savedVideo.getOriginalFilename(), savedVideo.getId(), uploadedById);

        // If this is a menu XML file, extract imageIds and mark them as downloadable
        if (mediaType == Video.MediaType.DOCUMENT && imagePurpose == Video.ImagePurpose.MENU) {
            try {
                markMenuImagesAsDownloadable(fileBytes);
            } catch (Exception e) {
                log.error("Failed to mark menu images as downloadable: {}", e.getMessage(), e);
                // Don't fail the upload, just log the error
            }
        }

        return savedVideo;
    }

    /**
     * Upload AI-generated content (image, video, or audio) to S3
     * @param file AI-generated content file
     * @param uploadedById User ID who uploaded the content
     * @param title Title of the content
     * @param description Description of the content
     * @param mediaType Media type (IMAGE, VIDEO, or AUDIO)
     * @param imagePurpose Purpose of the image (only applies to images)
     * @return Saved Video entity with AI_GENERATED type
     * @throws IOException if upload fails
     */
    public Video uploadAIContent(MultipartFile file, Long uploadedById, String title, String description, Video.MediaType mediaType, Video.ImagePurpose imagePurpose) throws IOException {
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
            log.warn("Duplicate AI content file detected: {}", originalFilename);
            throw new IllegalArgumentException("동일한 파일명의 콘텐츠가 이미 업로드되어 있습니다: " + originalFilename);
        }

        // Determine S3 folder based on media type
        String s3Folder;
        String thumbnailFolder;
        switch (mediaType) {
            case IMAGE:
                s3Folder = IMAGE_AI_FOLDER;
                thumbnailFolder = THUMBNAIL_AI_FOLDER;
                break;
            case VIDEO:
                s3Folder = VIDEO_AI_FOLDER;
                thumbnailFolder = THUMBNAIL_AI_FOLDER;
                break;
            case AUDIO:
                s3Folder = AUDIO_AI_FOLDER;
                thumbnailFolder = null; // No thumbnails for audio
                break;
            case DOCUMENT:
                s3Folder = DOCUMENT_FOLDER;
                thumbnailFolder = null; // No thumbnails for documents
                break;
            default:
                throw new IllegalArgumentException("Unsupported media type: " + mediaType);
        }

        // Read file bytes ONCE to avoid MultipartFile InputStream exhaustion
        byte[] fileBytes = file.getBytes();
        log.info("AI content file bytes cached: {} bytes", fileBytes.length);

        // Generate thumbnail BEFORE S3 upload (for images and videos only)
        byte[] thumbnailBytes = null;
        if (thumbnailFolder != null) {
            try {
                // For images, use the original image as thumbnail
                if (mediaType == Video.MediaType.IMAGE) {
                    thumbnailBytes = fileBytes;
                    log.info("Using original image as thumbnail for AI content");
                } else if (mediaType == Video.MediaType.VIDEO) {
                    // For videos, generate thumbnail using FFmpeg
                    log.info("Generating thumbnail from AI video bytes...");
                    thumbnailBytes = generateThumbnailFromBytes(fileBytes, file.getOriginalFilename());
                    if (thumbnailBytes != null) {
                        log.info("AI video thumbnail generated successfully: {} bytes", thumbnailBytes.length);
                    } else {
                        log.warn("AI video thumbnail generation returned null");
                    }
                }
            } catch (Exception e) {
                log.error("Failed to generate AI content thumbnail, continuing without thumbnail: {}", e.getMessage(), e);
                thumbnailBytes = null;
            }
        }

        // Upload content to S3
        log.info("Uploading AI content to S3...");
        String s3Key = s3Service.uploadFile(file, s3Folder);
        String s3Url = s3Service.getFileUrl(s3Key);
        log.info("AI content uploaded to S3: {}", s3Key);

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
                    ? file.getContentType()
                    : "image/jpeg";
                thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, thumbnailFolder, thumbnailFilename, thumbContentType);
                thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                log.info("AI content thumbnail uploaded successfully: {}", thumbnailS3Key);
            } catch (Exception e) {
                log.error("Failed to upload AI content thumbnail to S3, continuing without thumbnail: {}", e.getMessage(), e);
            }
        }

        // Save metadata to database with AI_GENERATED type
        log.info("Saving AI content metadata to database...");
        Video.VideoBuilder videoBuilder = Video.builder()
                .videoType(Video.VideoType.AI_GENERATED)
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
                .description(description); // TEXT column - no limit

        // Set imagePurpose if provided (for any media type, including XML files)
        if (imagePurpose != null) {
            videoBuilder.imagePurpose(imagePurpose);
        }

        Video video = videoBuilder.build();

        Video savedVideo = videoRepository.save(video);
        log.info("AI-generated {} uploaded successfully: {} (ID: {}) by user ID {}", mediaType, savedVideo.getOriginalFilename(), savedVideo.getId(), uploadedById);

        return savedVideo;
    }

    /**
     * Save Runway-generated image from URL to S3 and database
     * @param imageUrl URL of the generated image
     * @param uploadedById User ID who generated the image
     * @param title Title of the image
     * @param description Description of the image
     * @param imagePurpose Purpose of the image (GENERAL, REFERENCE, MENU)
     * @return Saved Video entity
     */
    @Transactional
    public Video saveRunwayImage(String imageUrl, Long uploadedById, String title, String description, Video.ImagePurpose imagePurpose) throws IOException {
        // Validate inputs
        if (imageUrl == null || imageUrl.trim().isEmpty()) {
            throw new IllegalArgumentException("Image URL is required");
        }
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }

        log.info("Downloading Runway-generated image from URL: {}", imageUrl);

        // Download image from URL
        byte[] imageBytes;
        String contentType = "image/png"; // Default for Runway images
        long fileSize;
        try {
            java.net.URL url = new java.net.URL(imageUrl);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(30000); // 30 seconds
            connection.setReadTimeout(30000);

            int responseCode = connection.getResponseCode();
            if (responseCode != 200) {
                throw new IOException("Failed to download image from URL. HTTP status: " + responseCode);
            }

            // Get content type from response
            String responseContentType = connection.getContentType();
            if (responseContentType != null && !responseContentType.isEmpty()) {
                contentType = responseContentType;
            }

            // Read image bytes
            imageBytes = connection.getInputStream().readAllBytes();
            fileSize = imageBytes.length;
            connection.disconnect();

            log.info("Image downloaded successfully: {} bytes, contentType: {}", fileSize, contentType);
        } catch (Exception e) {
            log.error("Failed to download image from URL: {}", imageUrl, e);
            throw new IOException("Failed to download image from URL: " + e.getMessage());
        }

        // Generate filename
        String timestamp = String.valueOf(System.currentTimeMillis());
        String extension = contentType.contains("png") ? ".png" : ".jpg";
        String filename = "runway_" + timestamp + extension;

        // Upload image to S3 (AI folder since it's AI-generated)
        log.info("Uploading Runway image to S3...");
        String s3Key = s3Service.uploadBytes(imageBytes, IMAGE_AI_FOLDER, filename, contentType);
        String s3Url = s3Service.getFileUrl(s3Key);
        log.info("Image uploaded to S3: {}", s3Key);

        // For images, use the original image as thumbnail
        String thumbnailFilename = filename.replace(extension, "_thumb" + extension);
        String thumbnailS3Key = s3Service.uploadBytes(imageBytes, THUMBNAIL_AI_FOLDER, thumbnailFilename, contentType);
        String thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
        log.info("Thumbnail uploaded to S3: {}", thumbnailS3Key);

        // Save metadata to database with AI_GENERATED type
        log.info("Saving Runway image metadata to database...");
        Video.VideoBuilder videoBuilder = Video.builder()
                .videoType(Video.VideoType.AI_GENERATED)
                .mediaType(Video.MediaType.IMAGE)
                .filename(truncate(filename, MAX_FILENAME_LENGTH))
                .originalFilename(truncate(filename, MAX_FILENAME_LENGTH))
                .fileSize(fileSize)
                .contentType(contentType)
                .s3Key(s3Key)
                .s3Url(s3Url)
                .thumbnailS3Key(thumbnailS3Key)
                .thumbnailUrl(thumbnailUrl)
                .uploadedById(uploadedById)
                .title(truncate(title, MAX_TITLE_LENGTH))
                .description(description != null ? description : ""); // TEXT column - no limit

        // Set imagePurpose if provided, default to GENERAL
        if (imagePurpose != null) {
            videoBuilder.imagePurpose(imagePurpose);
        } else {
            videoBuilder.imagePurpose(Video.ImagePurpose.GENERAL);
        }

        Video video = videoBuilder.build();
        Video savedVideo = videoRepository.save(video);
        log.info("Runway image saved successfully: {} (ID: {}) by user ID {}", savedVideo.getFilename(), savedVideo.getId(), uploadedById);

        return savedVideo;
    }

    /**
     * Get all videos ordered by upload date (newest first)
     * Includes kiosk assignment statistics
     * @return List of all videos with kiosk statistics
     */
    public List<Video> getAllVideos() {
        List<Video> videos = videoRepository.findAllByOrderByUploadedAtDesc();

        // Calculate kiosk assignment statistics for each video
        for (Video video : videos) {
            List<KioskVideo> kioskVideos = kioskVideoRepository.findByVideoId(video.getId());
            video.setAssignedKioskCount(kioskVideos.size());

            long downloadedCount = kioskVideos.stream()
                    .filter(kv -> "COMPLETED".equalsIgnoreCase(kv.getDownloadStatus()))
                    .count();
            video.setDownloadedKioskCount((int) downloadedCount);
        }

        return videos;
    }

    /**
     * Get videos by type
     * @param videoType Type of video (UPLOAD or RUNWAY_GENERATED)
     * @return List of videos of the specified type
     */
    public List<Video> getVideosByType(Video.VideoType videoType) {
        return videoRepository.findByVideoTypeOrderByUploadedAtDesc(videoType);
    }

    /**
     * Get videos uploaded by a specific user
     * @param userId ID of the user
     * @return List of videos uploaded by the user
     */
    public List<Video> getVideosByUser(Long userId) {
        return videoRepository.findByUploadedByIdOrderByUploadedAtDesc(userId);
    }

    /**
     * Get videos by user and type
     * @param userId ID of the user
     * @param videoType Type of video (UPLOAD or RUNWAY_GENERATED)
     * @return List of videos uploaded by the user of the specified type
     */
    public List<Video> getVideosByUserAndType(Long userId, Video.VideoType videoType) {
        return videoRepository.findByUploadedByIdAndVideoTypeOrderByUploadedAtDesc(userId, videoType);
    }

    /**
     * Get a video by ID (Cached for performance)
     * @param id Video ID
     * @return Video entity
     */
    @Cacheable(cacheNames = "videos", key = "#id")
    public Video getVideoById(Long id) {
        return videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video not found with id: " + id));
    }

    /**
     * Download video file content from S3
     * @param id Video ID
     * @return File content as byte array
     */
    public byte[] downloadVideoFile(Long id) {
        Video video = getVideoById(id);
        return s3Service.downloadFile(video.getS3Key());
    }

    /**
     * Generate a presigned URL for video playback/download
     * @param id Video ID
     * @param durationMinutes Duration in minutes for which the URL is valid
     * @return Presigned URL
     */
    public String generatePresignedUrl(Long id, int durationMinutes) {
        Video video = getVideoById(id);
        return s3Service.generatePresignedUrl(video.getS3Key(), durationMinutes);
    }

    /**
     * Generate a presigned URL for thumbnail
     * @param id Video ID
     * @param durationMinutes Duration in minutes for which the URL is valid
     * @return Presigned URL for thumbnail
     */
    public String generateThumbnailPresignedUrl(Long id, int durationMinutes) {
        Video video = getVideoById(id);
        if (video.getThumbnailS3Key() == null || video.getThumbnailS3Key().isEmpty()) {
            return null;
        }
        return s3Service.generatePresignedUrl(video.getThumbnailS3Key(), durationMinutes);
    }

    /**
     * Delete a video (both from S3 and database)
     * @param id Video ID
     * @param requestingUserId ID of the user requesting deletion
     */
    @Transactional
    @CacheEvict(cacheNames = "videos", key = "#id")
    public void deleteVideo(Long id, Long requestingUserId) {
        Video video = getVideoById(id);

        // Get requesting user
        User requestingUser = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + requestingUserId));

        // Check if user has permission to delete
        // ADMIN can delete any video, regular users can only delete their own
        if (requestingUser.getRole() != User.UserRole.ADMIN &&
            !video.getUploadedById().equals(requestingUserId)) {
            log.warn("User ID {} attempted to delete video {} owned by user ID {}",
                    requestingUserId, id, video.getUploadedById());
            throw new RuntimeException("You don't have permission to delete this video");
        }

        // Delete kiosk-video mappings first
        try {
            kioskVideoRepository.deleteByVideoId(id);
            log.info("Deleted kiosk-video mappings for video ID: {}", id);
        } catch (Exception e) {
            log.error("Failed to delete kiosk-video mappings for video ID: {}", id, e);
            throw new RuntimeException("Failed to delete kiosk-video mappings", e);
        }

        // Delete from S3
        try {
            s3Service.deleteFile(video.getS3Key());
        } catch (Exception e) {
            log.error("Failed to delete file from S3: {}", video.getS3Key(), e);
            throw new RuntimeException("Failed to delete video file from storage", e);
        }

        // Delete thumbnail from S3 if exists
        if (video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
            try {
                s3Service.deleteFile(video.getThumbnailS3Key());
                log.info("Deleted thumbnail from S3: {}", video.getThumbnailS3Key());
            } catch (Exception e) {
                log.warn("Failed to delete thumbnail from S3: {}", video.getThumbnailS3Key(), e);
                // Don't throw exception for thumbnail deletion failure
            }
        }

        // Delete from database
        videoRepository.deleteById(id);
        log.info("Video deleted successfully: {} by user ID {}", video.getOriginalFilename(), requestingUserId);
    }

    /**
     * Update video title and description
     * @param id Video ID
     * @param title New title (optional)
     * @param description New description (optional)
     * @param requestingUserId ID of the user requesting update
     * @return Updated Video entity
     */
    @Transactional
    @CacheEvict(cacheNames = "videos", key = "#id")
    public Video updateVideo(Long id, String title, String description, String imagePurpose, Long requestingUserId) {
        Video video = getVideoById(id);

        // Get requesting user
        User requestingUser = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + requestingUserId));

        // Check if user has permission to update
        // ADMIN can update any video, regular users can only update their own
        if (requestingUser.getRole() != User.UserRole.ADMIN &&
            !video.getUploadedById().equals(requestingUserId)) {
            log.warn("User ID {} attempted to update video {} owned by user ID {}",
                    requestingUserId, id, video.getUploadedById());
            throw new RuntimeException("You don't have permission to update this video");
        }

        if (title != null) {
            video.setTitle(truncate(title, MAX_TITLE_LENGTH));
        }
        if (description != null) {
            video.setDescription(description); // TEXT column - no limit
        }
        if (imagePurpose != null) {
            try {
                Video.ImagePurpose purpose = Video.ImagePurpose.valueOf(imagePurpose);
                video.setImagePurpose(purpose);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid imagePurpose value: {}", imagePurpose);
            }
        }
        Video updatedVideo = videoRepository.save(video);
        log.info("Video updated: {} by user ID {}", id, requestingUserId);

        return updatedVideo;
    }

    /**
     * Update video description (backward compatibility)
     * @param id Video ID
     * @param description New description
     * @param requestingUserId ID of the user requesting update
     * @return Updated Video entity
     * @deprecated Use updateVideo instead
     */
    @Deprecated
    @Transactional
    public Video updateDescription(Long id, String description, Long requestingUserId) {
        return updateVideo(id, null, description, null, requestingUserId);
    }

    /**
     * Update video downloadable flag
     * @param id Video ID
     * @param downloadable Whether video can be downloaded to kiosks
     * @param requestingUserId ID of the user requesting update
     * @return Updated Video entity
     */
    @Transactional
    public Video updateDownloadable(Long id, Boolean downloadable, Long requestingUserId) {
        Video video = getVideoById(id);

        // Get requesting user
        User requestingUser = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + requestingUserId));

        // Check if user has permission to update
        // ADMIN can update any video, regular users can only update their own
        if (requestingUser.getRole() != User.UserRole.ADMIN &&
            !video.getUploadedById().equals(requestingUserId)) {
            log.warn("User ID {} attempted to update video {} owned by user ID {}",
                    requestingUserId, id, video.getUploadedById());
            throw new RuntimeException("You don't have permission to update this video");
        }

        video.setDownloadable(downloadable);
        Video updatedVideo = videoRepository.save(video);
        log.info("Video downloadable flag updated to {} for video {} by user ID {}", downloadable, id, requestingUserId);

        return updatedVideo;
    }

    /**
     * Regenerate thumbnail for a video
     * @param id Video ID
     * @param requestingUserId ID of the user requesting regeneration
     * @return Updated Video entity with new thumbnail
     */
    @Transactional
    public Video regenerateThumbnail(Long id, Long requestingUserId) {
        Video video = getVideoById(id);

        // Get requesting user
        User requestingUser = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + requestingUserId));

        // Check if user has permission to regenerate thumbnail
        // ADMIN can regenerate any video thumbnail, regular users can only regenerate their own
        if (requestingUser.getRole() != User.UserRole.ADMIN &&
            !video.getUploadedById().equals(requestingUserId)) {
            log.warn("User ID {} attempted to regenerate thumbnail for video {} owned by user ID {}",
                    requestingUserId, id, video.getUploadedById());
            throw new RuntimeException("You don't have permission to regenerate thumbnail for this video");
        }

        // Check if the file is an audio file (cannot generate thumbnail from audio)
        String contentType = video.getContentType();
        if (contentType != null && contentType.toLowerCase().startsWith("audio/")) {
            log.warn("Cannot generate thumbnail for audio file: {}", video.getOriginalFilename());
            throw new RuntimeException("Cannot generate thumbnail for audio files");
        }

        // Check if the file is an image (use the original image as thumbnail instead)
        if (video.getMediaType() == Video.MediaType.IMAGE) {
            log.info("Video ID {} is an image, using original as thumbnail", id);
            try {
                // Download image from S3
                byte[] imageBytes = s3Service.downloadFile(video.getS3Key());

                // Delete old thumbnail from S3 if exists
                if (video.getThumbnailS3Key() != null) {
                    try {
                        s3Service.deleteFile(video.getThumbnailS3Key());
                    } catch (Exception e) {
                        log.warn("Failed to delete old thumbnail from S3: {}", video.getThumbnailS3Key(), e);
                    }
                }

                // Upload new thumbnail to S3 (same as original for images)
                String filenameWithExt = extractFilename(video.getS3Key());
                int lastDotIndex = filenameWithExt.lastIndexOf(".");
                String filenameWithoutExt = (lastDotIndex > 0)
                    ? filenameWithExt.substring(0, lastDotIndex)
                    : filenameWithExt;
                String extension = (lastDotIndex > 0) ? filenameWithExt.substring(lastDotIndex) : ".jpg";
                String thumbnailFilename = filenameWithoutExt + "_thumb" + extension;

                String thumbnailS3Key = s3Service.uploadBytes(imageBytes, THUMBNAIL_UPLOAD_FOLDER, thumbnailFilename, contentType);
                String thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);

                // Update video entity
                video.setThumbnailS3Key(thumbnailS3Key);
                video.setThumbnailUrl(thumbnailUrl);

                Video updatedVideo = videoRepository.save(video);
                log.info("Thumbnail regenerated successfully for image: {} by user ID {}", id, requestingUserId);
                return updatedVideo;
            } catch (Exception e) {
                log.error("Failed to regenerate thumbnail for image: {}", id, e);
                throw new RuntimeException("Failed to regenerate thumbnail: " + e.getMessage());
            }
        }

        try {
            // Download video from S3
            byte[] videoBytes = s3Service.downloadFile(video.getS3Key());

            // Create temp file for video with proper extension
            String extension = video.getOriginalFilename() != null && video.getOriginalFilename().contains(".")
                ? video.getOriginalFilename().substring(video.getOriginalFilename().lastIndexOf("."))
                : ".mp4";

            Path tempVideoPath = Files.createTempFile("video_", extension);
            Files.write(tempVideoPath, videoBytes);

            // Generate new thumbnail
            Path tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

            // Convert paths to absolute strings for FFmpeg (Windows-compatible)
            // Use forward slashes for FFmpeg compatibility on Windows
            String videoPathStr = tempVideoPath.toAbsolutePath().toString().replace("\\", "/");
            String thumbnailPathStr = tempThumbnailPath.toAbsolutePath().toString().replace("\\", "/");

            log.info("Regenerating thumbnail - Video path: {}, Thumbnail path: {}", videoPathStr, thumbnailPathStr);

            // Use -loglevel error to minimize output and prevent buffer issues
            ProcessBuilder processBuilder = new ProcessBuilder(
                "ffmpeg",
                "-loglevel", "error",  // Only output errors
                "-ss", "00:00:00.100",  // Seek to 0.1 second (works better for short videos)
                "-i", videoPathStr,
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-q:v", "2",  // High quality JPEG (scale 2-31, 2 is best)
                "-y",
                thumbnailPathStr
            );

            // Capture stderr to log FFmpeg errors
            processBuilder.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            Process process = processBuilder.start();

            // Capture stderr for error logging
            StringBuilder errorOutput = new StringBuilder();
            try (java.io.BufferedReader errorReader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getErrorStream()))) {
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorOutput.append(line).append("\n");
                }
            }

            // Wait for FFmpeg process with 30 second timeout
            boolean completed = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);

            if (!completed) {
                log.warn("FFmpeg thumbnail regeneration timed out after 30 seconds");
                process.destroyForcibly();
                throw new RuntimeException("FFmpeg thumbnail regeneration timed out");
            }

            int exitCode = process.exitValue();

            if (exitCode != 0 || !Files.exists(tempThumbnailPath)) {
                String errorMsg = errorOutput.toString().trim();
                log.error("FFmpeg failed - Exit code: {}, Thumbnail exists: {}, Error output: {}",
                         exitCode, Files.exists(tempThumbnailPath), errorMsg);
                throw new RuntimeException("Failed to generate thumbnail with FFmpeg, exit code: " + exitCode +
                                         (errorMsg.isEmpty() ? "" : ", error: " + errorMsg));
            }

            byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);

            // Delete old thumbnail from S3 if exists
            if (video.getThumbnailS3Key() != null) {
                try {
                    s3Service.deleteFile(video.getThumbnailS3Key());
                } catch (Exception e) {
                    log.warn("Failed to delete old thumbnail from S3: {}", video.getThumbnailS3Key(), e);
                }
            }

            // Upload new thumbnail to S3
            String filenameWithExt = extractFilename(video.getS3Key());
            int lastDotIndex = filenameWithExt.lastIndexOf(".");
            String filenameWithoutExt = (lastDotIndex > 0)
                ? filenameWithExt.substring(0, lastDotIndex)
                : filenameWithExt;
            String thumbnailFilename = filenameWithoutExt + "_thumb.jpg";

            String thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, THUMBNAIL_UPLOAD_FOLDER, thumbnailFilename, "image/jpeg");
            String thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);

            // Update video entity
            video.setThumbnailS3Key(thumbnailS3Key);
            video.setThumbnailUrl(thumbnailUrl);

            Video updatedVideo = videoRepository.save(video);
            log.info("Thumbnail regenerated successfully for video: {} by user ID {}", id, requestingUserId);

            // Clean up temp files
            try {
                Files.deleteIfExists(tempVideoPath);
                Files.deleteIfExists(tempThumbnailPath);
            } catch (IOException e) {
                log.warn("Failed to delete temporary files", e);
            }

            return updatedVideo;
        } catch (Exception e) {
            log.error("Failed to regenerate thumbnail for video: {}", id, e);
            throw new RuntimeException("Failed to regenerate thumbnail: " + e.getMessage());
        }
    }

    /**
     * Validate uploaded file
     * @param file File to validate
     */
    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    String.format("File size exceeds maximum allowed size of %d MB", MAX_FILE_SIZE / 1024 / 1024));
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException(
                    "Invalid file type. Allowed types: " + String.join(", ", ALLOWED_CONTENT_TYPES));
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            throw new IllegalArgumentException("File name is required");
        }
    }

    /**
     * Extract filename from S3 key
     * @param s3Key S3 key (e.g., "videos/uuid_filename.mp4")
     * @return Filename only (e.g., "uuid_filename.mp4")
     */
    private String extractFilename(String s3Key) {
        return s3Key.substring(s3Key.lastIndexOf("/") + 1);
    }

    /**
     * Upload audio file to S3 (audios/uploads/ folder)
     */
    public Video uploadAudio(MultipartFile file, Long uploadedById, String title, String description) throws IOException {
        // Validate file
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        // Validate audio content type
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.startsWith("audio/") && !contentType.equals("application/octet-stream"))) {
            throw new IllegalArgumentException("File must be an audio file (MP3, WAV, etc.)");
        }

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(String.format("File size exceeds maximum allowed size of %d MB", MAX_FILE_SIZE / (1024 * 1024)));
        }

        // Validate title
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }

        // Upload audio to S3 (audios/uploads folder)
        String s3Key = s3Service.uploadFile(file, AUDIO_UPLOAD_FOLDER);
        String s3Url = s3Service.getFileUrl(s3Key);

        log.info("Uploaded audio to S3: {}", s3Key);

        // Save metadata to database
        Video audio = Video.builder()
                .videoType(Video.VideoType.UPLOAD)
                .mediaType(Video.MediaType.VIDEO)
                .filename(truncate(extractFilename(s3Key), MAX_FILENAME_LENGTH))
                .originalFilename(truncate(file.getOriginalFilename(), MAX_FILENAME_LENGTH))
                .fileSize(file.getSize())
                .contentType(contentType)
                .s3Key(s3Key)
                .s3Url(s3Url)
                .thumbnailS3Key(null)
                .thumbnailUrl(null)
                .uploadedById(uploadedById)
                .title(truncate(title, MAX_TITLE_LENGTH))
                .description(description)
                .build();

        Video savedAudio = videoRepository.save(audio);
        log.info("Audio uploaded successfully: {} by user ID {}", savedAudio.getOriginalFilename(), uploadedById);

        return savedAudio;
    }

    /**
     * Upload TTS audio file to S3 (audios/tts/ folder)
     */
    public Video uploadAudioTts(MultipartFile file, Long uploadedById, String title, String description) throws IOException {
        // Validate file
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        // Validate audio content type
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.startsWith("audio/") && !contentType.equals("application/octet-stream"))) {
            throw new IllegalArgumentException("File must be an audio file (MP3, WAV, etc.)");
        }

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(String.format("File size exceeds maximum allowed size of %d MB", MAX_FILE_SIZE / (1024 * 1024)));
        }

        // Validate title
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }

        // Upload audio to S3 (audios/ai folder since TTS is AI-generated)
        String s3Key = s3Service.uploadFile(file, AUDIO_AI_FOLDER);
        String s3Url = s3Service.getFileUrl(s3Key);

        log.info("Uploaded TTS audio to S3: {}", s3Key);

        // Save metadata to database with AI_GENERATED type and AUDIO mediaType
        Video audio = Video.builder()
                .videoType(Video.VideoType.AI_GENERATED)
                .mediaType(Video.MediaType.AUDIO)
                .filename(truncate(extractFilename(s3Key), MAX_FILENAME_LENGTH))
                .originalFilename(truncate(file.getOriginalFilename(), MAX_FILENAME_LENGTH))
                .fileSize(file.getSize())
                .contentType(contentType)
                .s3Key(s3Key)
                .s3Url(s3Url)
                .thumbnailS3Key(null) // No thumbnail for audio
                .thumbnailUrl(null)
                .uploadedById(uploadedById)
                .title(truncate(title, MAX_TITLE_LENGTH))
                .description(description) // TEXT column - no limit
                .build();

        Video savedAudio = videoRepository.save(audio);
        log.info("TTS audio uploaded successfully: {} by user ID {}", savedAudio.getOriginalFilename(), uploadedById);

        return savedAudio;
    }

    /**
     * Generate presigned download URL for a video/audio file
     */
    public String getPresignedDownloadUrl(String s3Key) {
        return s3Service.generatePresignedUrl(s3Key, 60); // 60 minutes validity
    }

    /**
     * Replace all S3 URLs in content with presigned URLs
     * This is useful for XML menu files that contain S3 image URLs
     * @param content Content with S3 URLs
     * @param durationMinutes Duration in minutes for which the presigned URLs are valid
     * @return Content with presigned URLs
     */
    public String replaceS3UrlsWithPresignedUrls(String content, int durationMinutes) {
        if (content == null || content.isEmpty()) {
            return content;
        }

        // Pattern to match S3 URLs in format: https://bucket.s3.region.amazonaws.com/key
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
            "https://[^/]+\\.s3\\.[^/]+\\.amazonaws\\.com/([^<\\s\"']+)"
        );
        java.util.regex.Matcher matcher = pattern.matcher(content);

        StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String s3Url = matcher.group(0);
            String s3Key = matcher.group(1);

            try {
                // Generate presigned URL for this S3 key
                String presignedUrl = s3Service.generatePresignedUrl(s3Key, durationMinutes);
                // Replace the original URL with presigned URL
                matcher.appendReplacement(result, java.util.regex.Matcher.quoteReplacement(presignedUrl));
                log.debug("Replaced S3 URL with presigned URL: {} -> {}", s3Url, presignedUrl);
            } catch (Exception e) {
                log.warn("Failed to generate presigned URL for S3 key: {}, keeping original URL", s3Key, e);
                // Keep the original URL if presigned URL generation fails
                matcher.appendReplacement(result, java.util.regex.Matcher.quoteReplacement(s3Url));
            }
        }
        matcher.appendTail(result);

        return result.toString();
    }

    /**
     * Extract imageIds from menu XML and mark them as downloadable
     * This allows kiosks to automatically download menu images through the existing sync mechanism
     * @param xmlBytes XML file bytes
     */
    private void markMenuImagesAsDownloadable(byte[] xmlBytes) throws Exception {
        List<Long> imageIds = extractImageIdsFromMenuXml(xmlBytes);

        for (Long imageId : imageIds) {
            // Find video by ID and set downloadable to true
            videoRepository.findById(imageId).ifPresentOrElse(
                video -> {
                    if (!video.getDownloadable()) {
                        video.setDownloadable(true);
                        videoRepository.save(video);
                        log.info("Marked image {} as downloadable (title: {})", imageId, video.getTitle());
                    } else {
                        log.debug("Image {} is already downloadable", imageId);
                    }
                },
                () -> log.warn("Image {} not found in database, skipping", imageId)
            );
        }
    }

    /**
     * Extract imageIds from menu XML
     * @param xmlBytes XML file bytes
     * @return List of image IDs found in the XML
     */
    public List<Long> extractImageIdsFromMenuXml(byte[] xmlBytes) throws Exception {
        List<Long> imageIds = new java.util.ArrayList<>();

        // Parse XML
        javax.xml.parsers.DocumentBuilderFactory factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        javax.xml.parsers.DocumentBuilder builder = factory.newDocumentBuilder();
        org.w3c.dom.Document doc = builder.parse(new java.io.ByteArrayInputStream(xmlBytes));

        // Find all <imageId> elements
        org.w3c.dom.NodeList imageIdNodes = doc.getElementsByTagName("imageId");

        log.info("Found {} imageId elements in menu XML", imageIdNodes.getLength());

        for (int i = 0; i < imageIdNodes.getLength(); i++) {
            org.w3c.dom.Node node = imageIdNodes.item(i);
            String imageIdStr = node.getTextContent();

            if (imageIdStr != null && !imageIdStr.trim().isEmpty()) {
                try {
                    Long imageId = Long.parseLong(imageIdStr.trim());
                    imageIds.add(imageId);
                } catch (NumberFormatException e) {
                    log.warn("Invalid imageId format: {}", imageIdStr);
                }
            }
        }

        return imageIds;
    }

    /**
     * Extract imageIds from menu XML by menu video ID
     * @param menuId Menu video ID
     * @return List of image IDs found in the menu XML
     */
    public List<Long> extractImageIdsFromMenu(Long menuId) {
        try {
            Video menuVideo = videoRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("Menu not found with id: " + menuId));

            // Download the XML content from S3
            byte[] xmlBytes = s3Service.downloadFile(menuVideo.getS3Key());

            return extractImageIdsFromMenuXml(xmlBytes);
        } catch (Exception e) {
            log.error("Failed to extract imageIds from menu {}: {}", menuId, e.getMessage(), e);
            return new java.util.ArrayList<>();
        }
    }

    /**
     * Extract videoIds from menu XML
     * Looks for videoId in menu metadata, categories, and menu items
     * @param xmlBytes XML file bytes
     * @return List of video IDs found in the XML
     */
    public List<Long> extractVideoIdsFromMenuXml(byte[] xmlBytes) throws Exception {
        List<Long> videoIds = new java.util.ArrayList<>();

        // Parse XML
        javax.xml.parsers.DocumentBuilderFactory factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        javax.xml.parsers.DocumentBuilder builder = factory.newDocumentBuilder();
        org.w3c.dom.Document doc = builder.parse(new java.io.ByteArrayInputStream(xmlBytes));

        // Find videoId in menu metadata
        org.w3c.dom.NodeList metadataNodes = doc.getElementsByTagName("metadata");
        if (metadataNodes.getLength() > 0) {
            org.w3c.dom.Element metadataElement = (org.w3c.dom.Element) metadataNodes.item(0);
            org.w3c.dom.NodeList videoIdNodes = metadataElement.getElementsByTagName("videoId");
            if (videoIdNodes.getLength() > 0) {
                String videoIdStr = videoIdNodes.item(0).getTextContent();
                if (videoIdStr != null && !videoIdStr.trim().isEmpty()) {
                    try {
                        Long videoId = Long.parseLong(videoIdStr.trim());
                        videoIds.add(videoId);
                        log.debug("Found menu metadata videoId: {}", videoId);
                    } catch (NumberFormatException e) {
                        log.warn("Invalid videoId format in metadata: {}", videoIdStr);
                    }
                }
            }
        }

        // Find videoId attributes in categories
        org.w3c.dom.NodeList categoryNodes = doc.getElementsByTagName("category");
        for (int i = 0; i < categoryNodes.getLength(); i++) {
            org.w3c.dom.Element categoryElement = (org.w3c.dom.Element) categoryNodes.item(i);
            String videoIdStr = categoryElement.getAttribute("videoId");
            if (videoIdStr != null && !videoIdStr.trim().isEmpty()) {
                try {
                    Long videoId = Long.parseLong(videoIdStr.trim());
                    videoIds.add(videoId);
                    log.debug("Found category videoId: {}", videoId);
                } catch (NumberFormatException e) {
                    log.warn("Invalid videoId format in category: {}", videoIdStr);
                }
            }
        }

        // Find videoId elements in menu items
        org.w3c.dom.NodeList itemNodes = doc.getElementsByTagName("item");
        for (int i = 0; i < itemNodes.getLength(); i++) {
            org.w3c.dom.Element itemElement = (org.w3c.dom.Element) itemNodes.item(i);
            org.w3c.dom.NodeList videoIdNodes = itemElement.getElementsByTagName("videoId");
            if (videoIdNodes.getLength() > 0) {
                String videoIdStr = videoIdNodes.item(0).getTextContent();
                if (videoIdStr != null && !videoIdStr.trim().isEmpty()) {
                    try {
                        Long videoId = Long.parseLong(videoIdStr.trim());
                        videoIds.add(videoId);
                        log.debug("Found item videoId: {}", videoId);
                    } catch (NumberFormatException e) {
                        log.warn("Invalid videoId format in item: {}", videoIdStr);
                    }
                }
            }
        }

        // Find videoId attributes in actions section
        org.w3c.dom.NodeList actionsNodes = doc.getElementsByTagName("actions");
        if (actionsNodes.getLength() > 0) {
            org.w3c.dom.Element actionsElement = (org.w3c.dom.Element) actionsNodes.item(0);
            String[] actionTypes = {"addToCart", "checkout", "increaseQuantity", "decreaseQuantity", "cancelItem"};

            for (String actionType : actionTypes) {
                org.w3c.dom.NodeList actionNodes = actionsElement.getElementsByTagName(actionType);
                if (actionNodes.getLength() > 0) {
                    org.w3c.dom.Element actionElement = (org.w3c.dom.Element) actionNodes.item(0);
                    String videoIdStr = actionElement.getAttribute("videoId");
                    if (videoIdStr != null && !videoIdStr.trim().isEmpty()) {
                        try {
                            Long videoId = Long.parseLong(videoIdStr.trim());
                            videoIds.add(videoId);
                            log.debug("Found action {} videoId: {}", actionType, videoId);
                        } catch (NumberFormatException e) {
                            log.warn("Invalid videoId format in action {}: {}", actionType, videoIdStr);
                        }
                    }
                }
            }
        }

        log.info("Extracted {} videoIds from menu XML", videoIds.size());
        return videoIds;
    }

    /**
     * Extract videoIds from menu XML by menu video ID
     * @param menuId Menu video ID
     * @return List of video IDs found in the menu XML
     */
    public List<Long> extractVideoIdsFromMenu(Long menuId) {
        try {
            Video menuVideo = videoRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("Menu not found with id: " + menuId));

            // Download the XML content from S3
            byte[] xmlBytes = s3Service.downloadFile(menuVideo.getS3Key());

            return extractVideoIdsFromMenuXml(xmlBytes);
        } catch (Exception e) {
            log.error("Failed to extract videoIds from menu {}: {}", menuId, e.getMessage(), e);
            return new java.util.ArrayList<>();
        }
    }

}
