package com.kiosk.backend.controller;

import com.kiosk.backend.dto.KioskStatusRequest;
import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.repository.KioskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Kiosk Status Monitoring Controller
 *
 * This controller allows kiosks to report their status without authentication.
 * This is critical for monitoring unattended kiosks that may have token expiration issues.
 *
 * Security: Uses kioskId as identifier. While not authenticated, it only updates
 * status fields and doesn't expose sensitive data or allow critical operations.
 */
@RestController
@RequestMapping("/api/kiosk-status")
@RequiredArgsConstructor
@Slf4j
public class KioskStatusController {

    private final KioskRepository kioskRepository;

    /**
     * Report kiosk status (heartbeat)
     * No authentication required - allows monitoring even when tokens are expired
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<?> reportStatus(@RequestBody KioskStatusRequest request) {
        try {
            log.info("[HEARTBEAT] Received from kioskId: {}", request.getKioskId());

            // Validate kioskId
            if (request.getKioskId() == null || request.getKioskId().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "kioskId is required"));
            }

            // Find kiosk
            Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(request.getKioskId());
            if (kioskOpt.isEmpty()) {
                log.warn("[HEARTBEAT] Kiosk not found: {}", request.getKioskId());
                return ResponseEntity.status(404)
                        .body(Map.of("error", "Kiosk not found"));
            }

            Kiosk kiosk = kioskOpt.get();

            // Update heartbeat timestamp
            kiosk.setLastHeartbeat(LocalDateTime.now());

            // Update app version if provided
            if (request.getAppVersion() != null && !request.getAppVersion().trim().isEmpty()) {
                kiosk.setAppVersion(request.getAppVersion());
            }

            // Update connection status if provided
            if (request.getConnectionStatus() != null) {
                try {
                    Kiosk.ConnectionStatus status = Kiosk.ConnectionStatus.valueOf(
                            request.getConnectionStatus().toUpperCase()
                    );
                    kiosk.setConnectionStatus(status);
                } catch (IllegalArgumentException e) {
                    log.warn("[HEARTBEAT] Invalid connection status: {}", request.getConnectionStatus());
                }
            }

            // Update error message if provided
            if (request.getErrorMessage() != null) {
                // Truncate to 500 chars
                String errorMsg = request.getErrorMessage();
                if (errorMsg.length() > 500) {
                    errorMsg = errorMsg.substring(0, 500);
                }
                kiosk.setLastErrorMessage(errorMsg);
            }

            // Update login status if provided
            if (request.getIsLoggedIn() != null) {
                kiosk.setIsLoggedIn(request.getIsLoggedIn());
            }

            // Update device info if provided
            if (request.getOsType() != null && !request.getOsType().trim().isEmpty()) {
                kiosk.setOsType(request.getOsType());
            }
            if (request.getOsVersion() != null && !request.getOsVersion().trim().isEmpty()) {
                kiosk.setOsVersion(request.getOsVersion());
            }
            if (request.getDeviceName() != null && !request.getDeviceName().trim().isEmpty()) {
                kiosk.setDeviceName(request.getDeviceName());
            }

            // Save updated kiosk
            kioskRepository.save(kiosk);

            log.info("[HEARTBEAT] Updated kiosk {} - Status: {}, Logged in: {}, Version: {}",
                    request.getKioskId(),
                    kiosk.getConnectionStatus(),
                    kiosk.getIsLoggedIn(),
                    kiosk.getAppVersion());

            return ResponseEntity.ok(Map.of(
                    "message", "Status updated successfully",
                    "timestamp", LocalDateTime.now()
            ));

        } catch (Exception e) {
            log.error("[HEARTBEAT] Error updating status for kiosk {}: {}",
                    request.getKioskId(), e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to update status: " + e.getMessage()));
        }
    }

    /**
     * Get kiosk status (for admin monitoring)
     * Returns status information for specific kiosk
     */
    @GetMapping("/{kioskId}")
    public ResponseEntity<?> getKioskStatus(@PathVariable String kioskId) {
        try {
            Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(kioskId);
            if (kioskOpt.isEmpty()) {
                return ResponseEntity.status(404)
                        .body(Map.of("error", "Kiosk not found"));
            }

            Kiosk kiosk = kioskOpt.get();

            // Calculate if kiosk is online (heartbeat within last 5 minutes)
            boolean isOnline = false;
            if (kiosk.getLastHeartbeat() != null) {
                LocalDateTime fiveMinutesAgo = LocalDateTime.now().minusMinutes(5);
                isOnline = kiosk.getLastHeartbeat().isAfter(fiveMinutesAgo);
            }

            return ResponseEntity.ok(Map.of(
                    "kioskId", kiosk.getKioskid(),
                    "lastHeartbeat", kiosk.getLastHeartbeat() != null ? kiosk.getLastHeartbeat().toString() : null,
                    "appVersion", kiosk.getAppVersion() != null ? kiosk.getAppVersion() : "Unknown",
                    "connectionStatus", kiosk.getConnectionStatus() != null ? kiosk.getConnectionStatus().toString() : "UNKNOWN",
                    "isOnline", isOnline,
                    "isLoggedIn", kiosk.getIsLoggedIn() != null ? kiosk.getIsLoggedIn() : false,
                    "lastErrorMessage", kiosk.getLastErrorMessage(),
                    "osType", kiosk.getOsType(),
                    "osVersion", kiosk.getOsVersion(),
                    "deviceName", kiosk.getDeviceName()
            ));

        } catch (Exception e) {
            log.error("[STATUS] Error getting status for kiosk {}: {}", kioskId, e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to get status: " + e.getMessage()));
        }
    }
}
