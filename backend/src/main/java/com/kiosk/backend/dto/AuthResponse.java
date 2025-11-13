package com.kiosk.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {

    private String token;  // Access token
    private String refreshToken;
    private String type = "Bearer";
    private String email;
    private String displayName;
    private String role;

    public AuthResponse(String token, String email, String displayName, String role) {
        this.token = token;
        this.email = email;
        this.displayName = displayName;
        this.role = role;
    }
}
