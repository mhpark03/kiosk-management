package com.kiosk.backend.controller;

import com.kiosk.backend.dto.CreateKioskRequest;
import com.kiosk.backend.dto.KioskConfigDTO;
import com.kiosk.backend.dto.KioskDTO;
import com.kiosk.backend.dto.UpdateKioskRequest;
import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.repository.KioskRepository;
import com.kiosk.backend.security.JwtTokenProvider;
import com.kiosk.backend.service.KioskService;
import com.kiosk.backend.websocket.KioskWebSocketController;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/kiosks")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "https://localhost:5173") // Allow React frontend
public class KioskController {

    private final KioskService kioskService;
    private final KioskWebSocketController webSocketController;
    private final KioskRepository kioskRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final com.kiosk.backend.service.KioskEventService kioskEventService;
    private final com.kiosk.backend.websocket.WebSocketSessionManager webSocketSessionManager;

    // SecureRandom for generating unpredictable session versions
    private static final SecureRandom secureRandom = new SecureRandom();

    /**
     * Get all kiosks
     * GET /api/kiosks?includeDeleted=false&posid=xxx&maker=xxx
     */
    @GetMapping
    public ResponseEntity<List<KioskDTO>> getAllKiosks(
            @RequestParam(defaultValue = "false") boolean includeDeleted,
            @RequestParam(required = false) String posid,
            @RequestParam(required = false) String maker) {
        log.info("GET /api/kiosks - includeDeleted: {}, posid: {}, maker: {}", includeDeleted, posid, maker);

        List<KioskDTO> kiosks;
        if (posid != null || maker != null) {
            kiosks = kioskService.getKiosksWithFilter(posid, maker, includeDeleted);
        } else {
            kiosks = kioskService.getAllKiosks(includeDeleted);
        }

        return ResponseEntity.ok(kiosks);
    }

    /**
     * Get kiosk by ID
     * GET /api/kiosks/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<KioskDTO> getKioskById(@PathVariable Long id) {
        log.info("GET /api/kiosks/{}", id);
        KioskDTO kiosk = kioskService.getKioskById(id);
        return ResponseEntity.ok(kiosk);
    }

    /**
     * Get kiosk by Kiosk ID
     * GET /api/kiosks/kioskid/{kioskid}
     */
    @GetMapping("/kioskid/{kioskid}")
    public ResponseEntity<KioskDTO> getKioskByKioskid(@PathVariable String kioskid) {
        log.info("GET /api/kiosks/kioskid/{}", kioskid);
        KioskDTO kiosk = kioskService.getKioskByKioskid(kioskid);
        return ResponseEntity.ok(kiosk);
    }

    /**
     * Get kiosk by Store ID (posid) and Kiosk Number (kioskno)
     * GET /api/kiosks/by-store?posid=xxx&kioskno=9
     */
    @GetMapping("/by-store")
    public ResponseEntity<KioskDTO> getKioskByPosidAndKioskno(
            @RequestParam String posid,
            @RequestParam Integer kioskno) {
        log.info("GET /api/kiosks/by-store - posid: {}, kioskno: {}", posid, kioskno);
        KioskDTO kiosk = kioskService.getKioskByPosidAndKioskno(posid, kioskno);
        return ResponseEntity.ok(kiosk);
    }

    /**
     * Get next available kiosk number for a store
     * GET /api/kiosks/next-number?posid=xxx
     */
    @GetMapping("/next-number")
    public ResponseEntity<Map<String, Integer>> getNextKioskNo(@RequestParam String posid) {
        log.info("GET /api/kiosks/next-number - posid: {}", posid);
        Integer nextKioskNo = kioskService.getNextKioskNo(posid);
        Map<String, Integer> response = new HashMap<>();
        response.put("nextKioskNo", nextKioskNo);
        return ResponseEntity.ok(response);
    }

