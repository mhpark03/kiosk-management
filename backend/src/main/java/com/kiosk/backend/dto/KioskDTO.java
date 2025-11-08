package com.kiosk.backend.dto;

import com.kiosk.backend.entity.Kiosk;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskDTO {

    private Long id;
    private String kioskid;
    private String posid;
    private String posname; // Store name
    private Integer kioskno;
    private String maker;
    private String serialno;
    private String state;
    private LocalDateTime regdate;
    private LocalDateTime setdate;
    private LocalDateTime deldate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime storeRegdate; // Store's registration date for validation

    // Device information
    private String osType; // Operating system type (e.g., Windows, Android)
    private String osVersion; // Operating system version (e.g., Windows 10, Android 12)
    private String deviceName; // Device name/hostname

    // Menu assignment
    private Long menuId; // Associated menu (XML file with imagePurpose=MENU)
    private String menuFilename; // Menu file name (original filename from video)
    private String menuDownloadStatus; // Menu download status (PENDING, DOWNLOADING, COMPLETED, FAILED)

    // Video statistics
    private Integer totalVideoCount; // Total number of videos assigned to this kiosk
    private Integer downloadedVideoCount; // Number of videos with COMPLETED download status

    // Transient fields for tracking changes (not persisted, used for notifications)
    private Long oldMenuId; // Previous menu ID before update
    private Boolean menuIdChanged; // Whether menuId was changed in this update

    // Convert Entity to DTO
    public static KioskDTO fromEntity(Kiosk kiosk) {
        return KioskDTO.builder()
                .id(kiosk.getId())
                .kioskid(kiosk.getKioskid())
                .posid(kiosk.getPosid())
                .kioskno(kiosk.getKioskno())
                .maker(kiosk.getMaker())
                .serialno(kiosk.getSerialno())
                .state(kiosk.getState().name())
                .regdate(kiosk.getRegdate())
                .setdate(kiosk.getSetdate())
                .deldate(kiosk.getDeldate())
                .createdAt(kiosk.getCreatedAt())
                .updatedAt(kiosk.getUpdatedAt())
                .osType(kiosk.getOsType())
                .osVersion(kiosk.getOsVersion())
                .deviceName(kiosk.getDeviceName())
                .menuId(kiosk.getMenuId())
                .menuFilename(kiosk.getMenuFilename())
                .menuDownloadStatus(kiosk.getMenuDownloadStatus())
                .build();
    }
}
