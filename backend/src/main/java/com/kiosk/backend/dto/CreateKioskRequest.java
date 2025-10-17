package com.kiosk.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateKioskRequest {

    @NotBlank(message = "POS ID is required")
    @Size(max = 8, message = "POS ID must be 8 characters")
    private String posid;

    @Min(value = 1, message = "Kiosk number must be at least 1")
    private Integer kioskno; // Optional, will be auto-generated if not provided

    @Size(max = 100, message = "Maker must be less than 100 characters")
    private String maker;

    @Size(max = 100, message = "Serial number must be less than 100 characters")
    private String serialno;

    private String state; // ACTIVE, INACTIVE, MAINTENANCE
}
