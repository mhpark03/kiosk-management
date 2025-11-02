package com.kiosk.backend.dto;

import lombok.Data;

@Data
public class KioskStatusRequest {
    private String kioskId;          // 12-digit kiosk ID
    private String appVersion;       // App version (e.g., "1.0.0")
    private String connectionStatus; // ONLINE, ERROR
    private String errorMessage;     // Optional error message
    private Boolean isLoggedIn;      // Whether user is logged in
    private String osType;           // OS type (Windows, Android)
    private String osVersion;        // OS version
    private String deviceName;       // Device hostname
}
