package com.kiosk.backend.service;

import com.kiosk.backend.entity.Audio;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.entity.Video;
import com.kiosk.backend.repository.AudioRepository;
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
    private final AudioRepository audioRepository;
    private final S3Service s3Service;
    private VeoService veoService; // Lazy injection to avoid circular dependency

    public VideoService(VideoRepository videoRepository, UserRepository userRepository,
                       KioskVideoRepository kioskVideoRepository, AudioRepository audioRepository,
                       S3Service s3Service) {
        this.videoRepository = videoRepository;
        this.userRepository = userRepository;
        this.kioskVideoRepository = kioskVideoRepository;
        this.audioRepository = audioRepository;
        this.s3Service = s3Service;
    }

    // Setter for VeoService to avoid circular dependency
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setVeoService(@org.springframework.context.annotation.Lazy VeoService veoService) {
        this.veoService = veoService;
        log.info("✅ VeoService injected successfully into VideoService");
    }

    // S3 folder structure
    private static final String VIDEO_UPLOAD_FOLDER = "videos/uploads/";
    private static final String VIDEO_RUNWAY_FOLDER = "videos/runway/";
    private static final String IMAGE_UPLOAD_FOLDER = "images/uploads/";
    private static final String IMAGE_RUNWAY_FOLDER = "images/runway/";
    private static final String THUMBNAIL_UPLOAD_FOLDER = "thumbnails/uploads/";
    private static final String THUMBNAIL_RUNWAY_FOLDER = "thumbnails/runway/";
    private static final long MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

    // Database column length limits
    private static final int MAX_TITLE_LENGTH = 255;
    private static final int MAX_FILENAME_LENGTH = 255;
    private static final int MAX_RUNWAY_TASK_ID_LENGTH = 100;
    private static final int MAX_RUNWAY_MODEL_LENGTH = 50;
    private static final int MAX_RUNWAY_RESOLUTION_LENGTH = 50;
    private static final int MAX_IMAGE_STYLE_LENGTH = 50;

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
            ProcessBuilder processBuilder = new ProcessBuilder(
                "ffmpeg",
                "-i", tempVideoPath.toString(),
                "-ss", "00:00:01.000",
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                tempThumbnailPath.toString()
            );

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            int exitCode = process.waitFor();

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

        // Upload video to S3 (uploads folder)
        String s3Key = s3Service.uploadFile(file, VIDEO_UPLOAD_FOLDER);
        String s3Url = s3Service.getFileUrl(s3Key);

        // Determine mediaType based on contentType
        String contentType = file.getContentType();
        Video.MediaType mediaType = Video.MediaType.VIDEO; // default
        if (contentType != null && contentType.toLowerCase().startsWith("image/")) {
            mediaType = Video.MediaType.IMAGE;
        }

        // Generate and upload thumbnail
        String thumbnailS3Key = null;
        String thumbnailUrl = null;
        try {
            byte[] thumbnailBytes = null;

            // For images, use the original image as thumbnail
            if (mediaType == Video.MediaType.IMAGE) {
                thumbnailBytes = file.getBytes();
            } else {
                // For videos, generate thumbnail using FFmpeg
                thumbnailBytes = generateThumbnail(file);
            }

            if (thumbnailBytes != null) {
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
            }
        } catch (Exception e) {
            log.error("Failed to generate/upload thumbnail, continuing without thumbnail: {}", e.getMessage());
            // Continue without thumbnail - not critical
        }

        // Save metadata to database with UPLOAD type
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
        log.info("Video uploaded successfully: {} by user ID {}", savedVideo.getOriginalFilename(), uploadedById);

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
     * Get a video by ID
     * @param id Video ID
     * @return Video entity
     */
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

        try {
            // Download video from S3
            byte[] videoBytes = s3Service.downloadFile(video.getS3Key());

            // Create temp file for video
            Path tempVideoPath = Files.createTempFile("video_", ".mp4");
            Files.write(tempVideoPath, videoBytes);

            // Generate new thumbnail
            Path tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

            ProcessBuilder processBuilder = new ProcessBuilder(
                "ffmpeg",
                "-i", tempVideoPath.toString(),
                "-ss", "00:00:01.000",
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                tempThumbnailPath.toString()
            );

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            int exitCode = process.waitFor();

            if (exitCode != 0 || !Files.exists(tempThumbnailPath)) {
                throw new RuntimeException("Failed to generate thumbnail with FFmpeg");
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

            // Use appropriate thumbnail folder based on video type
            String thumbnailFolder = (video.getVideoType() == Video.VideoType.RUNWAY_GENERATED)
                ? THUMBNAIL_RUNWAY_FOLDER
                : THUMBNAIL_UPLOAD_FOLDER;

            String thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, thumbnailFolder, thumbnailFilename, "image/jpeg");
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
     * Save a Runway ML generated video from URL to S3 and database
     * @param videoUrl URL of the generated video
     * @param uploadedById User ID of the user who requested video generation
     * @param title Title of the video
     * @param description Description of the video
     * @param runwayTaskId Runway ML task ID
     * @param runwayModel Model used for generation
     * @param runwayResolution Resolution of the generated video
     * @param runwayPrompt Prompt used for generation
     * @return Saved Video entity
     */
    @Transactional
    public Video saveRunwayGeneratedVideo(String videoUrl, Long uploadedById, String title, String description,
                                          String runwayTaskId, String runwayModel, String runwayResolution, String runwayPrompt) throws IOException {
        log.info("Downloading Runway ML generated video from: {}", videoUrl);

        // Validate inputs
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("Description is required");
        }

        Path tempVideoPath = null;
        try {
            // Download video from URL to temporary file
            tempVideoPath = Files.createTempFile("runway_video_", ".mp4");
            java.net.URL url = new java.net.URL(videoUrl);
            try (java.io.InputStream in = url.openStream()) {
                Files.copy(in, tempVideoPath, StandardCopyOption.REPLACE_EXISTING);
            }

            long fileSize = Files.size(tempVideoPath);
            log.info("Downloaded video file, size: {} bytes", fileSize);

            // Upload video to S3 (runway folder)
            String filename = "runway_" + java.util.UUID.randomUUID().toString() + ".mp4";

            byte[] videoBytes = Files.readAllBytes(tempVideoPath);
            String uploadedS3Key = s3Service.uploadBytes(videoBytes, VIDEO_RUNWAY_FOLDER, filename, "video/mp4");
            String s3Url = s3Service.getFileUrl(uploadedS3Key);

            log.info("Uploaded Runway video to S3: {}", uploadedS3Key);

            // Generate thumbnail
            String thumbnailS3Key = null;
            String thumbnailUrl = null;
            try {
                Path tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

                ProcessBuilder processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideoPath.toString(),
                    "-ss", "00:00:01.000",
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    tempThumbnailPath.toString()
                );

                processBuilder.redirectErrorStream(true);
                Process process = processBuilder.start();
                int exitCode = process.waitFor();

                if (exitCode == 0 && Files.exists(tempThumbnailPath)) {
                    byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);
                    String thumbnailFilename = filename.replace(".mp4", "_thumb.jpg");
                    thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, THUMBNAIL_RUNWAY_FOLDER, thumbnailFilename, "image/jpeg");
                    thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                    log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);

                    Files.deleteIfExists(tempThumbnailPath);
                }
            } catch (Exception e) {
                log.error("Failed to generate/upload thumbnail: {}", e.getMessage());
                // Continue without thumbnail
            }

            // Save metadata to database with Runway ML info and RUNWAY_GENERATED type
            Video video = Video.builder()
                    .videoType(Video.VideoType.RUNWAY_GENERATED)
                    .filename(truncate(filename, MAX_FILENAME_LENGTH))
                    .originalFilename(truncate("runway_generated_" + runwayTaskId + ".mp4", MAX_FILENAME_LENGTH))
                    .fileSize(fileSize)
                    .contentType("video/mp4")
                    .s3Key(uploadedS3Key)
                    .s3Url(s3Url)
                    .thumbnailS3Key(thumbnailS3Key)
                    .thumbnailUrl(thumbnailUrl)
                    .uploadedById(uploadedById)
                    .title(truncate(title, MAX_TITLE_LENGTH))
                    .description(description) // TEXT column - no limit
                    .runwayTaskId(truncate(runwayTaskId, MAX_RUNWAY_TASK_ID_LENGTH))
                    .runwayModel(truncate(runwayModel, MAX_RUNWAY_MODEL_LENGTH))
                    .runwayResolution(truncate(runwayResolution, MAX_RUNWAY_RESOLUTION_LENGTH))
                    .runwayPrompt(runwayPrompt) // TEXT column - no limit
                    .build();

            Video savedVideo = videoRepository.save(video);
            log.info("Runway ML generated video saved successfully: {} by user ID {}", savedVideo.getTitle(), uploadedById);

            return savedVideo;
        } catch (Exception e) {
            log.error("Failed to save Runway ML generated video", e);
            throw new IOException("Failed to save Runway ML generated video: " + e.getMessage(), e);
        } finally {
            // Clean up temporary file
            if (tempVideoPath != null && Files.exists(tempVideoPath)) {
                try {
                    Files.delete(tempVideoPath);
                } catch (IOException e) {
                    log.error("Failed to delete temporary video file: {}", e.getMessage());
                }
            }
        }
    }

    /**
     * Save Runway ML generated image to S3 and database
     * Downloads image from URL, uploads to S3, and saves metadata
     */
    public Video saveRunwayGeneratedImage(String imageUrl, Long uploadedById, String title, String description,
                                          String runwayTaskId, String runwayResolution, String runwayPrompt, String imageStyle) throws IOException {
        log.info("Downloading Runway ML generated image from: {}", imageUrl);

        // Validate inputs
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("Description is required");
        }

        Path tempImagePath = null;
        try {
            // Download image from URL to temporary file
            tempImagePath = Files.createTempFile("runway_image_", ".png");
            java.net.URL url = new java.net.URL(imageUrl);
            try (java.io.InputStream in = url.openStream()) {
                Files.copy(in, tempImagePath, StandardCopyOption.REPLACE_EXISTING);
            }

            long fileSize = Files.size(tempImagePath);
            log.info("Downloaded image file, size: {} bytes", fileSize);

            // Upload image to S3 (runway images folder)
            String filename = "runway_image_" + java.util.UUID.randomUUID().toString() + ".png";

            byte[] imageBytes = Files.readAllBytes(tempImagePath);
            String uploadedS3Key = s3Service.uploadBytes(imageBytes, IMAGE_RUNWAY_FOLDER, filename, "image/png");
            String s3Url = s3Service.getFileUrl(uploadedS3Key);

            log.info("Uploaded Runway image to S3: {}", uploadedS3Key);

            // For images, use the same image as thumbnail (just copy to thumbnails folder)
            String thumbnailS3Key = null;
            String thumbnailUrl = null;
            try {
                String thumbnailFilename = filename.replace(".png", "_thumb.png");
                thumbnailS3Key = s3Service.uploadBytes(imageBytes, THUMBNAIL_RUNWAY_FOLDER, thumbnailFilename, "image/png");
                thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);
            } catch (Exception e) {
                log.error("Failed to upload thumbnail: {}", e.getMessage());
                // Continue without thumbnail
            }

            // Save metadata to database with Runway ML info and RUNWAY_GENERATED type
            Video video = Video.builder()
                    .videoType(Video.VideoType.RUNWAY_GENERATED)
                    .mediaType(Video.MediaType.IMAGE)
                    .filename(truncate(filename, MAX_FILENAME_LENGTH))
                    .originalFilename(truncate("runway_generated_image_" + runwayTaskId + ".png", MAX_FILENAME_LENGTH))
                    .fileSize(fileSize)
                    .contentType("image/png")
                    .s3Key(uploadedS3Key)
                    .s3Url(s3Url)
                    .thumbnailS3Key(thumbnailS3Key)
                    .thumbnailUrl(thumbnailUrl)
                    .uploadedById(uploadedById)
                    .title(truncate(title, MAX_TITLE_LENGTH))
                    .description(description) // TEXT column - no limit
                    .runwayTaskId(truncate(runwayTaskId, MAX_RUNWAY_TASK_ID_LENGTH))
                    .runwayModel("gen4_image") // Fixed string, no truncation needed
                    .runwayResolution(truncate(runwayResolution, MAX_RUNWAY_RESOLUTION_LENGTH))
                    .runwayPrompt(runwayPrompt) // TEXT column - no limit
                    .imageStyle(truncate(imageStyle, MAX_IMAGE_STYLE_LENGTH))
                    .build();

            Video savedVideo = videoRepository.save(video);
            log.info("Runway ML generated image saved successfully: {} by user ID {}", savedVideo.getTitle(), uploadedById);

            return savedVideo;
        } catch (Exception e) {
            log.error("Failed to save Runway ML generated image", e);
            throw new IOException("Failed to save Runway ML generated image: " + e.getMessage(), e);
        } finally {
            // Clean up temporary file
            if (tempImagePath != null && Files.exists(tempImagePath)) {
                try {
                    Files.delete(tempImagePath);
                } catch (IOException e) {
                    log.error("Failed to delete temporary image file: {}", e.getMessage());
                }
            }
        }
    }

    /**
     * Save Google Veo generated video to S3 and database
     * Downloads video from URL, uploads to S3, and saves metadata
     *
     * @param videoUrl URL of the generated video from Google Veo API
     * @param uploadedById User ID who generated the video
     * @param title Title for the video
     * @param description Description for the video
     * @param veoTaskId Google Veo task ID
     * @param veoPrompt Prompt used for generation
     * @return Saved Video entity
     */
    @Transactional
    public Video saveVeoGeneratedVideo(String videoUrl, Long uploadedById, String title, String description,
                                       String veoTaskId, String veoPrompt) throws IOException {
        log.info("=== Saving Google Veo generated video to S3 ===");
        log.info("Video URL: {}", videoUrl);
        log.info("Uploaded by ID: {}", uploadedById);
        log.info("Title: {}", title);
        log.info("Veo Task ID: {}", veoTaskId);

        // Validate inputs
        if (title == null || title.trim().isEmpty()) {
            log.error("Title is required");
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            log.error("Description is required");
            throw new IllegalArgumentException("Description is required");
        }

        Path tempVideoPath = null;
        try {
            // Download video from Google Veo URL with authentication
            log.info("Creating temporary file for video download...");
            tempVideoPath = Files.createTempFile("veo_video_", ".mp4");

            // Use VeoService to download with authentication
            log.info("Checking VeoService availability...");
            if (veoService == null) {
                log.error("❌ VeoService is NULL - cannot download authenticated video");
                throw new RuntimeException("VeoService not available - cannot download authenticated video");
            }
            log.info("✅ VeoService is available");

            log.info("Downloading video using VeoService...");
            try (java.io.InputStream in = veoService.downloadVideoStream(videoUrl)) {
                Files.copy(in, tempVideoPath, StandardCopyOption.REPLACE_EXISTING);
            }
            log.info("✅ Video download completed");

            long fileSize = Files.size(tempVideoPath);
            log.info("Downloaded Veo video file, size: {} bytes", fileSize);

            // Upload video to S3 (veo folder)
            String filename = "veo_" + java.util.UUID.randomUUID().toString() + ".mp4";

            byte[] videoBytes = Files.readAllBytes(tempVideoPath);
            String uploadedS3Key = s3Service.uploadBytes(videoBytes, "videos/veo", filename, "video/mp4");
            String s3Url = s3Service.getFileUrl(uploadedS3Key);

            log.info("Uploaded Veo video to S3: {}", uploadedS3Key);

            // Generate thumbnail
            String thumbnailS3Key = null;
            String thumbnailUrl = null;
            try {
                Path tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

                ProcessBuilder processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideoPath.toString(),
                    "-ss", "00:00:01.000",
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    tempThumbnailPath.toString()
                );

                processBuilder.redirectErrorStream(true);
                Process process = processBuilder.start();
                int exitCode = process.waitFor();

                if (exitCode == 0 && Files.exists(tempThumbnailPath)) {
                    byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);
                    String thumbnailFilename = filename.replace(".mp4", "_thumb.jpg");
                    thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, "thumbnails/veo", thumbnailFilename, "image/jpeg");
                    thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                    log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);

                    Files.deleteIfExists(tempThumbnailPath);
                }
            } catch (Exception e) {
                log.error("Failed to generate/upload thumbnail: {}", e.getMessage());
                // Continue without thumbnail
            }

            // Save metadata to database with Veo info and VEO_GENERATED type
            // Note: We reuse runway fields for Veo data (runwayTaskId stores veoTaskId, etc.)
            Video video = Video.builder()
                    .videoType(Video.VideoType.VEO_GENERATED)
                    .filename(truncate(filename, MAX_FILENAME_LENGTH))
                    .originalFilename(truncate("veo_generated_" + veoTaskId + ".mp4", MAX_FILENAME_LENGTH))
                    .fileSize(fileSize)
                    .contentType("video/mp4")
                    .s3Key(uploadedS3Key)
                    .s3Url(s3Url)
                    .thumbnailS3Key(thumbnailS3Key)
                    .thumbnailUrl(thumbnailUrl)
                    .uploadedById(uploadedById)
                    .title(truncate(title, MAX_TITLE_LENGTH))
                    .description(description) // TEXT column - no limit
                    .runwayTaskId(truncate(veoTaskId, MAX_RUNWAY_TASK_ID_LENGTH))  // Reusing runway field for Veo task ID
                    .runwayModel(truncate("veo-3.1-generate-preview", MAX_RUNWAY_MODEL_LENGTH))  // Veo model name
                    .runwayPrompt(veoPrompt)  // TEXT column - no limit, reusing runway field for Veo prompt
                    .build();

            Video savedVideo = videoRepository.save(video);
            log.info("Google Veo generated video saved successfully: {} by user ID {}", savedVideo.getTitle(), uploadedById);

            return savedVideo;
        } catch (Exception e) {
            log.error("Failed to save Google Veo generated video", e);
            throw new IOException("Failed to save Google Veo generated video: " + e.getMessage(), e);
        } finally {
            // Clean up temporary file
            if (tempVideoPath != null && Files.exists(tempVideoPath)) {
                try {
                    Files.delete(tempVideoPath);
                } catch (IOException e) {
                    log.error("Failed to delete temporary video file: {}", e.getMessage());
                }
            }
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
     * Get video duration using ffprobe
     * @param videoPath Path to video file
     * @return Duration in seconds
     */
    private double getVideoDuration(String videoPath) throws IOException {
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                videoPath
            );

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            StringBuilder output = new StringBuilder();
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                }
            }

            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new IOException("Failed to get video duration, exit code: " + exitCode);
            }

            String durationStr = output.toString().trim();
            return Double.parseDouble(durationStr);
        } catch (Exception e) {
            log.error("Failed to get video duration: {}", e.getMessage());
            throw new IOException("Failed to get video duration: " + e.getMessage(), e);
        }
    }

    /**
     * Merge two videos using FFmpeg
     * @param videoId1 ID of the first video
     * @param videoId2 ID of the second video
     * @param title Title for the merged video
     * @param description Description for the merged video
     * @param transitionType Type of transition (concat, fade, xfade)
     * @param transitionDuration Duration of transition in seconds
     * @param outputQuality Quality level (low, medium, high)
     * @param uploadedById User ID who is merging the videos
     * @return Saved merged Video entity
     */
    @Transactional
    public Video mergeVideos(Long videoId1, Long videoId2, String title, String description,
                             String transitionType, Double transitionDuration, String outputQuality,
                             Long uploadedById) throws IOException {
        log.info("Starting video merge: video1={}, video2={}, transition={}", videoId1, videoId2, transitionType);

        // Validate inputs
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("Description is required");
        }

        // Get videos
        Video video1 = getVideoById(videoId1);
        Video video2 = getVideoById(videoId2);

        Path tempVideo1Path = null;
        Path tempVideo2Path = null;
        Path tempOutputPath = null;

        try {
            // Download videos from S3
            tempVideo1Path = Files.createTempFile("video1_", ".mp4");
            tempVideo2Path = Files.createTempFile("video2_", ".mp4");
            tempOutputPath = Files.createTempFile("merged_", ".mp4");

            byte[] video1Bytes = s3Service.downloadFile(video1.getS3Key());
            byte[] video2Bytes = s3Service.downloadFile(video2.getS3Key());

            Files.write(tempVideo1Path, video1Bytes);
            Files.write(tempVideo2Path, video2Bytes);

            log.info("Downloaded videos to temporary files");

            // Determine bitrate based on quality
            String bitrate;
            switch (outputQuality.toLowerCase()) {
                case "low":
                    bitrate = "1M";
                    break;
                case "high":
                    bitrate = "8M";
                    break;
                default: // medium
                    bitrate = "4M";
                    break;
            }

            // Get duration of first video for transition calculations
            double video1Duration = getVideoDuration(tempVideo1Path.toString());
            log.info("Video 1 duration: {} seconds", video1Duration);

            // Build FFmpeg command based on transition type
            ProcessBuilder processBuilder;

            if ("concat".equals(transitionType)) {
                // Simple concatenation without transition - video only (no audio)
                // Scale both videos to 1920x1080 to ensure same resolution
                processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideo1Path.toString(),
                    "-i", tempVideo2Path.toString(),
                    "-filter_complex", "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[outv]",
                    "-map", "[outv]",
                    "-b:v", bitrate,
                    "-y",
                    tempOutputPath.toString()
                );
            } else if ("fade".equals(transitionType)) {
                // Fade out first video at the end, fade in second video at the start - video only
                // Scale both videos to 1920x1080 first, then apply fade effects
                double fadeStartTime = Math.max(0, video1Duration - transitionDuration);
                processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideo1Path.toString(),
                    "-i", tempVideo2Path.toString(),
                    "-filter_complex",
                    String.format("[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=out:st=%.2f:d=%.2f[v0];[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=%.2f[v1];[v0][v1]concat=n=2:v=1:a=0[outv]",
                        fadeStartTime, transitionDuration, transitionDuration),
                    "-map", "[outv]",
                    "-b:v", bitrate,
                    "-y",
                    tempOutputPath.toString()
                );
            } else if ("xfade".equals(transitionType)) {
                // Crossfade transition - video only
                // Scale both videos to 1920x1080 before applying crossfade
                double xfadeOffset = Math.max(0, video1Duration - transitionDuration);
                processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideo1Path.toString(),
                    "-i", tempVideo2Path.toString(),
                    "-filter_complex",
                    String.format("[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v0];[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v1];[v0][v1]xfade=transition=fade:duration=%.2f:offset=%.2f[outv]",
                        transitionDuration, xfadeOffset),
                    "-map", "[outv]",
                    "-b:v", bitrate,
                    "-y",
                    tempOutputPath.toString()
                );
            } else {
                throw new IllegalArgumentException("Invalid transition type: " + transitionType);
            }

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            // Log FFmpeg output
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("FFmpeg: {}", line);
                }
            }

            int exitCode = process.waitFor();

            if (exitCode != 0 || !Files.exists(tempOutputPath) || Files.size(tempOutputPath) == 0) {
                throw new RuntimeException("FFmpeg failed to merge videos, exit code: " + exitCode);
            }

            log.info("Videos merged successfully");

            // Upload merged video to S3
            String filename = "merged_" + java.util.UUID.randomUUID().toString() + ".mp4";
            byte[] mergedVideoBytes = Files.readAllBytes(tempOutputPath);
            String uploadedS3Key = s3Service.uploadBytes(mergedVideoBytes, VIDEO_UPLOAD_FOLDER, filename, "video/mp4");
            String s3Url = s3Service.getFileUrl(uploadedS3Key);

            log.info("Uploaded merged video to S3: {}", uploadedS3Key);

            // Generate thumbnail for merged video
            String thumbnailS3Key = null;
            String thumbnailUrl = null;
            try {
                Path tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

                ProcessBuilder thumbnailBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempOutputPath.toString(),
                    "-ss", "00:00:01.000",
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    tempThumbnailPath.toString()
                );

                thumbnailBuilder.redirectErrorStream(true);
                Process thumbnailProcess = thumbnailBuilder.start();
                int thumbnailExitCode = thumbnailProcess.waitFor();

                if (thumbnailExitCode == 0 && Files.exists(tempThumbnailPath)) {
                    byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);
                    String thumbnailFilename = filename.replace(".mp4", "_thumb.jpg");
                    thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, THUMBNAIL_UPLOAD_FOLDER, thumbnailFilename, "image/jpeg");
                    thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                    log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);

                    Files.deleteIfExists(tempThumbnailPath);
                }
            } catch (Exception e) {
                log.error("Failed to generate/upload thumbnail: {}", e.getMessage());
                // Continue without thumbnail
            }

            // Save merged video metadata to database
            Video mergedVideo = Video.builder()
                    .videoType(Video.VideoType.UPLOAD)
                    .filename(truncate(filename, MAX_FILENAME_LENGTH))
                    .originalFilename(truncate("merged_" + video1.getOriginalFilename() + "_" + video2.getOriginalFilename(), MAX_FILENAME_LENGTH))
                    .fileSize((long) mergedVideoBytes.length)
                    .contentType("video/mp4")
                    .s3Key(uploadedS3Key)
                    .s3Url(s3Url)
                    .thumbnailS3Key(thumbnailS3Key)
                    .thumbnailUrl(thumbnailUrl)
                    .uploadedById(uploadedById)
                    .title(truncate(title, MAX_TITLE_LENGTH))
                    .description(description)
                    .build();

            Video savedVideo = videoRepository.save(mergedVideo);
            log.info("Merged video saved successfully: {}", savedVideo.getTitle());

            return savedVideo;
        } catch (Exception e) {
            log.error("Failed to merge videos", e);
            throw new IOException("Failed to merge videos: " + e.getMessage(), e);
        } finally {
            // Clean up temporary files
            try {
                if (tempVideo1Path != null && Files.exists(tempVideo1Path)) {
                    Files.delete(tempVideo1Path);
                }
                if (tempVideo2Path != null && Files.exists(tempVideo2Path)) {
                    Files.delete(tempVideo2Path);
                }
                if (tempOutputPath != null && Files.exists(tempOutputPath)) {
                    Files.delete(tempOutputPath);
                }
            } catch (IOException e) {
                log.error("Failed to delete temporary files: {}", e.getMessage());
            }
        }
    }

    /**
     * Add audio to video using FFmpeg
     * @param videoId Video ID
     * @param audioId Audio ID (from TTS or uploaded)
     * @param title Title for the new video
     * @param description Description for the new video
     * @param replaceAudio If true, replace existing audio; if false, mix with existing audio
     * @param uploadedById User ID
     * @return New Video entity with audio added
     */
    public Video addAudioToVideo(Long videoId, Long audioId, String title, String description,
                                 Boolean replaceAudio, Long uploadedById) throws IOException {
        log.info("Adding audio to video: videoId={}, audioId={}, replaceAudio={}", videoId, audioId, replaceAudio);

        // Validate inputs
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }
        if (description == null || description.trim().isEmpty()) {
            throw new IllegalArgumentException("Description is required");
        }

        // Get video and audio
        Video video = getVideoById(videoId);
        Audio audio = audioRepository.findById(audioId)
                .orElseThrow(() -> new RuntimeException("Audio not found with id: " + audioId));

        Path tempVideoPath = null;
        Path tempAudioPath = null;
        Path tempOutputPath = null;

        try {
            // Download video and audio from S3
            tempVideoPath = Files.createTempFile("video_", ".mp4");
            tempAudioPath = Files.createTempFile("audio_", ".mp3");
            tempOutputPath = Files.createTempFile("output_", ".mp4");

            byte[] videoBytes = s3Service.downloadFile(video.getS3Key());
            byte[] audioBytes = s3Service.downloadFile(audio.getS3Key());

            Files.write(tempVideoPath, videoBytes);
            Files.write(tempAudioPath, audioBytes);

            log.info("Downloaded video and audio to temporary files");

            // Build FFmpeg command
            ProcessBuilder processBuilder;

            if (replaceAudio) {
                // Replace existing audio with new audio
                processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideoPath.toString(),
                    "-i", tempAudioPath.toString(),
                    "-c:v", "copy",  // Copy video stream without re-encoding
                    "-c:a", "aac",   // Encode audio to AAC
                    "-map", "0:v:0", // Map video from first input
                    "-map", "1:a:0", // Map audio from second input
                    "-shortest",     // End when shortest stream ends
                    "-y",
                    tempOutputPath.toString()
                );
            } else {
                // Mix existing audio with new audio
                processBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempVideoPath.toString(),
                    "-i", tempAudioPath.toString(),
                    "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest[aout]",
                    "-map", "0:v:0",
                    "-map", "[aout]",
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-shortest",
                    "-y",
                    tempOutputPath.toString()
                );
            }

            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            // Log FFmpeg output
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("FFmpeg: {}", line);
                }
            }

            int exitCode = process.waitFor();

            if (exitCode != 0 || !Files.exists(tempOutputPath) || Files.size(tempOutputPath) == 0) {
                throw new RuntimeException("FFmpeg failed to add audio to video, exit code: " + exitCode);
            }

            log.info("Audio added to video successfully");

            // Upload result to S3
            String filename = "with_audio_" + java.util.UUID.randomUUID().toString() + ".mp4";
            byte[] outputBytes = Files.readAllBytes(tempOutputPath);
            String uploadedS3Key = s3Service.uploadBytes(outputBytes, VIDEO_UPLOAD_FOLDER, filename, "video/mp4");
            String s3Url = s3Service.getFileUrl(uploadedS3Key);

            log.info("Uploaded video with audio to S3: {}", uploadedS3Key);

            // Generate thumbnail
            String thumbnailS3Key = null;
            String thumbnailUrl = null;
            try {
                Path tempThumbnailPath = Files.createTempFile("thumbnail_", ".jpg");

                ProcessBuilder thumbnailBuilder = new ProcessBuilder(
                    "ffmpeg",
                    "-i", tempOutputPath.toString(),
                    "-ss", "00:00:01.000",
                    "-vframes", "1",
                    "-vf", "scale=320:-1",
                    "-y",
                    tempThumbnailPath.toString()
                );

                thumbnailBuilder.redirectErrorStream(true);
                Process thumbnailProcess = thumbnailBuilder.start();
                int thumbnailExitCode = thumbnailProcess.waitFor();

                if (thumbnailExitCode == 0 && Files.exists(tempThumbnailPath)) {
                    byte[] thumbnailBytes = Files.readAllBytes(tempThumbnailPath);
                    String thumbnailFilename = filename.replace(".mp4", "_thumb.jpg");
                    thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, THUMBNAIL_UPLOAD_FOLDER, thumbnailFilename, "image/jpeg");
                    thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                    log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);

                    Files.deleteIfExists(tempThumbnailPath);
                }
            } catch (Exception e) {
                log.error("Failed to generate/upload thumbnail: {}", e.getMessage());
                // Continue without thumbnail
            }

            // Save new video to database
            Video newVideo = Video.builder()
                    .videoType(Video.VideoType.UPLOAD)
                    .filename(truncate(filename, MAX_FILENAME_LENGTH))
                    .originalFilename(truncate(title + ".mp4", MAX_FILENAME_LENGTH))
                    .fileSize((long) outputBytes.length)
                    .contentType("video/mp4")
                    .s3Key(uploadedS3Key)
                    .s3Url(s3Url)
                    .thumbnailS3Key(thumbnailS3Key)
                    .thumbnailUrl(thumbnailUrl)
                    .uploadedById(uploadedById)
                    .title(truncate(title, MAX_TITLE_LENGTH))
                    .description(description)
                    .build();

            Video savedVideo = videoRepository.save(newVideo);
            log.info("Video with audio saved to database with ID: {}", savedVideo.getId());

            return savedVideo;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Audio addition was interrupted", e);
        } finally {
            // Clean up temporary files
            try {
                if (tempVideoPath != null && Files.exists(tempVideoPath)) {
                    Files.delete(tempVideoPath);
                }
                if (tempAudioPath != null && Files.exists(tempAudioPath)) {
                    Files.delete(tempAudioPath);
                }
                if (tempOutputPath != null && Files.exists(tempOutputPath)) {
                    Files.delete(tempOutputPath);
                }
            } catch (IOException e) {
                log.error("Failed to delete temporary files: {}", e.getMessage());
            }
        }
    }
}
