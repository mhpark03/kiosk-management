package com.kiosk.backend.controller;

import com.kiosk.backend.dto.EntityHistoryDTO;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.repository.EntityHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/history")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
@Slf4j
public class EntityHistoryController {

    private final EntityHistoryRepository entityHistoryRepository;

    // Get all history
    @GetMapping
    public ResponseEntity<List<EntityHistoryDTO>> getAllHistory() {
        log.info("GET /api/history - Fetching all history");
        List<EntityHistory> history = entityHistoryRepository.findAllByOrderByTimestampDesc();
        List<EntityHistoryDTO> historyDTOs = history.stream()
                .map(EntityHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(historyDTOs);
    }

    // Get history by entity type (KIOSK or STORE)
    @GetMapping("/type/{entityType}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByEntityType(@PathVariable String entityType) {
        log.info("GET /api/history/type/{} - Fetching history by entity type", entityType);
        try {
            EntityHistory.EntityType type = EntityHistory.EntityType.valueOf(entityType.toUpperCase());
            List<EntityHistory> history = entityHistoryRepository.findByEntityTypeOrderByTimestampDesc(type);
            List<EntityHistoryDTO> historyDTOs = history.stream()
                    .map(EntityHistoryDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(historyDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid entity type: {}", entityType);
            return ResponseEntity.badRequest().build();
        }
    }

    // Get history by entity ID
    @GetMapping("/entity/{entityId}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByEntityId(@PathVariable String entityId) {
        log.info("GET /api/history/entity/{} - Fetching history by entity ID", entityId);
        List<EntityHistory> history = entityHistoryRepository.findByEntityIdOrderByTimestampDesc(entityId);
        List<EntityHistoryDTO> historyDTOs = history.stream()
                .map(EntityHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(historyDTOs);
    }

    // Get history by POS ID
    @GetMapping("/posid/{posid}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByPosId(@PathVariable String posid) {
        log.info("GET /api/history/posid/{} - Fetching history by POS ID", posid);
        List<EntityHistory> history = entityHistoryRepository.findByPosidOrderByTimestampDesc(posid);
        List<EntityHistoryDTO> historyDTOs = history.stream()
                .map(EntityHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(historyDTOs);
    }

    // Get history by entity type and POS ID
    @GetMapping("/type/{entityType}/posid/{posid}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByEntityTypeAndPosId(
            @PathVariable String entityType,
            @PathVariable String posid) {
        log.info("GET /api/history/type/{}/posid/{} - Fetching history", entityType, posid);
        try {
            EntityHistory.EntityType type = EntityHistory.EntityType.valueOf(entityType.toUpperCase());
            List<EntityHistory> history = entityHistoryRepository
                    .findByEntityTypeAndPosidOrderByTimestampDesc(type, posid);
            List<EntityHistoryDTO> historyDTOs = history.stream()
                    .map(EntityHistoryDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(historyDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid entity type: {}", entityType);
            return ResponseEntity.badRequest().build();
        }
    }

    // Get history by user
    @GetMapping("/user/{userid}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByUser(@PathVariable String userid) {
        log.info("GET /api/history/user/{} - Fetching history by user", userid);
        List<EntityHistory> history = entityHistoryRepository.findByUseridOrderByTimestampDesc(userid);
        List<EntityHistoryDTO> historyDTOs = history.stream()
                .map(EntityHistoryDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(historyDTOs);
    }

    // Get history by action type
    @GetMapping("/action/{action}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByAction(@PathVariable String action) {
        log.info("GET /api/history/action/{} - Fetching history by action", action);
        try {
            EntityHistory.ActionType actionType = EntityHistory.ActionType.valueOf(action.toUpperCase());
            List<EntityHistory> history = entityHistoryRepository.findByActionOrderByTimestampDesc(actionType);
            List<EntityHistoryDTO> historyDTOs = history.stream()
                    .map(EntityHistoryDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(historyDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid action type: {}", action);
            return ResponseEntity.badRequest().build();
        }
    }

    // Get history by entity type and action
    @GetMapping("/type/{entityType}/action/{action}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByEntityTypeAndAction(
            @PathVariable String entityType,
            @PathVariable String action) {
        log.info("GET /api/history/type/{}/action/{} - Fetching history", entityType, action);
        try {
            EntityHistory.EntityType type = EntityHistory.EntityType.valueOf(entityType.toUpperCase());
            EntityHistory.ActionType actionType = EntityHistory.ActionType.valueOf(action.toUpperCase());
            List<EntityHistory> history = entityHistoryRepository
                    .findByEntityTypeAndActionOrderByTimestampDesc(type, actionType);
            List<EntityHistoryDTO> historyDTOs = history.stream()
                    .map(EntityHistoryDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(historyDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid entity type or action: {}, {}", entityType, action);
            return ResponseEntity.badRequest().build();
        }
    }

    // Get history by entity type and entity ID
    @GetMapping("/type/{entityType}/entity/{entityId}")
    public ResponseEntity<List<EntityHistoryDTO>> getHistoryByEntityTypeAndEntityId(
            @PathVariable String entityType,
            @PathVariable String entityId) {
        log.info("GET /api/history/type/{}/entity/{} - Fetching history", entityType, entityId);
        try {
            EntityHistory.EntityType type = EntityHistory.EntityType.valueOf(entityType.toUpperCase());
            List<EntityHistory> history = entityHistoryRepository
                    .findByEntityTypeAndEntityIdOrderByTimestampDesc(type, entityId);
            List<EntityHistoryDTO> historyDTOs = history.stream()
                    .map(EntityHistoryDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(historyDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid entity type: {}", entityType);
            return ResponseEntity.badRequest().build();
        }
    }
}
