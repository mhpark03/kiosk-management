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

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    @Column(nullable = false, length = 255)
    private String uploadedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadedAt;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;
}
