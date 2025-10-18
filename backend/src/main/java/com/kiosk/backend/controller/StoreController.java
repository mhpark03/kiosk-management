package com.kiosk.backend.controller;

import com.kiosk.backend.dto.CreateStoreRequest;
import com.kiosk.backend.dto.StoreDTO;
import com.kiosk.backend.service.StoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "https://localhost:5173") // Allow React frontend
public class StoreController {

    private final StoreService storeService;

    /**
     * Get all stores
     * GET /api/stores?includeDeleted=false
     */
    @GetMapping
    public ResponseEntity<List<StoreDTO>> getAllStores(
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        log.info("GET /api/stores - includeDeleted: {}", includeDeleted);
        List<StoreDTO> stores = storeService.getAllStores(includeDeleted);
        return ResponseEntity.ok(stores);
    }

    /**
     * Get store by ID
     * GET /api/stores/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<StoreDTO> getStoreById(@PathVariable Long id) {
        log.info("GET /api/stores/{}", id);
        StoreDTO store = storeService.getStoreById(id);
        return ResponseEntity.ok(store);
    }

    /**
     * Get store by POS ID
     * GET /api/stores/posid/{posid}
     */
    @GetMapping("/posid/{posid}")
    public ResponseEntity<StoreDTO> getStoreByPosid(@PathVariable String posid) {
        log.info("GET /api/stores/posid/{}", posid);
        StoreDTO store = storeService.getStoreByPosid(posid);
        return ResponseEntity.ok(store);
    }

    /**
     * Create new store
     * POST /api/stores
     */
    @PostMapping
    public ResponseEntity<StoreDTO> createStore(
            @Valid @RequestBody CreateStoreRequest request,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("POST /api/stores - posname: {}, user: {}", request.getPosname(), decodedEmail);
        StoreDTO createdStore = storeService.createStore(request, decodedEmail, decodedUsername);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdStore);
    }

    /**
     * Update store
     * PUT /api/stores/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<StoreDTO> updateStore(
            @PathVariable Long id,
            @Valid @RequestBody CreateStoreRequest request,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("PUT /api/stores/{} - posname: {}, user: {}", id, request.getPosname(), decodedEmail);
        StoreDTO updatedStore = storeService.updateStore(id, request, decodedEmail, decodedUsername);
        return ResponseEntity.ok(updatedStore);
    }

    /**
     * Soft delete store
     * DELETE /api/stores/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDeleteStore(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("DELETE /api/stores/{}, user: {}", id, decodedEmail);
        storeService.softDeleteStore(id, decodedEmail, decodedUsername);
        return ResponseEntity.noContent().build();
    }

    /**
     * Restore deleted store
     * POST /api/stores/{id}/restore
     */
    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restoreStore(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Email", defaultValue = "system@kiosk.com") String userEmail,
            @RequestHeader(value = "X-User-Name", defaultValue = "System") String username) {
        String decodedEmail = URLDecoder.decode(userEmail, StandardCharsets.UTF_8);
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        log.info("POST /api/stores/{}/restore, user: {}", id, decodedEmail);
        storeService.restoreStore(id, decodedEmail, decodedUsername);
        return ResponseEntity.ok().build();
    }

    /**
     * Permanently delete store
     * DELETE /api/stores/{id}/permanent
     */
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDeleteStore(@PathVariable Long id) {
        log.info("DELETE /api/stores/{}/permanent", id);
        storeService.permanentDeleteStore(id);
        return ResponseEntity.noContent().build();
    }
}
