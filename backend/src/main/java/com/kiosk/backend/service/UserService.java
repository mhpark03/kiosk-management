package com.kiosk.backend.service;

import com.kiosk.backend.dto.AuthResponse;
import com.kiosk.backend.dto.LoginRequest;
import com.kiosk.backend.dto.SignupRequest;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.repository.EntityHistoryRepository;
import com.kiosk.backend.repository.KioskRepository;
import com.kiosk.backend.repository.UserRepository;
import com.kiosk.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final EntityHistoryRepository entityHistoryRepository;
    private final KioskEventService kioskEventService;
    private final KioskRepository kioskRepository;

        @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        // Count total existing users (including all statuses)
        long totalUsers = userRepository.count();
        
        // First 2 users become ADMIN with ACTIVE status
        // 3rd user onwards become USER with PENDING_APPROVAL status
        User.UserRole assignedRole;
        User.UserStatus assignedStatus;
        
        if (totalUsers < 2) {
            assignedRole = User.UserRole.ADMIN;
            assignedStatus = User.UserStatus.ACTIVE;
            log.info("Assigning ADMIN role to user {} (user #{} in system)", 
                     request.getEmail(), totalUsers + 1);
        } else {
            assignedRole = User.UserRole.USER;
            assignedStatus = User.UserStatus.PENDING_APPROVAL;
            log.info("Assigning USER role with PENDING_APPROVAL status to user {} (user #{} in system)", 
                     request.getEmail(), totalUsers + 1);
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName())
                .phoneNumber(request.getPhoneNumber())
                .role(assignedRole)
                .status(assignedStatus)
                .emailVerified(false)
                .build();

        User savedUser = userRepository.save(user);
        log.info("User registered successfully: {} with role: {} and status: {}", 
                 savedUser.getEmail(), savedUser.getRole(), savedUser.getStatus());

        // Only generate token and allow login for ACTIVE users
        // Users with PENDING_APPROVAL status cannot log in until approved
        if (savedUser.getStatus() == User.UserStatus.ACTIVE) {
            String token = tokenProvider.generateToken(savedUser.getEmail());
            return AuthResponse.builder()
                    .token(token)
                    .email(savedUser.getEmail())
                    .displayName(savedUser.getDisplayName())
                    .role(savedUser.getRole().name())
                    .build();
        } else {
            // Return response without token for pending approval users
            return AuthResponse.builder()
                    .email(savedUser.getEmail())
                    .displayName(savedUser.getDisplayName())
                    .role(savedUser.getRole().name())
                    .build();
        }
    }


    @Transactional
    public AuthResponse login(LoginRequest request) {
        return login(request, null, null);
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String kioskId, String clientIp) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        String token = tokenProvider.generateToken(authentication);

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Log login event
        logUserActivity(user.getEmail(), user.getDisplayName(), "LOGIN", "User logged in successfully");

        // Record kiosk event if kiosk ID is provided
        if (kioskId != null && !kioskId.isEmpty()) {
            try {
                Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(kioskId);
                String kioskInfo = kioskOpt.map(k -> k.getPosid() + " #" + k.getKioskno()).orElse(kioskId);

                kioskEventService.recordEvent(
                    kioskId,
                    KioskEvent.EventType.USER_LOGIN,
                    user.getEmail(),
                    user.getDisplayName(),
                    "사용자 로그인: " + user.getDisplayName() + " (" + user.getEmail() + ")",
                    String.format("{\"userEmail\": \"%s\", \"userName\": \"%s\", \"kioskInfo\": \"%s\"}",
                        user.getEmail(), user.getDisplayName(), kioskInfo),
                    clientIp
                );
                log.info("Kiosk login event recorded for user {} on kiosk {}", user.getEmail(), kioskId);
            } catch (Exception e) {
                log.error("Failed to record kiosk login event: {}", e.getMessage());
            }
        }

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .role(user.getRole().name())
                .build();
    }

    @Transactional
    public void logout(String kioskId, String userEmail, String clientIp) {
        // Record kiosk logout event if kiosk ID is provided
        if (kioskId != null && !kioskId.isEmpty()) {
            try {
                Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(kioskId);
                String kioskInfo = kioskOpt.map(k -> k.getPosid() + " #" + k.getKioskno()).orElse(kioskId);

                // Try to get user information
                String userName = null;
                if (userEmail != null && !userEmail.isEmpty()) {
                    Optional<User> userOpt = userRepository.findByEmail(userEmail);
                    userName = userOpt.map(User::getDisplayName).orElse(null);
                }

                kioskEventService.recordEvent(
                    kioskId,
                    KioskEvent.EventType.USER_LOGOUT,
                    userEmail,
                    userName,
                    "사용자 로그아웃" + (userEmail != null ? ": " + userEmail : ""),
                    String.format("{\"userEmail\": \"%s\", \"userName\": \"%s\", \"kioskInfo\": \"%s\"}",
                        userEmail != null ? userEmail : "unknown",
                        userName != null ? userName : "unknown",
                        kioskInfo),
                    clientIp
                );
                log.info("Kiosk logout event recorded for user {} on kiosk {}", userEmail, kioskId);
            } catch (Exception e) {
                log.error("Failed to record kiosk logout event: {}", e.getMessage());
            }
        }
    }

    @Transactional(readOnly = true)
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public User updateProfile(String displayName, String memo, String phoneNumber) {
        User user = getCurrentUser();
        String oldDisplayName = user.getDisplayName();
        String oldMemo = user.getMemo();
        String oldPhoneNumber = user.getPhoneNumber();

        if (displayName != null && !displayName.isBlank()) {
            user.setDisplayName(displayName);
        }

        user.setMemo(memo);
        user.setPhoneNumber(phoneNumber);

        User updatedUser = userRepository.save(user);
        log.info("User profile updated: {}", updatedUser.getEmail());

        // Log profile update
        if (!oldDisplayName.equals(updatedUser.getDisplayName())) {
            logUserActivity(updatedUser.getEmail(), updatedUser.getDisplayName(), "UPDATE",
                "Display name changed", "displayName", oldDisplayName, updatedUser.getDisplayName());
        }
        if ((oldMemo == null && memo != null) || (oldMemo != null && !oldMemo.equals(memo))) {
            logUserActivity(updatedUser.getEmail(), updatedUser.getDisplayName(), "UPDATE",
                "User memo updated", "memo", oldMemo, memo);
        }
        if ((oldPhoneNumber == null && phoneNumber != null) || (oldPhoneNumber != null && !oldPhoneNumber.equals(phoneNumber))) {
            logUserActivity(updatedUser.getEmail(), updatedUser.getDisplayName(), "UPDATE",
                "Phone number updated", "phoneNumber", oldPhoneNumber, phoneNumber);
        }

        return updatedUser;
    }

    @Transactional
    public void changePassword(String currentPassword, String newPassword) {
        User user = getCurrentUser();

        // Verify current password
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        // Update password
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Log password change
        logUserActivity(user.getEmail(), user.getDisplayName(), "PASSWORD_CHANGE",
            "User changed password");

        log.info("Password changed for user: {}", user.getEmail());
    }

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public void suspendUser(String email) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (targetUser.getStatus() == User.UserStatus.SUSPENDED) {
            throw new RuntimeException("User is already suspended");
        }

        if (targetUser.getEmail().equals(currentUser.getEmail())) {
            throw new RuntimeException("Cannot suspend yourself");
        }

        String oldStatus = targetUser.getStatus().name();
        targetUser.setStatus(User.UserStatus.SUSPENDED);
        userRepository.save(targetUser);

        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "SUSPEND",
            "User suspended: " + targetUser.getEmail(), "status", oldStatus, "SUSPENDED");

        log.info("User suspended: {} by {}", email, currentUser.getEmail());
    }

    @Transactional
    public void activateUser(String email) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (targetUser.getStatus() == User.UserStatus.ACTIVE) {
            throw new RuntimeException("User is already active");
        }

        String oldStatus = targetUser.getStatus().name();
        targetUser.setStatus(User.UserStatus.ACTIVE);
        userRepository.save(targetUser);

        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "ACTIVATE",
            "User activated: " + targetUser.getEmail(), "status", oldStatus, "ACTIVE");

        log.info("User activated: {} by {}", email, currentUser.getEmail());
    }

    @Transactional
    public void deleteUser(String email) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (targetUser.getEmail().equals(currentUser.getEmail())) {
            throw new RuntimeException("Cannot delete yourself");
        }

        // Log deletion before actually deleting the user
        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "DELETE",
            "User deleted: " + targetUser.getEmail() + " (displayName: " + targetUser.getDisplayName() + ")",
            "status", targetUser.getStatus().name(), "DELETED");

        // Actually delete the user from database
        userRepository.delete(targetUser);

        log.info("User permanently deleted from database: {} by {}", email, currentUser.getEmail());
    }

    @Transactional
    public void updateUserRole(String email, String role) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (targetUser.getEmail().equals(currentUser.getEmail())) {
            throw new RuntimeException("Cannot change your own role");
        }

        String oldRole = targetUser.getRole().name();
        User.UserRole newRole = User.UserRole.valueOf(role);

        if (targetUser.getRole() == newRole) {
            throw new RuntimeException("User already has this role");
        }

        targetUser.setRole(newRole);
        userRepository.save(targetUser);

        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "UPDATE",
            "User role changed: " + targetUser.getEmail(), "role", oldRole, newRole.name());

        log.info("User role updated: {} to {} by {}", email, role, currentUser.getEmail());
    }

    @Transactional
    public User updateUserProfile(String email, String displayName, String memo, String phoneNumber) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String oldDisplayName = targetUser.getDisplayName();
        String oldMemo = targetUser.getMemo();
        String oldPhoneNumber = targetUser.getPhoneNumber();

        if (displayName != null && !displayName.isBlank()) {
            targetUser.setDisplayName(displayName);
        }

        targetUser.setMemo(memo);
        targetUser.setPhoneNumber(phoneNumber);

        User updatedUser = userRepository.save(targetUser);
        log.info("User profile updated by admin: {} by {}", updatedUser.getEmail(), currentUser.getEmail());

        // Log profile update
        if (!oldDisplayName.equals(updatedUser.getDisplayName())) {
            logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "UPDATE",
                "Admin updated display name for: " + updatedUser.getEmail(), "displayName", oldDisplayName, updatedUser.getDisplayName());
        }
        if ((oldMemo == null && memo != null) || (oldMemo != null && !oldMemo.equals(memo))) {
            logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "UPDATE",
                "Admin updated memo for: " + updatedUser.getEmail(), "memo", oldMemo, memo);
        }
        if ((oldPhoneNumber == null && phoneNumber != null) || (oldPhoneNumber != null && !oldPhoneNumber.equals(phoneNumber))) {
            logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "UPDATE",
                "Admin updated phone number for: " + updatedUser.getEmail(), "phoneNumber", oldPhoneNumber, phoneNumber);
        }

        return updatedUser;
    }

    @Transactional
    public void deleteMyAccount() {
        User currentUser = getCurrentUser();

        // Log deletion before actually deleting the user
        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "DELETE",
            "User deleted their own account (displayName: " + currentUser.getDisplayName() + ")",
            "status", currentUser.getStatus().name(), "DELETED");

        // Actually delete the user from database
        userRepository.delete(currentUser);

        log.info("User permanently deleted their own account: {}", currentUser.getEmail());
    }

    private void logUserActivity(String email, String displayName, String action, String description) {
        logUserActivity(email, displayName, action, description, null, null, null);
    }

    private void logUserActivity(String email, String displayName, String action, String description,
                                  String fieldName, String oldValue, String newValue) {
        EntityHistory history = EntityHistory.builder()
                .entityType(EntityHistory.EntityType.USER)
                .entityId(email)
                .userid(email)
                .username(displayName)
                .action(EntityHistory.ActionType.valueOf(action))
                .description(description)
                .fieldName(fieldName)
                .oldValue(oldValue)
                .newValue(newValue)
                .timestamp(LocalDateTime.now())
                .build();

        entityHistoryRepository.save(history);
        log.debug("User activity logged: {} - {}", email, action);
    }

    /**
     * Get all users with PENDING_APPROVAL status.
     * Only accessible by ADMIN users.
     */
    @Transactional(readOnly = true)
    public List<User> getPendingApprovalUsers() {
        return userRepository.findByRoleAndStatus(User.UserRole.USER, User.UserStatus.PENDING_APPROVAL);
    }

    /**
     * Approve a user's registration.
     * Changes status from PENDING_APPROVAL to ACTIVE.
     * Only accessible by ADMIN users.
     */
    @Transactional
    public void approveUser(String email) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (targetUser.getStatus() != User.UserStatus.PENDING_APPROVAL) {
            throw new RuntimeException("User is not pending approval");
        }

        String oldStatus = targetUser.getStatus().name();
        targetUser.setStatus(User.UserStatus.ACTIVE);
        userRepository.save(targetUser);

        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "ACTIVATE",
            "User approved: " + targetUser.getEmail(), "status", oldStatus, "ACTIVE");

        log.info("User approved: {} by {}", email, currentUser.getEmail());
    }

    /**
     * Reject a user's registration.
     * Deletes the user from the system.
     * Only accessible by ADMIN users.
     */
    @Transactional
    public void rejectUser(String email) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (targetUser.getStatus() != User.UserStatus.PENDING_APPROVAL) {
            throw new RuntimeException("User is not pending approval");
        }

        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "DELETE",
            "User registration rejected: " + targetUser.getEmail() + " (displayName: " + targetUser.getDisplayName() + ")",
            "status", targetUser.getStatus().name(), "DELETED");

        userRepository.delete(targetUser);

        log.info("User registration rejected and deleted: {} by {}", email, currentUser.getEmail());
    }

    /**
     * Reset user password (Admin only)
     */
    @Transactional
    public void resetUserPassword(String email, String newPassword) {
        User currentUser = getCurrentUser();
        User targetUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String encodedPassword = passwordEncoder.encode(newPassword);
        targetUser.setPassword(encodedPassword);
        userRepository.save(targetUser);

        logUserActivity(currentUser.getEmail(), currentUser.getDisplayName(), "UPDATE",
            "Password reset for user: " + targetUser.getEmail(),
            "password", "***", "***");

        log.info("Password reset for user: {} by {}", email, currentUser.getEmail());
    }

    /**
     * Reset password by verifying email and display name (No authentication required)
     */
    @Transactional
    public void resetPasswordWithVerification(String email, String displayName, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("이메일 또는 이름이 일치하지 않습니다."));

        // Verify display name matches
        if (!user.getDisplayName().equals(displayName)) {
            throw new RuntimeException("이메일 또는 이름이 일치하지 않습니다.");
        }

        // Encode and set new password
        String encodedPassword = passwordEncoder.encode(newPassword);
        user.setPassword(encodedPassword);
        userRepository.save(user);

        // Log the password reset activity
        logUserActivity(email, displayName, "UPDATE",
            "Password reset by user verification (email + name)",
            "password", "***", "***");

        log.info("Password reset successful for user: {} (verified by email and name)", email);
    }
}
