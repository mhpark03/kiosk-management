package com.kiosk.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskConfigSyncResponse {
    private String message;
    private Boolean configUpdated;
    private KioskConfigDTO updatedConfig;
}
