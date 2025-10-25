package com.kiosk.backend.dto;

import lombok.Data;

@Data
public class KioskTokenRequest {
    private String posId;
    private String kioskId;
    private Integer kioskNo;
}
