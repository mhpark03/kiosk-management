package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "audios")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Audio {

    public enum VoiceGender {
        MALE,
        FEMALE,
        NEUTRAL
    }

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
    private Integer duration; // Audio duration in seconds

    // TTS specific fields
    @Column(nullable = false, columnDefinition = "TEXT")
    private String text; // Original text for TTS

    @Column(nullable = false, length = 20)
    private String languageCode; // e.g., "ko-KR", "en-US"

    @Column(nullable = false, length = 100)
    private String voiceName; // e.g., "ko-KR-Neural2-A"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VoiceGender gender;

    @Column(nullable = false)
    @Builder.Default
    private Double speakingRate = 1.0; // 0.25 ~ 4.0

    @Column(nullable = false)
    @Builder.Default
    private Double pitch = 0.0; // -20.0 ~ 20.0

    @Transient  // Not stored in database, populated at runtime from User entity
    private String uploadedByName;
}
