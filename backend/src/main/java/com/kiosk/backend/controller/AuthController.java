package com.kiosk.backend.controller;

import com.kiosk.backend.annotation.RecordActivity;
import com.kiosk.backend.dto.AuthResponse;
import com.kiosk.backend.dto.LoginRequest;
import com.kiosk.backend.dto.PasswordChangeRequest;
import com.kiosk.backend.dto.PasswordResetRequest;
import com.kiosk.backend.dto.ProfileUpdateRequest;
import com.kiosk.backend.dto.RefreshTokenRequest;
import com.kiosk.backend.dto.SignupRequest;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.service.RefreshTokenService;
import com.kiosk.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserService userService;
    private final RefreshTokenService refreshTokenService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        AuthResponse response = userService.signup(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        // Extract kiosk information from headers
        String kioskId = httpRequest.getHeader("X-Kiosk-Id");
        String clientIp = extractClientIp(httpRequest);

        AuthResponse response = userService.login(request, kioskId, clientIp);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    @RecordActivity(
        entityType = EntityHistory.EntityType.USER,
        action = EntityHistory.ActionType.LOGOUT,
        description = "로그아웃"
    )
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest httpRequest) {
        String kioskId = httpRequest.getHeader("X-Kiosk-Id");
        String clientIp = extractClientIp(httpRequest);
        String userEmail = httpRequest.getHeader("X-User-Email");

        // Get user info before logout for event recording
        User currentUser = null;
        try {
            currentUser = userService.getCurrentUser();
        } catch (Exception e) {
            // If user retrieval fails, still proceed with logout
        }

        userService.logout(kioskId, userEmail, clientIp);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Logged out successfully");

        // Include user info for automatic event recording
        if (currentUser != null) {
            response.put("id", currentUser.getId());
            response.put("email", currentUser.getEmail());
        }

        return ResponseEntity.ok(response);
    }

    private String extractClientIp(HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isEmpty()) {
            clientIp = request.getHeader("X-Real-IP");
        }
        if (clientIp == null || clientIp.isEmpty()) {
            clientIp = request.getRemoteAddr();
        }
        // If X-Forwarded-For contains multiple IPs, take the first one
        if (clientIp != null && clientIp.contains(",")) {
            clientIp = clientIp.split(",")[0].trim();
        }
        return clientIp;
    }

    @GetMapping("/me")
    public ResponseEntity<User> getCurrentUser() {
        User user = userService.getCurrentUser();
        return ResponseEntity.ok(user);
    }

    @PutMapping("/profile")
    public ResponseEntity<User> updateProfile(@Valid @RequestBody ProfileUpdateRequest request) {
        User updatedUser = userService.updateProfile(request.getDisplayName(), request.getMemo(), request.getPhoneNumber());
        return ResponseEntity.ok(updatedUser);
    }

    @PutMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        userService.changePassword(request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    @PutMapping("/users/{email}/suspend")
    public ResponseEntity<Void> suspendUser(@PathVariable String email) {
        userService.suspendUser(email);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{email}/activate")
    public ResponseEntity<Void> activateUser(@PathVariable String email) {
        userService.activateUser(email);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/users/{email}")
    public ResponseEntity<Void> deleteUser(@PathVariable String email) {
        userService.deleteUser(email);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{email}/role")
    public ResponseEntity<Void> updateUserRole(@PathVariable String email, @RequestParam String role) {
        userService.updateUserRole(email, role);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{email}/profile")
    public ResponseEntity<User> updateUserProfile(@PathVariable String email, @Valid @RequestBody ProfileUpdateRequest request) {
        User updatedUser = userService.updateUserProfile(email, request.getDisplayName(), request.getMemo(), request.getPhoneNumber());
        return ResponseEntity.ok(updatedUser);
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMyAccount() {
        userService.deleteMyAccount();
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{email}/reset-password")
    public ResponseEntity<Void> resetUserPassword(@PathVariable String email, @RequestParam String newPassword) {
        userService.resetUserPassword(email, newPassword);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        userService.resetPasswordWithVerification(request.getEmail(), request.getDisplayName(), request.getNewPassword());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = userService.refreshAccessToken(request.getRefreshToken());
        return ResponseEntity.ok(response);
    }
}
