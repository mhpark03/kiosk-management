package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "videos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Video {

    public enum VideoType {
        UPLOAD,           // Regular uploaded video/image
        AI_GENERATED      // AI-generated content (unified)
    }

    public enum MediaType {
        VIDEO,            // Video file
        IMAGE,            // Image file
        AUDIO             // Audio file
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VideoType videoType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MediaType mediaType = MediaType.VIDEO;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false)
    private Long fileSize;

    @Column(length = 50)
    private String contentType;

    @Column(nullable = false, length = 500)
    private String s3Key;

    @Column(nullable = false, length = 1000)
    private String s3Url;

    @Column(length = 500)
    private String thumbnailS3Key;

    @Column(length = 1000)
    private String thumbnailUrl;

    @Column(nullable = false)
    private Long uploadedById;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadedAt;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column
    private Integer duration; // Video duration in seconds

    // Kiosk download flag
    @Column(nullable = false)
    @Builder.Default
    private Boolean downloadable = false; // Whether this video/image can be downloaded to kiosks
}
