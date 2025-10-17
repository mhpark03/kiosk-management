package com.kiosk.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStoreRequest {

    @NotBlank(message = "Store name is required")
    @Size(max = 200, message = "Store name must be less than 200 characters")
    private String posname;

    @Size(max = 20, message = "Postcode must be less than 20 characters")
    private String postcode;

    @Size(max = 500, message = "Address must be less than 500 characters")
    private String address;

    @Size(max = 500, message = "Address detail must be less than 500 characters")
    private String addressDetail;

    private String state; // ACTIVE, INACTIVE

    private String regdate; // ISO 8601 date string (YYYY-MM-DD)

    private String enddate; // ISO 8601 date string (YYYY-MM-DD)
}
