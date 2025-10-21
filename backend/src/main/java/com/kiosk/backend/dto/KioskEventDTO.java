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

    // Convert Entity to DTO
    public static KioskEventDTO fromEntity(KioskEvent entity) {
        if (entity == null) {
            return null;
        }

        return KioskEventDTO.builder()
                .id(entity.getId())
                .kioskId(entity.getKioskId())
                .kioskid(entity.getKioskid())
                .posid(entity.getPosid())
                .kioskno(entity.getKioskno())
                .eventType(entity.getEventType().name())
                .userEmail(entity.getUserEmail())
                .userName(entity.getUserName())
                .message(entity.getMessage())
                .metadata(entity.getMetadata())
                .timestamp(entity.getTimestamp())
                .build();
    }
}
