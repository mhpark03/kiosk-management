package com.kiosk.backend.controller;

import com.kiosk.backend.dto.StoreHistoryDTO;
import com.kiosk.backend.entity.StoreHistory;
import com.kiosk.backend.repository.StoreHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/store-history")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class StoreHistoryController {

    private final StoreHistoryRepository storeHistoryRepository;

    /**
     * Get all store history (most recent first)
     */
    @GetMapping
    public ResponseEntity<List<StoreHistoryDTO>> getAllHistory() {
        log.info("Fetching all store history");
        List<StoreHistory> history = storeHistoryRepository.findAllByOrderByTimestampDesc();
        List<StoreHistoryDTO> dtos = history.stream()
                .map(StoreHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get history for a specific store by ID
     */
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<StoreHistoryDTO>> getHistoryByStore(@PathVariable Long storeId) {
        log.info("Fetching history for store ID: {}", storeId);
        List<StoreHistory> history = storeHistoryRepository.findByStoreIdOrderByTimestampDesc(storeId);
        List<StoreHistoryDTO> dtos = history.stream()
                .map(StoreHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get history by user
     */
    @GetMapping("/user/{userid}")
    public ResponseEntity<List<StoreHistoryDTO>> getHistoryByUser(@PathVariable String userid) {
        log.info("Fetching history for user: {}", userid);
        List<StoreHistory> history = storeHistoryRepository.findByUseridOrderByTimestampDesc(userid);
        List<StoreHistoryDTO> dtos = history.stream()
                .map(StoreHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get history by action type
     */
    @GetMapping("/action/{action}")
    public ResponseEntity<List<StoreHistoryDTO>> getHistoryByAction(@PathVariable String action) {
        log.info("Fetching history for action: {}", action);
        try {
            StoreHistory.ActionType actionType = StoreHistory.ActionType.valueOf(action.toUpperCase());
            List<StoreHistory> history = storeHistoryRepository.findByActionOrderByTimestampDesc(actionType);
            List<StoreHistoryDTO> dtos = history.stream()
                    .map(StoreHistoryDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(dtos);
        } catch (IllegalArgumentException e) {
            log.error("Invalid action type: {}", action);
            return ResponseEntity.badRequest().build();
        }
    }
}
