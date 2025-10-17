package com.kiosk.backend.dto;

import com.kiosk.backend.entity.EntityHistory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntityHistoryDTO {

    private Long id;
    private String entityType; // KIOSK or STORE
    private String entityId;
    private String posid;
    private String userid;
    private String username;
    private String action;
    private LocalDateTime timestamp;
    private String fieldName;
    private String oldValue;
    private String newValue;
    private String description;
    private String detail;

    // Convert Entity to DTO
    public static EntityHistoryDTO fromEntity(EntityHistory entity) {
        if (entity == null) {
            return null;
        }

        return EntityHistoryDTO.builder()
                .id(entity.getId())
                .entityType(entity.getEntityType().name())
                .entityId(entity.getEntityId())
                .posid(entity.getPosid())
                .userid(entity.getUserid())
                .username(entity.getUsername())
                .action(entity.getAction().name())
                .timestamp(entity.getTimestamp())
                .fieldName(entity.getFieldName())
                .oldValue(entity.getOldValue())
                .newValue(entity.getNewValue())
                .description(entity.getDescription())
                .detail(entity.getDetail())
                .build();
    }
}
