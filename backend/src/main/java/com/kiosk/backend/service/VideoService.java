package com.kiosk.backend.service;

import com.kiosk.backend.entity.Video;
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
@RequiredArgsConstructor
@Slf4j
public class VideoService {

    private final VideoRepository videoRepository;
    private final S3Service s3Service;
    private final com.kiosk.backend.repository.UserRepository userRepository;

    private static final String VIDEO_FOLDER = "videos/";
    private static final String THUMBNAIL_FOLDER = "thumbnails/";
    private static final long MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "video/mp4",
            "video/mpeg",
            "video/quicktime",
            "video/x-msvideo",
            "video/x-ms-wmv",
            "video/webm"
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
     * @param uploadedBy Email of the user uploading the video
     * @param uploadedByName Display name of the user uploading the video
     * @param title Title of the video
     * @param description Optional description of the video
     * @return Saved Video entity
     */
    @Transactional
    public Video uploadVideo(MultipartFile file, String uploadedBy, String uploadedByName, String title, String description) throws IOException {
        // Validate file
        validateFile(file);

        // Upload video to S3
        String s3Key = s3Service.uploadFile(file, VIDEO_FOLDER);
        String s3Url = s3Service.getFileUrl(s3Key);

        // Generate and upload thumbnail
        String thumbnailS3Key = null;
        String thumbnailUrl = null;
        try {
            byte[] thumbnailBytes = generateThumbnail(file);
            if (thumbnailBytes != null) {
                String thumbnailFilename = extractFilename(s3Key).replace(".", "_thumb.jpg");
                thumbnailS3Key = s3Service.uploadBytes(thumbnailBytes, THUMBNAIL_FOLDER, thumbnailFilename, "image/jpeg");
                thumbnailUrl = s3Service.getFileUrl(thumbnailS3Key);
                log.info("Thumbnail uploaded successfully: {}", thumbnailS3Key);
            }
        } catch (Exception e) {
            log.error("Failed to generate/upload thumbnail, continuing without thumbnail: {}", e.getMessage());
            // Continue without thumbnail - not critical
        }

        // Save metadata to database
        Video video = Video.builder()
                .filename(extractFilename(s3Key))
                .originalFilename(file.getOriginalFilename())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .s3Key(s3Key)
                .s3Url(s3Url)
                .thumbnailS3Key(thumbnailS3Key)
                .thumbnailUrl(thumbnailUrl)
                .uploadedBy(uploadedBy)
                .uploadedByName(uploadedByName)
                .title(title)
                .description(description)
                .build();

        Video savedVideo = videoRepository.save(video);
        log.info("Video uploaded successfully: {} by {}", savedVideo.getOriginalFilename(), uploadedBy);

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
     * Get videos uploaded by a specific user
     * @param email Email of the user
     * @return List of videos uploaded by the user
     */
    public List<Video> getVideosByUser(String email) {
        return videoRepository.findByUploadedByOrderByUploadedAtDesc(email);
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
     * Delete a video (both from S3 and database)
     * @param id Video ID
     * @param requestingUser Email of the user requesting deletion
     */
    @Transactional
    public void deleteVideo(Long id, String requestingUser) {
        Video video = getVideoById(id);

        // Check if user has permission to delete
        // Admin can delete any video, regular users can only delete their own
        if (!video.getUploadedBy().equals(requestingUser)) {
            log.warn("User {} attempted to delete video {} owned by {}",
                    requestingUser, id, video.getUploadedBy());
            throw new RuntimeException("You don't have permission to delete this video");
        }

        // Delete from S3
        try {
            s3Service.deleteFile(video.getS3Key());
        } catch (Exception e) {
            log.error("Failed to delete file from S3: {}", video.getS3Key(), e);
            throw new RuntimeException("Failed to delete video file from storage", e);
        }

        // Delete from database
        videoRepository.deleteById(id);
        log.info("Video deleted successfully: {} by {}", video.getOriginalFilename(), requestingUser);
    }

    /**
     * Update video title and description
     * @param id Video ID
     * @param title New title (optional)
     * @param description New description (optional)
     * @param requestingUser Email of the user requesting update
     * @return Updated Video entity
     */
    @Transactional
    public Video updateVideo(Long id, String title, String description, String requestingUser) {
        Video video = getVideoById(id);

        // Check if user has permission to update
        if (!video.getUploadedBy().equals(requestingUser)) {
            log.warn("User {} attempted to update video {} owned by {}",
                    requestingUser, id, video.getUploadedBy());
            throw new RuntimeException("You don't have permission to update this video");
        }

        if (title != null) {
            video.setTitle(title);
        }
        if (description != null) {
            video.setDescription(description);
        }
        Video updatedVideo = videoRepository.save(video);
        log.info("Video updated: {} by {}", id, requestingUser);

        return updatedVideo;
    }

    /**
     * Update video description (backward compatibility)
     * @param id Video ID
     * @param description New description
     * @param requestingUser Email of the user requesting update
     * @return Updated Video entity
     * @deprecated Use updateVideo instead
     */
    @Deprecated
    @Transactional
    public Video updateDescription(Long id, String description, String requestingUser) {
        return updateVideo(id, null, description, requestingUser);
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
     * Migrate existing videos to populate uploadedByName field
     * This is a one-time migration method to update existing videos
     * @return Number of videos updated
     */
    @Transactional
    public int migrateVideoUploaderNames() {
        List<Video> allVideos = videoRepository.findAll();
        int updatedCount = 0;

        for (Video video : allVideos) {
            // Only update if uploadedByName is null or empty
            if (video.getUploadedByName() == null || video.getUploadedByName().trim().isEmpty()) {
                String email = video.getUploadedBy();
                if (email != null && !email.isEmpty()) {
                    // Try to find user by email and get displayName
                    userRepository.findByEmail(email).ifPresentOrElse(
                        user -> {
                            String displayName = user.getDisplayName();
                            if (displayName != null && !displayName.trim().isEmpty()) {
                                video.setUploadedByName(displayName);
                                videoRepository.save(video);
                                log.info("Updated video {} uploadedByName to: {}", video.getId(), displayName);
                            } else {
                                log.warn("User {} has no displayName, skipping video {}", email, video.getId());
                            }
                        },
                        () -> log.warn("User not found for email: {}, skipping video {}", email, video.getId())
                    );
                    updatedCount++;
                }
            }
        }

        log.info("Migration completed: {} videos processed", updatedCount);
        return updatedCount;
    }
}
