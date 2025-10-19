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
    private LocalDateTime createdAt;
}
