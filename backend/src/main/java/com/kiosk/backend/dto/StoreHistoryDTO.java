package com.kiosk.backend.dto;

import com.kiosk.backend.entity.StoreHistory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreHistoryDTO {

    private Long id;
    private Long storeId;
    private String posid;
    private String action;
    private String userid;
    private String username;
    private LocalDateTime timestamp;
    private String fieldName;
    private String oldValue;
    private String newValue;
    private String description;

    public static StoreHistoryDTO fromEntity(StoreHistory entity) {
        return StoreHistoryDTO.builder()
                .id(entity.getId())
                .storeId(entity.getStoreId())
                .posid(entity.getPosid())
                .action(entity.getAction().toString())
                .userid(entity.getUserid())
                .username(entity.getUsername())
                .timestamp(entity.getTimestamp())
                .fieldName(entity.getFieldName())
                .oldValue(entity.getOldValue())
                .newValue(entity.getNewValue())
                .description(entity.getDescription())
                .build();
    }
}
