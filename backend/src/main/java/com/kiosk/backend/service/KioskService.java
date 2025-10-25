package com.kiosk.backend.service;

import com.kiosk.backend.dto.CreateKioskRequest;
import com.kiosk.backend.dto.KioskConfigDTO;
import com.kiosk.backend.dto.KioskDTO;
import com.kiosk.backend.dto.UpdateKioskRequest;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.entity.KioskVideo;
import com.kiosk.backend.entity.Store;
import com.kiosk.backend.repository.EntityHistoryRepository;
import com.kiosk.backend.repository.KioskRepository;
import com.kiosk.backend.repository.KioskVideoRepository;
import com.kiosk.backend.repository.StoreRepository;
import com.kiosk.backend.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class KioskService {

    private final KioskRepository kioskRepository;
    private final EntityHistoryRepository entityHistoryRepository;
    private final StoreRepository storeRepository;
    private final KioskVideoRepository kioskVideoRepository;
    private final VideoRepository videoRepository;
    private final VideoService videoService;
    private final KioskEventService kioskEventService;
    private final MqttService mqttService;

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
     * Convert Kiosk entity to DTO with store regdate and video statistics included
     */
    private KioskDTO toDTO(Kiosk kiosk) {
        KioskDTO dto = KioskDTO.fromEntity(kiosk);

        // Fetch store to get regdate
        Store store = storeRepository.findByPosid(kiosk.getPosid()).orElse(null);
        if (store != null) {
            dto.setStoreRegdate(store.getRegdate());
        }

        // Calculate video statistics
        List<KioskVideo> kioskVideos = kioskVideoRepository.findByKioskIdOrderByDisplayOrderAsc(kiosk.getId());
        dto.setTotalVideoCount(kioskVideos.size());

        long downloadedCount = kioskVideos.stream()
                .filter(kv -> "COMPLETED".equals(kv.getDownloadStatus()))
                .count();
        dto.setDownloadedVideoCount((int) downloadedCount);

        return dto;
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
                    Kiosk.KioskState.PREPARING)
                .regdate(LocalDateTime.now())
                .build();

        Kiosk savedKiosk = kioskRepository.save(kiosk);
        log.info("Created kiosk with kioskid: {}", savedKiosk.getKioskid());

        // Log history
        logHistory(savedKiosk.getKioskid(), savedKiosk.getPosid(), userEmail, username, "CREATE",
            null, null, null,
            String.format("Created kiosk %s for store %s", savedKiosk.getKioskid(), savedKiosk.getPosid()));

        return toDTO(savedKiosk);
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
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get kiosks with filters
     */
    @Transactional(readOnly = true)
    public List<KioskDTO> getKiosksWithFilter(String posid, String maker, boolean includeDeleted) {
        List<Kiosk> kiosks = kioskRepository.findKiosksByFilter(posid, maker, includeDeleted);
        return kiosks.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get kiosk by ID
     */
    @Transactional(readOnly = true)
    public KioskDTO getKioskById(Long id) {
        Kiosk kiosk = kioskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + id));
        return toDTO(kiosk);
    }

    /**
     * Get kiosk by Kiosk ID
     */
    @Transactional(readOnly = true)
    public KioskDTO getKioskByKioskid(String kioskid) {
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));
        return toDTO(kiosk);
    }

    /**
     * Get kiosk by Store ID (posid) and Kiosk Number (kioskno)
     */
    @Transactional(readOnly = true)
    public KioskDTO getKioskByPosidAndKioskno(String posid, Integer kioskno) {
        Kiosk kiosk = kioskRepository.findByPosidAndKioskno(posid, kioskno)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with posid: " + posid + ", kioskno: " + kioskno));
        return toDTO(kiosk);
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

        // Update regdate if provided
        LocalDateTime newRegdate = parseDateTime(request.getRegdate());
        if (newRegdate != null) {
            // Validate regdate against store regdate
            Store store = storeRepository.findByPosid(kiosk.getPosid())
                .orElseThrow(() -> new RuntimeException("Store not found with posid: " + kiosk.getPosid()));

            if (store.getRegdate() != null && newRegdate.toLocalDate().isBefore(store.getRegdate().toLocalDate())) {
                throw new RuntimeException("Kiosk registration date cannot be before store registration date (" + store.getRegdate().toLocalDate() + ")");
            }

            if (!newRegdate.equals(kiosk.getRegdate())) {
                changes.append(String.format("regdate changed; "));
                kiosk.setRegdate(newRegdate);
            }
        }

        LocalDateTime newSetdate = parseDateTime(request.getSetdate());
        if (newSetdate != null) {
            // Validate setdate against kiosk regdate
            if (kiosk.getRegdate() != null && newSetdate.toLocalDate().isBefore(kiosk.getRegdate().toLocalDate())) {
                throw new RuntimeException("Kiosk start date cannot be before kiosk registration date (" + kiosk.getRegdate().toLocalDate() + ")");
            }

            if (!newSetdate.equals(kiosk.getSetdate())) {
                changes.append(String.format("setdate changed; "));
                kiosk.setSetdate(newSetdate);
            }
        } else if (request.getSetdate() == null || request.getSetdate().isEmpty()) {
            if (kiosk.getSetdate() != null) {
                changes.append("setdate cleared; ");
                kiosk.setSetdate(null);
            }
        }

        LocalDateTime newDeldate = parseDateTime(request.getDeldate());
        if (newDeldate != null) {
            // Validate that deldate is not before setdate
            if (kiosk.getSetdate() != null && newDeldate.toLocalDate().isBefore(kiosk.getSetdate().toLocalDate())) {
                throw new RuntimeException("Kiosk end date cannot be before kiosk start date (" + kiosk.getSetdate().toLocalDate() + ")");
            }

            if (!newDeldate.equals(kiosk.getDeldate())) {
                changes.append(String.format("deldate changed; "));
                kiosk.setDeldate(newDeldate);
            }
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

        return toDTO(updatedKiosk);
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

    /**
     * Assign videos to a kiosk (replaces all existing video assignments)
     */
    public void assignVideosToKiosk(Long kioskId, List<Long> videoIds, String userEmail) {
        // Verify kiosk exists
        Kiosk kiosk = kioskRepository.findById(kioskId)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + kioskId));

        // Remove all existing video assignments for this kiosk
        kioskVideoRepository.deleteByKioskId(kioskId);

        // Add new video assignments
        List<KioskVideo> kioskVideos = new ArrayList<>();
        for (int i = 0; i < videoIds.size(); i++) {
            KioskVideo kioskVideo = KioskVideo.builder()
                    .kioskId(kioskId)
                    .videoId(videoIds.get(i))
                    .displayOrder(i)
                    .assignedBy(userEmail)
                    .assignedAt(LocalDateTime.now())
                    .build();
            kioskVideos.add(kioskVideo);
        }

        kioskVideoRepository.saveAll(kioskVideos);

        log.info("Assigned {} videos to kiosk {}", videoIds.size(), kiosk.getKioskid());

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, userEmail, "UPDATE",
            "videos", null, videoIds.toString(),
            String.format("Assigned %d videos to kiosk", videoIds.size()));

        // Send MQTT notification for video update
        mqttService.notifyVideoUpdate(kiosk.getKioskid());
        log.info("MQTT video update notification sent for kioskid: {}", kiosk.getKioskid());
    }

    /**
     * Get all video IDs assigned to a kiosk
     */
    @Transactional(readOnly = true)
    public List<Long> getKioskVideos(Long kioskId) {
        // Verify kiosk exists
        kioskRepository.findById(kioskId)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + kioskId));

        List<KioskVideo> kioskVideos = kioskVideoRepository.findByKioskIdOrderByDisplayOrderAsc(kioskId);
        return kioskVideos.stream()
                .map(KioskVideo::getVideoId)
                .collect(Collectors.toList());
    }

    /**
     * Remove a specific video from a kiosk
     */
    public void removeVideoFromKiosk(Long kioskId, Long videoId, String userEmail) {
        // Verify kiosk exists
        Kiosk kiosk = kioskRepository.findById(kioskId)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + kioskId));

        kioskVideoRepository.deleteByKioskIdAndVideoId(kioskId, videoId);

        log.info("Removed video {} from kiosk {}", videoId, kiosk.getKioskid());

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, userEmail, "UPDATE",
            "videos", videoId.toString(), null,
            String.format("Removed video %d from kiosk", videoId));
    }

    /**
     * Get all videos assigned to a kiosk with download status
     */
    @Transactional(readOnly = true)
    public List<com.kiosk.backend.dto.KioskVideoDTO> getKioskVideosWithStatus(Long kioskId) {
        // Verify kiosk exists
        kioskRepository.findById(kioskId)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + kioskId));

        List<KioskVideo> kioskVideos = kioskVideoRepository.findByKioskIdOrderByDisplayOrderAsc(kioskId);
        return kioskVideos.stream()
                .map(kv -> {
                    // Get video details
                    var video = videoRepository.findById(kv.getVideoId()).orElse(null);

                    // Generate presigned URL for thumbnail if exists
                    String thumbnailPresignedUrl = null;
                    if (video != null && video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
                        try {
                            thumbnailPresignedUrl = videoService.generateThumbnailPresignedUrl(kv.getVideoId(), 10080); // 7 days
                        } catch (Exception e) {
                            log.warn("Failed to generate presigned URL for thumbnail of video {}: {}", kv.getVideoId(), e.getMessage());
                        }
                    }

                    return com.kiosk.backend.dto.KioskVideoDTO.builder()
                            .id(kv.getId())
                            .kioskId(kv.getKioskId())
                            .videoId(kv.getVideoId())
                            .displayOrder(kv.getDisplayOrder())
                            .assignedBy(kv.getAssignedBy())
                            .assignedAt(kv.getAssignedAt())
                            .downloadStatus(kv.getDownloadStatus())
                            .createdAt(kv.getCreatedAt())
                            // Add video details
                            .title(video != null ? video.getTitle() : null)
                            .description(video != null ? video.getDescription() : null)
                            .fileName(video != null ? video.getOriginalFilename() : null)
                            .fileSize(video != null ? video.getFileSize() : null)
                            .duration(video != null ? video.getDuration() : null)
                            .url(video != null ? video.getS3Url() : null)
                            .thumbnailUrl(thumbnailPresignedUrl)
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Get all videos assigned to a kiosk with download status by kioskid string
     */
    @Transactional(readOnly = true)
    public List<com.kiosk.backend.dto.KioskVideoDTO> getKioskVideosWithStatusByKioskId(String kioskid) {
        // Find kiosk by kioskid string
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));

        List<KioskVideo> kioskVideos = kioskVideoRepository.findByKioskIdOrderByDisplayOrderAsc(kiosk.getId());
        return kioskVideos.stream()
                .map(kv -> {
                    // Get video details
                    var video = videoRepository.findById(kv.getVideoId()).orElse(null);

                    // Generate presigned URL for thumbnail if exists
                    String thumbnailPresignedUrl = null;
                    if (video != null && video.getThumbnailS3Key() != null && !video.getThumbnailS3Key().isEmpty()) {
                        try {
                            thumbnailPresignedUrl = videoService.generateThumbnailPresignedUrl(kv.getVideoId(), 10080); // 7 days
                        } catch (Exception e) {
                            log.warn("Failed to generate presigned URL for thumbnail of video {}: {}", kv.getVideoId(), e.getMessage());
                        }
                    }

                    return com.kiosk.backend.dto.KioskVideoDTO.builder()
                            .id(kv.getId())
                            .kioskId(kv.getKioskId())
                            .videoId(kv.getVideoId())
                            .displayOrder(kv.getDisplayOrder())
                            .assignedBy(kv.getAssignedBy())
                            .assignedAt(kv.getAssignedAt())
                            .downloadStatus(kv.getDownloadStatus())
                            .createdAt(kv.getCreatedAt())
                            // Add video details
                            .title(video != null ? video.getTitle() : null)
                            .description(video != null ? video.getDescription() : null)
                            .fileName(video != null ? video.getOriginalFilename() : null)
                            .fileSize(video != null ? video.getFileSize() : null)
                            .duration(video != null ? video.getDuration() : null)
                            .url(video != null ? video.getS3Url() : null)
                            .thumbnailUrl(thumbnailPresignedUrl)
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Update download status for a kiosk video
     */
    public void updateVideoDownloadStatus(Long kioskId, Long videoId, String status, String userEmail) {
        // Verify kiosk exists
        Kiosk kiosk = kioskRepository.findById(kioskId)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with id: " + kioskId));

        // Find the kiosk video assignment
        KioskVideo kioskVideo = kioskVideoRepository.findByKioskIdAndVideoId(kioskId, videoId);
        if (kioskVideo == null) {
            throw new RuntimeException("Video " + videoId + " is not assigned to kiosk " + kioskId);
        }

        String oldStatus = kioskVideo.getDownloadStatus();
        kioskVideo.setDownloadStatus(status);
        kioskVideoRepository.save(kioskVideo);

        log.info("Updated download status for video {} on kiosk {} from {} to {}",
                videoId, kiosk.getKioskid(), oldStatus, status);

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, userEmail, "UPDATE",
            "video_download_status", oldStatus, status,
            String.format("Updated download status for video %d to %s", videoId, status));
    }

    /**
     * Update download status for a kiosk video by kioskid string
     */
    public void updateVideoDownloadStatusByKioskId(String kioskid, Long videoId, String status, String userEmail) {
        // Find kiosk by kioskid string
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));

        // Find the kiosk video assignment
        KioskVideo kioskVideo = kioskVideoRepository.findByKioskIdAndVideoId(kiosk.getId(), videoId);
        if (kioskVideo == null) {
            throw new RuntimeException("Video " + videoId + " is not assigned to kiosk " + kioskid);
        }

        String oldStatus = kioskVideo.getDownloadStatus();
        kioskVideo.setDownloadStatus(status);
        kioskVideoRepository.save(kioskVideo);

        log.info("Updated download status for video {} on kiosk {} from {} to {}",
                videoId, kiosk.getKioskid(), oldStatus, status);

        // Log history
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, userEmail, "UPDATE",
            "video_download_status", oldStatus, status,
            String.format("Updated download status for video %d to %s", videoId, status));
    }

    /**
     * Update kiosk configuration from Kiosk app
     */
    public void updateKioskConfig(String kioskid, KioskConfigDTO configDTO) {
        updateKioskConfig(kioskid, configDTO, false); // false = from kiosk app
    }

    /**
     * Update kiosk configuration with source tracking
     * @param kioskid Kiosk ID
     * @param configDTO Configuration data
     * @param fromWebAdmin true if called from web admin, false if from kiosk app
     */
    public void updateKioskConfig(String kioskid, KioskConfigDTO configDTO, boolean fromWebAdmin) {
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));

        // Update configuration fields (allow null to clear config)
        kiosk.setDownloadPath(configDTO.getDownloadPath());
        kiosk.setApiUrl(configDTO.getApiUrl());
        kiosk.setAutoSync(configDTO.getAutoSync());
        kiosk.setSyncInterval(configDTO.getSyncInterval());
        kiosk.setLastSync(configDTO.getLastSync());

        // Set flag to indicate source of update
        kiosk.setConfigModifiedByWeb(fromWebAdmin);

        kioskRepository.save(kiosk);

        String source = fromWebAdmin ? "web-admin" : "kiosk-app";
        log.info("Updated configuration for kiosk {} from {}: downloadPath={}, apiUrl={}, autoSync={}, syncInterval={}, configModifiedByWeb={}",
                kioskid, source, configDTO.getDownloadPath(), configDTO.getApiUrl(),
                configDTO.getAutoSync(), configDTO.getSyncInterval(), fromWebAdmin);

        // Log history
        String configDetails = String.format("Configuration updated from %s: autoSync=%s, syncInterval=%s hours, downloadPath=%s",
                source,
                configDTO.getAutoSync(),
                configDTO.getSyncInterval() != null ? configDTO.getSyncInterval() : "N/A",
                configDTO.getDownloadPath() != null ? configDTO.getDownloadPath() : "N/A");
        String userName = fromWebAdmin ? "Web Admin" : "Kiosk App";
        String userEmail = fromWebAdmin ? "web-admin" : "kiosk-app";
        logHistory(kiosk.getKioskid(), kiosk.getPosid(), userEmail, userName, "UPDATE",
            "kiosk_config", "N/A", "Updated", configDetails);

        // Record kiosk event if updated from web admin
        if (fromWebAdmin) {
            String eventMessage = String.format("웹 관리자가 설정 변경: 자동동기화=%s, 동기화간격=%s시간",
                    configDTO.getAutoSync() != null ? (configDTO.getAutoSync() ? "활성" : "비활성") : "N/A",
                    configDTO.getSyncInterval() != null ? configDTO.getSyncInterval() : "N/A");
            String metadata = String.format("{\"downloadPath\":\"%s\",\"apiUrl\":\"%s\",\"autoSync\":%s,\"syncInterval\":%d}",
                    configDTO.getDownloadPath() != null ? configDTO.getDownloadPath() : "",
                    configDTO.getApiUrl() != null ? configDTO.getApiUrl() : "",
                    configDTO.getAutoSync() != null ? configDTO.getAutoSync() : false,
                    configDTO.getSyncInterval() != null ? configDTO.getSyncInterval() : 0);

            kioskEventService.recordEvent(kioskid, KioskEvent.EventType.CONFIG_UPDATED_BY_WEB,
                    userEmail, userName, eventMessage, metadata, null);

            // Send MQTT notification to kiosk app for real-time sync
            mqttService.notifyConfigUpdate(kioskid);
            log.info("MQTT config update notification sent for kioskid: {}", kioskid);
        }
    }

    /**
     * Get kiosk configuration
     */
    public KioskConfigDTO getKioskConfig(String kioskid) {
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));

        return KioskConfigDTO.builder()
                .downloadPath(kiosk.getDownloadPath())
                .apiUrl(kiosk.getApiUrl())
                .autoSync(kiosk.getAutoSync())
                .syncInterval(kiosk.getSyncInterval())
                .lastSync(kiosk.getLastSync())
                .configModifiedByWeb(kiosk.getConfigModifiedByWeb())
                .build();
    }

    /**
     * Sync kiosk configuration - app sends its config, server checks if web modified,
     * and returns updated config if needed
     * @param kioskid Kiosk ID
     * @param appConfig Configuration from kiosk app
     * @return Response with updated config if web admin modified it
     */
    public com.kiosk.backend.dto.KioskConfigSyncResponse syncKioskConfig(String kioskid, KioskConfigDTO appConfig) {
        Kiosk kiosk = kioskRepository.findByKioskid(kioskid)
                .orElseThrow(() -> new RuntimeException("Kiosk not found with kioskid: " + kioskid));

        // Check if config was modified by web admin
        Boolean configModifiedByWeb = kiosk.getConfigModifiedByWeb();

        if (configModifiedByWeb != null && configModifiedByWeb) {
            // Config was modified by web admin, check if there are differences
            KioskConfigDTO serverConfig = KioskConfigDTO.builder()
                    .downloadPath(kiosk.getDownloadPath())
                    .apiUrl(kiosk.getApiUrl())
                    .autoSync(kiosk.getAutoSync())
                    .syncInterval(kiosk.getSyncInterval())
                    .lastSync(kiosk.getLastSync())
                    .configModifiedByWeb(configModifiedByWeb)
                    .build();

            // Compare server config with app config (exclude lastSync and configModifiedByWeb)
            boolean hasChanges = false;
            if (!equals(serverConfig.getDownloadPath(), appConfig.getDownloadPath())) hasChanges = true;
            if (!equals(serverConfig.getApiUrl(), appConfig.getApiUrl())) hasChanges = true;
            if (!equals(serverConfig.getAutoSync(), appConfig.getAutoSync())) hasChanges = true;
            if (!equals(serverConfig.getSyncInterval(), appConfig.getSyncInterval())) hasChanges = true;

            if (hasChanges) {
                // There are differences, return the server config for app to update
                log.info("Config was modified by web admin for kiosk {}, returning updated config", kioskid);

                // Reset the flag since we're syncing
                kiosk.setConfigModifiedByWeb(false);
                kioskRepository.save(kiosk);

                return com.kiosk.backend.dto.KioskConfigSyncResponse.builder()
                        .message("Configuration was updated by web admin")
                        .configUpdated(true)
                        .updatedConfig(serverConfig)
                        .build();
            }
        }

        // No changes from web admin or configs are the same, just update with app's config
        kiosk.setDownloadPath(appConfig.getDownloadPath());
        kiosk.setApiUrl(appConfig.getApiUrl());
        kiosk.setAutoSync(appConfig.getAutoSync());
        kiosk.setSyncInterval(appConfig.getSyncInterval());
        kiosk.setLastSync(appConfig.getLastSync());
        kiosk.setConfigModifiedByWeb(false); // Reset flag

        kioskRepository.save(kiosk);

        log.info("Synced configuration for kiosk {} from app (no web admin changes)", kioskid);

        return com.kiosk.backend.dto.KioskConfigSyncResponse.builder()
                .message("Configuration synced successfully")
                .configUpdated(false)
                .updatedConfig(null)
                .build();
    }

    /**
     * Helper method to compare two objects for equality (null-safe)
     */
    private boolean equals(Object a, Object b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }
}
