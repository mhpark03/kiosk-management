package com.kiosk.backend.controller;

import com.kiosk.backend.dto.CreateKioskRequest;
import com.kiosk.backend.dto.KioskConfigDTO;
import com.kiosk.backend.dto.KioskDTO;
import com.kiosk.backend.dto.UpdateKioskRequest;
import com.kiosk.backend.service.KioskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
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
     * Update kiosk configuration (from Kiosk app or Web Admin)
     * PATCH /api/kiosks/by-kioskid/{kioskid}/config
     */
    @PatchMapping("/by-kioskid/{kioskid}/config")
    public ResponseEntity<Map<String, String>> updateKioskConfig(
            @PathVariable String kioskid,
            @RequestBody KioskConfigDTO configDTO,
            @RequestHeader(value = "X-Kiosk-Id", required = false) String kioskIdHeader) {

        // Determine if request is from web admin or kiosk app
        // If X-Kiosk-Id header is present, it's from kiosk app
        boolean fromWebAdmin = (kioskIdHeader == null || kioskIdHeader.isEmpty());

        String source = fromWebAdmin ? "web-admin" : "kiosk-app";
        log.info("PATCH /api/kiosks/by-kioskid/{}/config from {}", kioskid, source);
        log.info("Config update: downloadPath={}, apiUrl={}, autoSync={}, syncInterval={}",
                configDTO.getDownloadPath(), configDTO.getApiUrl(),
                configDTO.getAutoSync(), configDTO.getSyncInterval());

        kioskService.updateKioskConfig(kioskid, configDTO, fromWebAdmin);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Kiosk configuration updated successfully");
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
     * Sync kiosk configuration - app sends its config, server checks if web admin modified,
     * and returns updated config if needed
     * POST /api/kiosks/by-kioskid/{kioskid}/config/sync
     */
    @PostMapping("/by-kioskid/{kioskid}/config/sync")
    public ResponseEntity<com.kiosk.backend.dto.KioskConfigSyncResponse> syncKioskConfig(
            @PathVariable String kioskid,
            @RequestBody KioskConfigDTO appConfig,
            @RequestHeader(value = "X-Kiosk-Id", required = false) String kioskIdHeader) {

        log.info("POST /api/kiosks/by-kioskid/{}/config/sync from kiosk app", kioskid);
        log.info("App config: downloadPath={}, apiUrl={}, autoSync={}, syncInterval={}",
                appConfig.getDownloadPath(), appConfig.getApiUrl(),
                appConfig.getAutoSync(), appConfig.getSyncInterval());

        com.kiosk.backend.dto.KioskConfigSyncResponse response = kioskService.syncKioskConfig(kioskid, appConfig);

        log.info("Sync response: configUpdated={}, message={}", response.getConfigUpdated(), response.getMessage());

        return ResponseEntity.ok(response);
    }
}
