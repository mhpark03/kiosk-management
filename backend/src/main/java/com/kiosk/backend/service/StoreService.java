package com.kiosk.backend.service;

import com.kiosk.backend.dto.CreateStoreRequest;
import com.kiosk.backend.dto.StoreDTO;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.Store;
import com.kiosk.backend.repository.EntityHistoryRepository;
import com.kiosk.backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class StoreService {

    private final StoreRepository storeRepository;
    private final EntityHistoryRepository entityHistoryRepository;
    private final KioskService kioskService;

    /**
     * Generate next sequential 8-digit POS ID
     */
    private String generatePosId() {
        String maxPosid = storeRepository.findMaxPosid();

        if (maxPosid == null || maxPosid.isEmpty()) {
            return "00000001"; // First store
        }

        try {
            long nextId = Long.parseLong(maxPosid) + 1;
            return String.format("%08d", nextId);
        } catch (NumberFormatException e) {
            log.error("Failed to parse max posid: {}", maxPosid);
            return "00000001";
        }
    }

    /**
     * Create new store
     */
    public StoreDTO createStore(CreateStoreRequest request, String userEmail, String username) {
        String newPosid = generatePosId();

        Store store = Store.builder()
                .posid(newPosid)
                .posname(request.getPosname())
                .postcode(request.getPostcode())
                .address(request.getAddress())
                .addressDetail(request.getAddressDetail())
                .state(request.getState() != null ?
                    Store.StoreState.valueOf(request.getState().toUpperCase()) :
                    Store.StoreState.ACTIVE)
                .userid(userEmail)
                .regdate(parseDate(request.getRegdate()))
                .deldate(parseDate(request.getEnddate()))
                .build();

        Store savedStore = storeRepository.save(store);
        log.info("Created store with posid: {} by user: {}", savedStore.getPosid(), userEmail);

        // Log history
        logHistory(savedStore.getId(), savedStore.getPosid(), "CREATE",
                userEmail, username, null, null, null,
                "Created store: " + savedStore.getPosname());

        return StoreDTO.fromEntity(savedStore);
    }

    /**
     * Parse ISO date string to LocalDateTime
     */
    private LocalDateTime parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(dateStr + "T00:00:00");
        } catch (Exception e) {
            log.warn("Failed to parse date: {}", dateStr);
            return null;
        }
    }

    /**
     * Format LocalDateTime to MM/dd format for history display
     */
    private String formatDateForHistory(LocalDateTime dateTime) {
        if (dateTime == null) {
            return null;
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM/dd");
        return dateTime.format(formatter);
    }

    /**
     * Get all stores
     */
    @Transactional(readOnly = true)
    public List<StoreDTO> getAllStores(boolean includeDeleted) {
        List<Store> stores = includeDeleted ?
            storeRepository.findAllByOrderByRegdateDesc() :
            storeRepository.findActiveStores();

        return stores.stream()
                .map(StoreDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get store by ID
     */
    @Transactional(readOnly = true)
    public StoreDTO getStoreById(Long id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Store not found with id: " + id));
        return StoreDTO.fromEntity(store);
    }

    /**
     * Get store by POS ID (Cached for performance)
     */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "stores", key = "#posid")
    public StoreDTO getStoreByPosid(String posid) {
        Store store = storeRepository.findByPosid(posid)
                .orElseThrow(() -> new RuntimeException("Store not found with posid: " + posid));
        return StoreDTO.fromEntity(store);
    }

    /**
     * Update store
     */
    @CacheEvict(cacheNames = "stores", key = "#result.posid")
    public StoreDTO updateStore(Long id, CreateStoreRequest request, String userEmail, String username) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Store not found with id: " + id));

        // Track changes for history
        String oldPosname = store.getPosname();
        String oldPostcode = store.getPostcode();
        String oldAddress = store.getAddress();
        String oldAddressDetail = store.getAddressDetail();
        Store.StoreState oldState = store.getState();
        LocalDateTime oldRegdate = store.getRegdate();
        LocalDateTime oldDeldate = store.getDeldate();

        store.setPosname(request.getPosname());
        store.setPostcode(request.getPostcode());
        store.setAddress(request.getAddress());
        store.setAddressDetail(request.getAddressDetail());
        store.setUserid(userEmail);

        if (request.getState() != null) {
            store.setState(Store.StoreState.valueOf(request.getState().toUpperCase()));
        }

        store.setRegdate(parseDate(request.getRegdate()));

        // Validate enddate (must be on or after regdate)
        LocalDateTime newEnddate = parseDate(request.getEnddate());
        if (newEnddate != null && store.getRegdate() != null && newEnddate.toLocalDate().isBefore(store.getRegdate().toLocalDate())) {
            throw new RuntimeException("Store end date cannot be before registration date (" + store.getRegdate().toLocalDate() + ")");
        }
        store.setDeldate(newEnddate);

        Store updatedStore = storeRepository.save(store);
        log.info("Updated store with posid: {} by user: {}", updatedStore.getPosid(), userEmail);

        // Log history for each changed field
        if (!oldPosname.equals(updatedStore.getPosname())) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "posname", oldPosname, updatedStore.getPosname(),
                    "Changed store name from '" + oldPosname + "' to '" + updatedStore.getPosname() + "'");
        }
        if (!java.util.Objects.equals(oldPostcode, updatedStore.getPostcode())) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "postcode", oldPostcode, updatedStore.getPostcode(),
                    "Changed postcode");
        }
        if (!java.util.Objects.equals(oldAddress, updatedStore.getAddress())) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "address", oldAddress, updatedStore.getAddress(),
                    "Changed address");
        }
        if (!java.util.Objects.equals(oldAddressDetail, updatedStore.getAddressDetail())) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "addressDetail", oldAddressDetail, updatedStore.getAddressDetail(),
                    "Changed address detail");
        }
        if (oldState != updatedStore.getState()) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "state", oldState.toString(), updatedStore.getState().toString(),
                    "Changed state from " + oldState + " to " + updatedStore.getState());

            // Auto-update kiosk states if store state changed to INACTIVE
            if (updatedStore.getState() == Store.StoreState.INACTIVE) {
                log.info("Store state changed to {}, updating all kiosks for posid: {}",
                        updatedStore.getState(), updatedStore.getPosid());
                kioskService.updateKioskStateByPosid(updatedStore.getPosid(), updatedStore.getState().toString());
            }
        }
        if (!java.util.Objects.equals(oldRegdate, updatedStore.getRegdate())) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "regdate",
                    formatDateForHistory(oldRegdate),
                    formatDateForHistory(updatedStore.getRegdate()),
                    "Changed registration date");
        }
        if (!java.util.Objects.equals(oldDeldate, updatedStore.getDeldate())) {
            logHistory(updatedStore.getId(), updatedStore.getPosid(), "UPDATE",
                    userEmail, username, "deldate",
                    oldDeldate != null ? oldDeldate.toString() : null,
                    updatedStore.getDeldate() != null ? updatedStore.getDeldate().toString() : null,
                    "Changed end date");
        }

        return StoreDTO.fromEntity(updatedStore);
    }

    /**
     * Soft delete store
     */
    public void softDeleteStore(Long id, String userEmail, String username) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Store not found with id: " + id));

        Store.StoreState oldState = store.getState();
        store.setDeldate(LocalDateTime.now());
        store.setState(Store.StoreState.DELETED);
        store.setUserid(userEmail);
        storeRepository.save(store);

        log.info("Soft deleted store with posid: {} by user: {}", store.getPosid(), userEmail);

        // Log history
        logHistory(store.getId(), store.getPosid(), "DELETE",
                userEmail, username, "state", oldState.toString(), "DELETED",
                "Soft deleted store: " + store.getPosname());
    }

    /**
     * Restore deleted store
     */
    public void restoreStore(Long id, String userEmail, String username) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Store not found with id: " + id));

        store.setDeldate(null);
        store.setState(Store.StoreState.ACTIVE);
        store.setUserid(userEmail);
        storeRepository.save(store);

        log.info("Restored store with posid: {} by user: {}", store.getPosid(), userEmail);

        // Log history
        logHistory(store.getId(), store.getPosid(), "RESTORE",
                userEmail, username, "state", "DELETED", "ACTIVE",
                "Restored store: " + store.getPosname());
    }

    /**
     * Permanently delete store
     */
    public void permanentDeleteStore(Long id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Store not found with id: " + id));

        storeRepository.delete(store);
        log.info("Permanently deleted store with posid: {}", store.getPosid());
    }

    /**
     * Log history entry to unified entity_history table
     */
    private void logHistory(Long storeId, String posid, String action,
                           String userEmail, String username, String fieldName, String oldValue, String newValue,
                           String description) {
        // Save to unified entity_history table
        EntityHistory.ActionType entityAction;
        try {
            entityAction = EntityHistory.ActionType.valueOf(action);
        } catch (IllegalArgumentException e) {
            entityAction = EntityHistory.ActionType.UPDATE; // Default
        }

        EntityHistory entityHistory = EntityHistory.builder()
                .entityType(EntityHistory.EntityType.STORE)
                .entityId(String.valueOf(storeId))
                .posid(posid)
                .userid(userEmail)
                .username(username)
                .action(entityAction)
                .timestamp(LocalDateTime.now())
                .fieldName(fieldName)
                .oldValue(oldValue)
                .newValue(newValue)
                .description(description)
                .build();

        entityHistoryRepository.save(entityHistory);
    }
}
