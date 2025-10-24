package com.kiosk.backend.controller;

import com.kiosk.backend.dto.UserDTO;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Admin-only endpoints for user management and approval.
 * All endpoints require ADMIN role.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final UserService userService;

    /**
     * Get all users pending approval.
     * GET /api/admin/users/pending
     */
    @GetMapping("/users/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDTO>> getPendingUsers() {
        log.info("GET /api/admin/users/pending - Fetching pending approval users");
        List<User> pendingUsers = userService.getPendingApprovalUsers();
        List<UserDTO> userDTOs = pendingUsers.stream()
                .map(UserDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(userDTOs);
    }

    /**
     * Approve a user's registration.
     * POST /api/admin/users/{email}/approve
     */
    @PostMapping("/users/{email}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> approveUser(@PathVariable String email) {
        log.info("POST /api/admin/users/{}/approve - Approving user", email);
        try {
            userService.approveUser(email);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("Failed to approve user: {}", email, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Reject a user's registration.
     * POST /api/admin/users/{email}/reject
     */
    @PostMapping("/users/{email}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> rejectUser(@PathVariable String email) {
        log.info("POST /api/admin/users/{}/reject - Rejecting user registration", email);
        try {
            userService.rejectUser(email);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("Failed to reject user: {}", email, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get all users (for admin dashboard).
     * GET /api/admin/users
     */
    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        log.info("GET /api/admin/users - Fetching all users");
        List<User> users = userService.getAllUsers();
        List<UserDTO> userDTOs = users.stream()
                .map(UserDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(userDTOs);
    }
}
