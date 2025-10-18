package com.kiosk.backend.controller;

import com.kiosk.backend.dto.CreateKioskRequest;
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
}