    /**
     * Create new kiosk
     * POST /api/kiosks
     */
    @PostMapping
    public ResponseEntity<KioskDTO> createKiosk(
            @Valid @RequestBody CreateKioskRequest request,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("POST /api/kiosks - posid: {}, kioskno: {}", request.getPosid(), request.getKioskno());
        KioskDTO createdKiosk = kioskService.createKiosk(request, decodedEmail, decodedUsername);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdKiosk);
    }

    /**
     * Update kiosk
     * PUT /api/kiosks/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<KioskDTO> updateKiosk(
            @PathVariable Long id,
            @Valid @RequestBody UpdateKioskRequest request,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("PUT /api/kiosks/{}", id);
        KioskDTO updatedKiosk = kioskService.updateKiosk(id, request, decodedEmail, decodedUsername);
        return ResponseEntity.ok(updatedKiosk);
    }

    /**
     * Update kiosk state
     * PATCH /api/kiosks/{id}/state
     */
    @PatchMapping("/{id}/state")
    public ResponseEntity<Void> updateKioskState(
            @PathVariable Long id,
            @RequestParam String state,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("PATCH /api/kiosks/{}/state - newState: {}", id, state);
        kioskService.updateKioskState(id, state, decodedEmail, decodedUsername);
        return ResponseEntity.ok().build();
    }

    /**
     * Soft delete kiosk
     * DELETE /api/kiosks/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDeleteKiosk(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("DELETE /api/kiosks/{}", id);
        kioskService.softDeleteKiosk(id, decodedEmail, decodedUsername);
        return ResponseEntity.noContent().build();
    }

    /**
     * Restore deleted kiosk
     * POST /api/kiosks/{id}/restore
     */
    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restoreKiosk(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("POST /api/kiosks/{}/restore", id);
        kioskService.restoreKiosk(id, decodedEmail, decodedUsername);
        return ResponseEntity.ok().build();
    }

    /**
     * Permanently delete kiosk
     * DELETE /api/kiosks/{id}/permanent
     */
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDeleteKiosk(@PathVariable Long id) {
        log.info("DELETE /api/kiosks/{}/permanent", id);
        kioskService.permanentDeleteKiosk(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Assign videos to a kiosk
     * POST /api/kiosks/{id}/videos
     */
    @PostMapping("/{id}/videos")
    public ResponseEntity<Map<String, Object>> assignVideos(
            @PathVariable Long id,
            @RequestBody Map<String, List<? extends Number>> request,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        List<? extends Number> rawVideoIds = request.get("videoIds");
        List<Long> videoIds = rawVideoIds.stream()
                .map(Number::longValue)
                .collect(java.util.stream.Collectors.toList());

        log.info("POST /api/kiosks/{}/videos - assigning {} videos", id, videoIds.size());
        kioskService.assignVideosToKiosk(id, videoIds, decodedEmail);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Videos assigned successfully");
        response.put("count", videoIds.size());
        return ResponseEntity.ok(response);
    }

    /**
     * Get videos assigned to a kiosk
     * GET /api/kiosks/{id}/videos
     */
    @GetMapping("/{id}/videos")
    public ResponseEntity<Map<String, List<Long>>> getKioskVideos(@PathVariable Long id) {
        log.info("GET /api/kiosks/{}/videos", id);
        List<Long> videoIds = kioskService.getKioskVideos(id);

        Map<String, List<Long>> response = new HashMap<>();
        response.put("videoIds", videoIds);
        return ResponseEntity.ok(response);
    }

    /**
     * Remove a video from a kiosk
     * DELETE /api/kiosks/{id}/videos/{videoId}
     */
    @DeleteMapping("/{id}/videos/{videoId}")
    public ResponseEntity<Map<String, String>> removeVideo(
            @PathVariable Long id,
            @PathVariable Long videoId,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);

        log.info("DELETE /api/kiosks/{}/videos/{}", id, videoId);
        kioskService.removeVideoFromKiosk(id, videoId, decodedEmail);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Video removed successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Get videos assigned to a kiosk with download status
     * GET /api/kiosks/{id}/videos-with-status
     */
    @GetMapping("/{id}/videos-with-status")
    public ResponseEntity<List<com.kiosk.backend.dto.KioskVideoDTO>> getKioskVideosWithStatus(@PathVariable Long id) {
        log.info("GET /api/kiosks/{}/videos-with-status", id);
        List<com.kiosk.backend.dto.KioskVideoDTO> videos = kioskService.getKioskVideosWithStatus(id);
        return ResponseEntity.ok(videos);
    }

    /**
     * Get videos assigned to a kiosk by kioskid with download status
     * GET /api/kiosks/by-kioskid/{kioskid}/videos-with-status
     */
    @GetMapping("/by-kioskid/{kioskid}/videos-with-status")
    public ResponseEntity<List<com.kiosk.backend.dto.KioskVideoDTO>> getKioskVideosWithStatusByKioskId(@PathVariable String kioskid) {
        log.info("GET /api/kiosks/by-kioskid/{}/videos-with-status", kioskid);
        List<com.kiosk.backend.dto.KioskVideoDTO> videos = kioskService.getKioskVideosWithStatusByKioskId(kioskid);
        return ResponseEntity.ok(videos);
    }

    /**
     * Update download status for a video on a kiosk
     * PATCH /api/kiosks/{id}/videos/{videoId}/status
     */
    @PatchMapping("/{id}/videos/{videoId}/status")
    public ResponseEntity<Map<String, String>> updateVideoDownloadStatus(
            @PathVariable Long id,
            @PathVariable Long videoId,
            @RequestParam String status,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);

        log.info("PATCH /api/kiosks/{}/videos/{}/status - status: {}", id, videoId, status);
        kioskService.updateVideoDownloadStatus(id, videoId, status, decodedEmail);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Download status updated successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Update download status for a video on a kiosk by kioskid
     * PATCH /api/kiosks/by-kioskid/{kioskid}/videos/{videoId}/status
     */
    @PatchMapping("/by-kioskid/{kioskid}/videos/{videoId}/status")
    public ResponseEntity<Map<String, String>> updateVideoDownloadStatusByKioskId(
            @PathVariable String kioskid,
            @PathVariable Long videoId,
            @RequestParam String status,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);

        log.info("PATCH /api/kiosks/by-kioskid/{}/videos/{}/status - status: {}", kioskid, videoId, status);
        kioskService.updateVideoDownloadStatusByKioskId(kioskid, videoId, status, decodedEmail);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Download status updated successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Update kiosk configuration from Admin Web
     * PUT /api/kiosks/{id}/config
     */
    @PutMapping("/{id}/config")
    public ResponseEntity<Map<String, String>> updateKioskConfigFromWeb(
            @PathVariable Long id,
            @RequestBody KioskConfigDTO configDTO) {
        log.info("PUT /api/kiosks/{}/config - updating config from admin web", id);

        // Get kiosk by ID to retrieve kioskid
        KioskDTO kiosk = kioskService.getKioskById(id);

        // Update config and set configModifiedByWeb flag
        kioskService.updateKioskConfigFromWeb(kiosk.getKioskid(), configDTO);

        // Send WebSocket notification to the kiosk
        try {
            webSocketController.sendNotificationToKiosk(
                kiosk.getKioskid(),
                "키오스크 설정이 관리자에 의해 업데이트되었습니다. 새로운 설정을 적용합니다.",
                "CONFIG_UPDATE"
            );
            log.info("Sent CONFIG_UPDATE notification to kiosk {} (admin web update)", kiosk.getKioskid());
        } catch (Exception e) {
            log.warn("Failed to send WebSocket notification to kiosk {}: {}", kiosk.getKioskid(), e.getMessage());
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "Kiosk configuration updated successfully from admin web");
        return ResponseEntity.ok(response);
    }

    /**
     * Update kiosk configuration (from Kiosk app)
     * PATCH /api/kiosks/by-kioskid/{kioskid}/config
     */
    @PatchMapping("/by-kioskid/{kioskid}/config")
    public ResponseEntity<Map<String, Object>> updateKioskConfig(
            @PathVariable String kioskid,
            @RequestBody KioskConfigDTO configDTO,
            @RequestHeader(value = "X-Kiosk-Id", required = false) String kioskIdHeader) {
        log.info("PATCH /api/kiosks/by-kioskid/{}/config", kioskid);
        log.info("Config update: downloadPath={}, apiUrl={}, autoSync={}, syncInterval={}",
                configDTO.getDownloadPath(), configDTO.getApiUrl(),
                configDTO.getAutoSync(), configDTO.getSyncInterval());

        boolean wasModifiedByWeb = kioskService.updateKioskConfig(kioskid, configDTO);

        // Send WebSocket notification only if config was modified by web (admin)
        if (wasModifiedByWeb) {
            try {
                webSocketController.sendNotificationToKiosk(
                    kioskid,
                    "키오스크 설정이 관리자에 의해 업데이트되었습니다. 새로운 설정을 적용합니다.",
                    "CONFIG_UPDATE"
                );
                log.info("Sent CONFIG_UPDATE notification to kiosk {} (config was modified by web)", kioskid);
            } catch (Exception e) {
                log.warn("Failed to send WebSocket notification to kiosk {}: {}", kioskid, e.getMessage());
                // Don't fail the request if WebSocket notification fails
            }
        } else {
            log.info("Skipping CONFIG_UPDATE notification for kiosk {} (config was not modified by web)", kioskid);
        }

        // Renew session token after config update
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Kiosk configuration updated successfully");

        try {
            // Fetch kiosk to get posId and kioskNo
            Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                    .orElseThrow(() -> new RuntimeException("Kiosk not found: " + kioskid));

            if (kiosk.getKioskno() != null) {
                // Disconnect existing WebSocket session (if any) before issuing new token
                // This ensures old sessions cannot continue operating after new token is issued
                webSocketSessionManager.disconnectExistingSession(kioskid);

                // Generate new random session version (invalidates previous sessions)
                // Using SecureRandom to prevent prediction attacks
                long newSessionVersion = (long) secureRandom.nextInt(Integer.MAX_VALUE);
                kiosk.setSessionVersion(newSessionVersion);
                kiosk.setLastConnectedAt(java.time.LocalDateTime.now());
                kiosk = kioskRepository.save(kiosk);

                // Generate new token with updated session version
                long sixMonthsInMs = 180L * 24 * 60 * 60 * 1000; // 180 days = 6 months
                String token = jwtTokenProvider.generateKioskToken(
                    kioskid,
                    kiosk.getPosid(),
                    kiosk.getKioskno(),
                    kiosk.getSessionVersion(),
                    sixMonthsInMs
                );

                // Record KIOSK_CONNECTED event
                try {
                    String eventMessage = String.format("설정 저장 후 세션 토큰 갱신 (세션 버전: %d)", kiosk.getSessionVersion());
                    String eventMetadata = String.format("posId=%s, kioskNo=%d, sessionVersion=%d, trigger=CONFIG_UPDATE",
                        kiosk.getPosid(), kiosk.getKioskno(), kiosk.getSessionVersion());
                    kioskEventService.recordEvent(kioskid, com.kiosk.backend.entity.KioskEvent.EventType.KIOSK_CONNECTED,
                        eventMessage, eventMetadata);
                } catch (Exception e) {
                    log.error("Failed to record KIOSK_CONNECTED event: {}", e.getMessage());
                }

                // Include token in response
                response.put("token", token);
                response.put("sessionVersion", kiosk.getSessionVersion());
                log.info("Config updated and token renewed for kiosk {} with session version {}",
                    kioskid, kiosk.getSessionVersion());
            }
        } catch (Exception e) {
            log.error("Failed to renew token after config update for kiosk {}: {}", kioskid, e.getMessage());
            // Don't fail the request, token renewal is optional
            response.put("tokenRenewalFailed", true);
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Get kiosk configuration
     * GET /api/kiosks/by-kioskid/{kioskid}/config
     */
    @GetMapping("/by-kioskid/{kioskid}/config")
    public ResponseEntity<KioskConfigDTO> getKioskConfig(@PathVariable String kioskid) {
        log.info("GET /api/kiosks/by-kioskid/{}/config", kioskid);
        KioskConfigDTO config = kioskService.getKioskConfig(kioskid);
        return ResponseEntity.ok(config);
    }

    /**
     * Connect kiosk and get session token
     * POST /api/kiosks/{kioskId}/connect
     */
    @PostMapping("/{kioskId}/connect")
    public ResponseEntity<Map<String, Object>> connectKiosk(
            @PathVariable String kioskId,
            @RequestHeader("X-Kiosk-PosId") String posId,
            @RequestHeader("X-Kiosk-No") Integer kioskNo) {

        log.info("POST /api/kiosks/{}/connect - Kiosk connecting", kioskId);

        try {
            // Verify kiosk exists and credentials match
            Kiosk kiosk = kioskRepository.findByKioskid(kioskId)
                .orElseThrow(() -> new RuntimeException("Kiosk not found: " + kioskId));

            if (!kiosk.getPosid().equals(posId) || !kiosk.getKioskno().equals(kioskNo)) {
                throw new RuntimeException("Kiosk credentials mismatch");
            }

            // Disconnect existing WebSocket session (if any) before issuing new token
            // This ensures old sessions cannot continue operating after new token is issued
            webSocketSessionManager.disconnectExistingSession(kioskId);

            // Generate new random session version (invalidates previous sessions)
            // Using SecureRandom to prevent prediction attacks
            long newSessionVersion = (long) secureRandom.nextInt(Integer.MAX_VALUE);
            kiosk.setSessionVersion(newSessionVersion);
            kiosk.setLastConnectedAt(java.time.LocalDateTime.now());
            kiosk = kioskRepository.save(kiosk);

            // Generate long-lived token with session version (6 months, auto-renewed every 7 days)
            long sixMonthsInMs = 180L * 24 * 60 * 60 * 1000; // 180 days = 6 months
            String token = jwtTokenProvider.generateKioskToken(
                kioskId,
                posId,
                kioskNo,
                kiosk.getSessionVersion(),
                sixMonthsInMs
            );

            // Record KIOSK_CONNECTED event to kiosk_events
            try {
                String eventMessage = String.format("키오스크 연결 성공 (세션 버전: %d)", kiosk.getSessionVersion());
                String eventMetadata = String.format("posId=%s, kioskNo=%d, sessionVersion=%d, expiresIn=%d days",
                    posId, kioskNo, kiosk.getSessionVersion(), 180);
                kioskEventService.recordEvent(kioskId, com.kiosk.backend.entity.KioskEvent.EventType.KIOSK_CONNECTED,
                    eventMessage, eventMetadata);
                log.info("Recorded KIOSK_CONNECTED event for kiosk {}", kioskId);
            } catch (Exception e) {
                log.error("Failed to record KIOSK_CONNECTED event for kiosk {}: {}", kioskId, e.getMessage());
                // Don't fail the request if event recording fails
            }

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("sessionVersion", kiosk.getSessionVersion());
            response.put("expiresIn", 180 * 24 * 60 * 60); // seconds (6 months)
            response.put("renewalInterval", 7 * 24 * 60 * 60); // seconds (renew every 7 days)
            response.put("message", "키오스크 연결 성공");

            log.info("Kiosk {} connected successfully with session version {}", kioskId, kiosk.getSessionVersion());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Failed to connect kiosk {}: {}", kioskId, e.getMessage());
            Map<String, Object> response = new HashMap<>();
            response.put("error", "키오스크 연결 실패: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }
    }

    /**
     * Send sync command to kiosk via WebSocket
     * POST /api/kiosks/{id}/sync
     */
    @PostMapping("/{id}/sync")
    public ResponseEntity<Map<String, String>> sendSyncCommand(@PathVariable Long id) {
        log.info("POST /api/kiosks/{}/sync - sending sync command via WebSocket", id);

        try {
            // Get kiosk by ID to retrieve kioskid
            KioskDTO kiosk = kioskService.getKioskById(id);

            // Send WebSocket notification to the kiosk
            webSocketController.sendSyncCommandToKiosk(kiosk.getKioskid());
            log.info("Sent SYNC_COMMAND to kiosk {} (kioskid: {})", id, kiosk.getKioskid());

            Map<String, String> response = new HashMap<>();
            response.put("message", "동기화 명령이 키오스크에 전송되었습니다.");
            response.put("kioskid", kiosk.getKioskid());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to send sync command to kiosk {}: {}", id, e.getMessage());
            Map<String, String> response = new HashMap<>();
            response.put("error", "동기화 명령 전송에 실패했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}
