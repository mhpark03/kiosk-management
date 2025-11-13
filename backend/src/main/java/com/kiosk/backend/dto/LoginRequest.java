package com.kiosk.backend.dto;

import com.kiosk.backend.entity.AppType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email should be valid")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

    // App type for managing separate refresh tokens per app
    // Default to WEB if not provided (for backward compatibility)
    private AppType appType = AppType.WEB;
}
