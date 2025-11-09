package com.kiosk.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskVideoDTO {
    private Long id;
    private Long kioskId;
    private Long videoId;
    private Integer displayOrder;
    private String assignedBy;
    private LocalDateTime assignedAt;
    private String downloadStatus; // PENDING, DOWNLOADING, COMPLETED, FAILED
    private String sourceType;     // MANUAL, MENU_VIDEO, MENU_IMAGE
    private String menuId;         // Menu ID if this is from a menu
    private LocalDateTime createdAt;

    // Video details
    private String title;
    private String description;
    private String fileName;
    private Long fileSize;
    private Integer duration;
    private String url;
    private String thumbnailUrl;
    private String mediaType;      // VIDEO, IMAGE, AUDIO, DOCUMENT
    private String imagePurpose;   // GENERAL, REFERENCE, MENU
    private String presignedUrl;   // For IMAGE and DOCUMENT files
}
