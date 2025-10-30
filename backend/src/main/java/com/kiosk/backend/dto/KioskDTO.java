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

    // Video statistics
    private Integer totalVideoCount; // Total number of videos assigned to this kiosk
    private Integer downloadedVideoCount; // Number of videos with COMPLETED download status

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
                .build();
    }
}
