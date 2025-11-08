package com.kiosk.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateKioskRequest {

    @Size(max = 8, message = "POS ID must be 8 characters")
    private String posid; // Store ID

    @Min(value = 1, message = "Kiosk number must be at least 1")
    private Integer kioskno;

    @Size(max = 100, message = "Maker must be less than 100 characters")
    private String maker;

    @Size(max = 100, message = "Serial number must be less than 100 characters")
    private String serialno;

    private String state; // ACTIVE, INACTIVE, MAINTENANCE, DELETED

    private Long menuId; // Associated menu (XML file with imagePurpose=MENU)

    private String regdate; // ISO 8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)

    private String setdate; // ISO 8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)

    private String deldate; // ISO 8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
}
