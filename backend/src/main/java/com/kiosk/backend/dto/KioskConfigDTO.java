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
public class KioskConfigDTO {
    private String downloadPath;
    private String apiUrl;
    private Boolean autoSync;
    private Integer syncInterval;
    private LocalDateTime lastSync;
}
