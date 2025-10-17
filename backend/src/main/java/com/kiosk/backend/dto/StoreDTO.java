package com.kiosk.backend.dto;

import com.kiosk.backend.entity.Store;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreDTO {

    private Long id;
    private String posid;
    private String posname;
    private String postcode;
    private String address;
    private String addressDetail;
    private String state;
    private String userid;
    private LocalDateTime regdate;
    private LocalDateTime startdate;
    private LocalDateTime deldate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Convert Entity to DTO
    public static StoreDTO fromEntity(Store store) {
        return StoreDTO.builder()
                .id(store.getId())
                .posid(store.getPosid())
                .posname(store.getPosname())
                .postcode(store.getPostcode())
                .address(store.getAddress())
                .addressDetail(store.getAddressDetail())
                .state(store.getState().name())
                .userid(store.getUserid())
                .regdate(store.getRegdate())
                .startdate(store.getStartdate())
                .deldate(store.getDeldate())
                .createdAt(store.getCreatedAt())
                .updatedAt(store.getUpdatedAt())
                .build();
    }
}
