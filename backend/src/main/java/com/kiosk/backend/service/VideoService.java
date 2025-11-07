package com.kiosk.backend.service;

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
            }
        }

        // Check for duplicate by original filename (with media-type-specific error message)
        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null && videoRepository.existsByOriginalFilename(originalFilename)) {
            String mediaTypeKorean = switch (mediaType) {
                case VIDEO -> "영상";
                case IMAGE -> "이미지";
                case AUDIO -> "음성";
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
                // For audio, no thumbnail needed
                log.info("Audio file detected, skipping thumbnail generation");
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
                .description(description); // TEXT column - no limit

        // Set imagePurpose for images
        if (mediaType == Video.MediaType.IMAGE && imagePurpose != null) {
            videoBuilder.imagePurpose(imagePurpose);
        }

        Video video = videoBuilder.build();

        Video savedVideo = videoRepository.save(video);
        log.info("Video uploaded successfully: {} (ID: {}) by user ID {}", savedVideo.getOriginalFilename(), savedVideo.getId(), uploadedById);

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

        // Set imagePurpose for images
        if (mediaType == Video.MediaType.IMAGE && imagePurpose != null) {
            videoBuilder.imagePurpose(imagePurpose);
        }

        Video video = videoBuilder.build();

        Video savedVideo = videoRepository.save(video);
        log.info("AI-generated {} uploaded successfully: {} (ID: {}) by user ID {}", mediaType, savedVideo.getOriginalFilename(), savedVideo.getId(), uploadedById);

        return savedVideo;
    }

    /**
     * Get all videos ordered by upload date (newest first)
     * @return List of all videos
     */
    public List<Video> getAllVideos() {
        return videoRepository.findAllByOrderByUploadedAtDesc();
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
    public Video updateVideo(Long id, String title, String description, Long requestingUserId) {
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
        return updateVideo(id, null, description, requestingUserId);
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

        // Upload audio to S3 (audios/tts folder)
        String s3Key = s3Service.uploadFile(file, AUDIO_TTS_FOLDER);
        String s3Url = s3Service.getFileUrl(s3Key);

        log.info("Uploaded TTS audio to S3: {}", s3Key);

        // Save metadata to database with UPLOAD type and AUDIO mediaType
        // Note: We're reusing the Video entity to store audio files
        Video audio = Video.builder()
                .videoType(Video.VideoType.UPLOAD)
                .mediaType(Video.MediaType.VIDEO) // Using VIDEO type for now, could add AUDIO type later
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


}
