package com.kiosk.backend.service;

import com.kiosk.backend.dto.CreateKioskRequest;
import com.kiosk.backend.dto.KioskDTO;
import com.kiosk.backend.dto.UpdateKioskRequest;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.repository.EntityHistoryRepository;
import com.kiosk.backend.repository.KioskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class KioskService {

    private final KioskRepository kioskRepository;
    private final EntityHistoryRepository entityHistoryRepository;

    /**
     * Generate next sequential 12-digit Kiosk ID
     */
    private String generateKioskId() {
        String maxKioskid = kioskRepository.findMaxKioskid();

        if (maxKioskid == null || maxKioskid.isEmpty()) {
            return "000000000001"; // First kiosk
        }

        try {
            long nextId = Long.parseLong(maxKioskid) + 1;
            return String.format("%012d", nextId);
        } catch (NumberFormatException e) {
            log.error("Failed to parse max kioskid: {}", maxKioskid);
            return "000000000001";
        }
    }

    /**
     * Generate next kiosk number for specific store (including deleted kiosks to avoid reuse)
     */
    private Integer generateKioskNo(String posid) {
        Integer maxKioskno = kioskRepository.findMaxKiosknoByPosid(posid);
        return (maxKioskno == null) ? 1 : maxKioskno + 1;
    }

    /**
     * Create new kiosk
     */
    public KioskDTO createKiosk(CreateKioskRequest request, String userEmail, String username) {
        String newKioskid = generateKioskId();

        // Auto-generate kioskno if not provided
        Integer kioskno = (request.getKioskno() != null) ?
            request.getKioskno() :
            generateKioskNo(request.getPosid());

        // Check for duplicate posid + kioskno
        if (kioskRepository.findByPosidAndKioskno(request.getPosid(), kioskno).isPresent()) {
            throw new RuntimeException("Kiosk number " + kioskno + " already exists for this store");
        }

        Kiosk kiosk = Kiosk.builder()
                .kioskid(newKioskid)
                .posid(request.getPosid())
                .kioskno(kioskno)
                .maker(request.getMaker())
                .serialno(request.getSerialno())
                .state(request.getState() != null ?
                    Kiosk.KioskState.valueOf(request.getState().toUpperCase()) :
                    Kiosk.KioskState.INACTIVE)
                .regdate(LocalDateTime.now())
                .build();

        Kiosk savedKiosk = kioskRepository.save(kiosk);
        log.info("Created kiosk with kioskid: {}", savedKiosk.getKioskid());

        // Log history
        logHistory(savedKiosk.getKioskid(), savedKiosk.getPosid(), userEmail, username, "CREATE",
            null, null, null,
            String.format("Created kiosk %s for store %s", savedKiosk.getKioskid(), savedKiosk.getPosid()));

        return KioskDTO.fromEntity(savedKiosk);
    }

    /**
     * Get all kiosks
     */
    @Transactional(readOnly = true)
    public List<KioskDTO> getAllKiosks(boolean includeDeleted) {
        List<Kiosk> kiosks = includeDeleted ?
            kioskRepository.findAllByOrderByRegdateDesc() :
            kioskRepository.findActiveKiosks();

        return kiosks.stream()
                .map(KioskDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get kiosks with filters
     */
    @Transactional(readOnly = true)
    public List<KioskDTO> getKiosksWithFilter(String posid, String maker, boolean includeDeleted) {
        List<Kiosk> kiosks = kioskRepository.findKiosksByFilter(posid, maker, includeDeleted);
        return kiosks.stream()
                .map(KioskDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Get kiosk by ID
     */
    @Transactional(readOnly = true)
    public KioskDTO getKioskById(Long id) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));
        return KioskDTO.fromEntity(kiosk);
    }

    /**
     * Get kiosk by Kiosk ID
     */
    @Transactional(readOnly = true)
    public KioskDTO getKioskByKioskid(String kioskid) {
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));
        return KioskDTO.fromEntity(kiosk);
    }

    /**
     * Update kiosk
     */
    public KioskDTO updateKiosk(Long id, UpdateKioskRequest request, String userEmail, String username) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));

        StringBuilder changes = new StringBuilder();

        // Get the target posid (use new posid if changed, otherwise keep current)
        String targetPosid = (request.getPosid() != null && !request.getPosid().equals(kiosk.getPosid()))
            ? request.getPosid()
            : kiosk.getPosid();

        // Check duplicate if posid or kioskno changed
        Integer targetKioskno = (request.getKioskno() != null) ? request.getKioskno() : kiosk.getKioskno();

        // If either posid or kioskno changed, check for duplicates
        if ((request.getPosid() != null && !request.getPosid().equals(kiosk.getPosid())) ||
            (request.getKioskno() != null && !request.getKioskno().equals(kiosk.getKioskno()))) {

            if (kioskRepository.existsByPosidAndKiosknoExcludingId(targetPosid, targetKioskno, id)) {
                throw new RuntimeException("Kiosk number " + targetKioskno + " already exists for store " + targetPosid);
            }
        }

        // Update posid if changed
        if (request.getPosid() != null && !request.getPosid().equals(kiosk.getPosid())) {
            changes.append(String.format("posid: %s -> %s; ", kiosk.getPosid(), request.getPosid()));
            kiosk.setPosid(request.getPosid());
        }

        // Update kioskno if changed
        if (request.getKioskno() != null && !request.getKioskno().equals(kiosk.getKioskno())) {
            changes.append(String.format("kioskno: %d -> %d; ", kiosk.getKioskno(), request.getKioskno()));
            kiosk.setKioskno(request.getKioskno());
        }

        if (request.getMaker() != null && !request.getMaker().equals(kiosk.getMaker())) {
            changes.append(String.format("maker: %s -> %s; ", kiosk.getMaker(), request.getMaker()));
            kiosk.setMaker(request.getMaker());
        }

        if (request.getSerialno() != null && !request.getSerialno().equals(kiosk.getSerialno())) {
            changes.append(String.format("serialno: %s -> %s; ", kiosk.getSerialno(), request.getSerialno()));
            kiosk.setSerialno(request.getSerialno());
        }

        if (request.getState() != null) {
            Kiosk.KioskState newState = Kiosk.KioskState.valueOf(request.getState().toUpperCase());
            if (!newState.equals(kiosk.getState())) {
                changes.append(String.format("state: %s -> %s; ", kiosk.getState(), newState));
                kiosk.setState(newState);
            }
        }

        LocalDateTime newSetdate = parseDateTime(request.getSetdate());
        if (newSetdate != null && !newSetdate.equals(kiosk.getSetdate())) {
            changes.append(String.format("setdate changed; "));
            kiosk.setSetdate(newSetdate);
        } else if (request.getSetdate() == null || request.getSetdate().isEmpty()) {
            if (kiosk.getSetdate() != null) {
                changes.append("setdate cleared; ");
                kiosk.setSetdate(null);
            }
        }

        LocalDateTime newDeldate = parseDateTime(request.getDeldate());
        if (newDeldate != null && !newDeldate.equals(kiosk.getDeldate())) {
            changes.append(String.format("deldate changed; "));
            kiosk.setDeldate(newDeldate);
        } else if (request.getDeldate() == null || request.getDeldate().isEmpty()) {
            if (kiosk.getDeldate() != null) {
                changes.append("deldate cleared; ");
                kiosk.setDeldate(null);
            }
        }

        Kiosk updatedKiosk = kioskRepository.save(kiosk);
        log.info("Updated kiosk with kioskid: {}", updatedKiosk.getKioskid());

        // Log history if there were changes
        if (changes.length() > 0) {
            logHistory(updatedKiosk.getKioskid(), updatedKiosk.getPosid(), userEmail, username, "UPDATE",
                null, null, null,
                "Updated: " + changes.toString());
        }

        return KioskDTO.fromEntity(updatedKiosk);
    }

    /**
     * Update kiosk state
     */
    public void updateKioskState(Long id, String newState, String userEmail, String username) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));

        Kiosk.KioskState oldState = kiosk.getState();
        Kiosk.KioskState state = Kiosk.KioskState.valueOf(newState.toUpperCase());

        kiosk.setState(state);

        // If changing to ACTIVE and setdate is null, set it to today
        if (state == Kiosk.KioskState.ACTIVE && kiosk.getSetdate() == null) {
            kiosk.setSetdate(LocalDateTime.now());
        }

        kioskRepository.save(kiosk);

        log.info("Updated kiosk state for kioskid: {} from {} to {}", kiosk.getKioskid(), oldState, state);

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, username, "UPDATE",
            "state", oldState.toString(), state.toString(),
            String.format("State changed from %s to %s", oldState, state));
    }

    /**
     * Soft delete kiosk
     */
    public void softDeleteKiosk(Long id, String userEmail, String username) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));

        Kiosk.KioskState oldState = kiosk.getState();
        kiosk.setDeldate(LocalDateTime.now());
        kiosk.setState(Kiosk.KioskState.DELETED);
        kioskRepository.save(kiosk);

        log.info("Soft deleted kiosk with kioskid: {}", kiosk.getKioskid());

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, username, "DELETE",
            "state", oldState.toString(), "DELETED",
            "Kiosk soft deleted");
    }

    /**
     * Restore deleted kiosk
     */
    public void restoreKiosk(Long id, String userEmail, String username) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));

        kiosk.setDeldate(null);
        kiosk.setState(Kiosk.KioskState.INACTIVE);
        kioskRepository.save(kiosk);

        log.info("Restored kiosk with kioskid: {}", kiosk.getKioskid());

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, username, "RESTORE",
            "state", "DELETED", "INACTIVE",
            "Kiosk restored");
    }

    /**
     * Permanently delete kiosk
     */
    public void permanentDeleteKiosk(Long id) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));

        kioskRepository.delete(kiosk);
        log.info("Permanently deleted kiosk with kioskid: {}", kiosk.getKioskid());
    }

    /**
     * Get next available kiosk number for a store
     */
    @Transactional(readOnly = true)
    public Integer getNextKioskNo(String posid) {
        return generateKioskNo(posid);
    }

    /**
     * Parse ISO date/datetime string to LocalDateTime
     */
    private LocalDateTime parseDateTime(String dateTimeStr) {
        if (dateTimeStr == null || dateTimeStr.isEmpty()) {
            return null;
        }
        try {
            // Try to parse as datetime first (YYYY-MM-DDTHH:mm:ss)
            if (dateTimeStr.contains("T")) {
                return LocalDateTime.parse(dateTimeStr);
            }
            // If only date (YYYY-MM-DD), append time
            return LocalDateTime.parse(dateTimeStr + "T00:00:00");
        } catch (Exception e) {
            log.warn("Failed to parse datetime: {}", dateTimeStr);
            return null;
        }
    }

    /**
     * Log kiosk history to unified entity_history table
     */
    private void logHistory(String kioskid, String posid, String userid, String username, String action,
                           String fieldName, String oldValue, String newValue, String detail) {
        // Save to unified entity_history table only
        EntityHistory.ActionType actionType;
        try {
            actionType = EntityHistory.ActionType.valueOf(action.toUpperCase());
        } catch (IllegalArgumentException e) {
            actionType = EntityHistory.ActionType.UPDATE; // Default
        }

        EntityHistory entityHistory = EntityHistory.builder()
                .entityType(EntityHistory.EntityType.KIOSK)
                .entityId(kioskid)
                .posid(posid)
                .userid(userid)
                .username(username)
                .action(actionType)
                .timestamp(LocalDateTime.now())
                .fieldName(fieldName)
                .oldValue(oldValue)
                .newValue(newValue)
                .description(detail)
                .build();

        entityHistoryRepository.save(entityHistory);
    }

    /**
     * Update all kiosks state by posid (triggered by store state change)
     */
    public void updateKioskStateByPosid(String posid, String newState) {
        List<Kiosk> kiosks = kioskRepository.findKiosksByFilter(posid, null, false);

        Kiosk.KioskState state = Kiosk.KioskState.valueOf(newState.toUpperCase());

        for (Kiosk kiosk : kiosks) {
            // Skip if already in the target state or deleted
            if (kiosk.getState() == state || kiosk.getState() == Kiosk.KioskState.DELETED) {
                continue;
            }

            // Only auto-update kiosks that are currently ACTIVE
            if (kiosk.getState() != Kiosk.KioskState.ACTIVE) {
                log.debug("Skipping kiosk {} - not in ACTIVE state (current state: {})",
                        kiosk.getKioskid(), kiosk.getState());
                continue;
            }

            Kiosk.KioskState oldState = kiosk.getState();
            kiosk.setState(state);
            kioskRepository.save(kiosk);

            log.info("Auto-updated kiosk state for kioskid: {} from {} to {} (triggered by store state change)",
                    kiosk.getKioskid(), oldState, state);

            // Log history with system user
            logHistory(kiosk.getKioskid(), kiosk.getPosid(), "system", "System", "UPDATE",
                "state", oldState.toString(), state.toString(),
                String.format("Auto-updated by store state change from %s to %s", oldState, state));
        }
    }
}
