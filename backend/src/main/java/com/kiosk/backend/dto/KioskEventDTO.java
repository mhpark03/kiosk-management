package com.kiosk.backend.dto;

import com.kiosk.backend.entity.KioskEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KioskEventDTO {

    private Long id;
    private Long kioskId;
    private String kioskid;
    private String posid;
    private Integer kioskno;
    private String eventType;
    private String userEmail;
    private String userName;
    private String message;
    private String metadata;
    private LocalDateTime timestamp;

    // Device information from Kiosk
    private String osType; // Operating system type (e.g., Windows, Android)
    private String osVersion; // Operating system version (e.g., Windows 10, Android 12)
    private String deviceName; // Device name/hostname

    // Convert Entity to DTO
    public static KioskEventDTO fromEntity(KioskEvent entity) {
        if (entity == null) {
            return null;
        }

        KioskEventDTO dto = new KioskEventDTO();
        dto.setId(entity.getId());
        dto.setKioskId(entity.getKioskId());
        dto.setKioskid(entity.getKioskid());
        dto.setPosid(entity.getPosid());
        dto.setKioskno(entity.getKioskno());
        dto.setEventType(entity.getEventType() != null ? entity.getEventType().name() : null);
        dto.setUserEmail(entity.getUserEmail());
        dto.setUserName(entity.getUserName());
        dto.setMessage(entity.getMessage());
        dto.setMetadata(entity.getMetadata());
        dto.setTimestamp(entity.getTimestamp());

        // Add device information from Kiosk entity if available
        if (entity.getKiosk() != null) {
            dto.setOsType(entity.getKiosk().getOsType());
            dto.setOsVersion(entity.getKiosk().getOsVersion());
            dto.setDeviceName(entity.getKiosk().getDeviceName());
        }

        return dto;
    }

    // Explicit getter/setter for kioskId
    public Long getKioskId() {
        return kioskId;
    }

    public void setKioskId(Long kioskId) {
        this.kioskId = kioskId;
    }

    // Explicit setters for lowercase fields
    public String getKioskid() {
        return kioskid;
    }

    public void setKioskid(String kioskid) {
        this.kioskid = kioskid;
    }

    public String getPosid() {
        return posid;
    }

    public void setPosid(String posid) {
        this.posid = posid;
    }
}
