package com.kiosk.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecordKioskEventRequest {

    private String kioskid;       // 12-digit kiosk ID
    private String eventType;     // Event type (e.g., "APP_START", "DOWNLOAD_COMPLETED")
    private String userEmail;     // Optional: User email
    private String userName;      // Optional: User name
    private String message;       // Event message/description
    private String metadata;      // Optional: Additional metadata (JSON or text)
}
