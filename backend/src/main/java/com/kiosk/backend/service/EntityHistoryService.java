package com.kiosk.backend.service;

import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.repository.EntityHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Service for managing entity history records.
 * Separated to enable independent transaction management.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EntityHistoryService {

    private final EntityHistoryRepository entityHistoryRepository;

    /**
     * Performs the actual cleanup of old entity history records.
     * Runs in its own transaction.
     *
     * @return Number of records deleted
     */
    @Transactional
    public int performHistoryCleanup() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusMonths(1);
        return entityHistoryRepository.deleteOldNonUserRecords(
                EntityHistory.EntityType.USER,
                cutoffDate
        );
    }

    /**
     * Records video-related activity to entity_history table.
     *
     * @param videoId Video ID
     * @param videoTitle Video title
     * @param user User who performed the action
     * @param action Action type (VIDEO_UPLOAD, VIDEO_PLAY, VIDEO_DOWNLOAD, VIDEO_DELETE)
     * @param description Description of the action
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordVideoActivity(Long videoId, String videoTitle, User user,
                                    EntityHistory.ActionType action, String description) {
        try {
            EntityHistory history = EntityHistory.builder()
                    .entityType(EntityHistory.EntityType.VIDEO)
                    .entityId(String.valueOf(videoId))
                    .posid(null)
                    .userid(user.getEmail())
                    .username(user.getDisplayName())
                    .action(action)
                    .timestamp(LocalDateTime.now())
                    .fieldName("video_activity")
                    .oldValue(null)
                    .newValue(videoTitle)
                    .description(description)
                    .detail(null)
                    .build();

            entityHistoryRepository.save(history);
            log.debug("Video activity recorded: {} - {} by {}", action, videoTitle, user.getEmail());
        } catch (Exception e) {
            log.error("Failed to record video activity to entity_history", e);
        }
    }

    /**
     * Records batch execution result to entity_history table.
     * Runs in its own transaction (REQUIRES_NEW) to ensure it commits independently.
     *
     * @param startTime Start time of batch execution
     * @param deletedCount Number of records deleted
     * @param status SUCCESS or FAILED
     * @param errorMessage Error message if failed
     * @param user Current user (for manual execution), null for automatic execution
     * @param isManual True if manually executed, false if automatic
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordBatchExecution(LocalDateTime startTime, int deletedCount,
                                     String status, String errorMessage, User user, boolean isManual) {
        recordBatchExecution(startTime, deletedCount, status, errorMessage, user, isManual, "ENTITY_HISTORY");
    }

    /**
     * Records batch job execution result with batch type.
     *
     * @param startTime Batch execution start time
     * @param deletedCount Number of deleted records
     * @param status Execution status (SUCCESS/FAILED)
     * @param errorMessage Error message if failed
     * @param user User who executed (null for scheduled)
     * @param isManual true if manually executed, false if scheduled
     * @param batchType Type of batch: "ENTITY_HISTORY" or "KIOSK_EVENT"
     */
    public void recordBatchExecution(LocalDateTime startTime, int deletedCount,
                                     String status, String errorMessage, User user, boolean isManual, String batchType) {
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            String executionType = isManual ? "Manual Execution" : "Automatic Scheduled Execution";
            String executedBy = user != null ? user.getEmail() + " (" + user.getDisplayName() + ")" : "System Scheduler";

            // Determine target description based on batch type
            String target;
            String fieldName;
            String description;
            if ("KIOSK_EVENT".equals(batchType)) {
                target = "Kiosk event records older than 2 days";
                fieldName = "kiosk_event_cleanup";
                description = isManual ? "Manual kiosk event cleanup batch job" : "Automated kiosk event cleanup batch job";
            } else {
                target = "Non-USER entity history older than 1 month";
                fieldName = "entity_history_cleanup";
                description = isManual ? "Manual entity history cleanup batch job" : "Automated entity history cleanup batch job";
            }

            String detail = String.format(
                "Execution Type: %s\n" +
                "Executed By: %s\n" +
                "Batch Execution Time: %s\n" +
                "Status: %s\n" +
                "Deleted Records: %d\n" +
                "Target: %s\n" +
                "%s",
                executionType,
                executedBy,
                startTime.format(formatter),
                status,
                deletedCount,
                target,
                errorMessage != null ? "Error: " + errorMessage : "Completed successfully"
            );

            String userid = user != null ? user.getEmail() : "SYSTEM";
            String username = user != null ? user.getDisplayName() : "System Batch Job";

            // Use KIOSK as entityType instead of null to avoid database constraint
            EntityHistory history = EntityHistory.builder()
                    .entityType(EntityHistory.EntityType.KIOSK) // Use KIOSK type for batch jobs
                    .entityId("BATCH_JOB")
                    .posid(null)
                    .userid(userid)
                    .username(username)
                    .action(EntityHistory.ActionType.DELETE) // Represents cleanup/delete action
                    .timestamp(LocalDateTime.now())
                    .fieldName(fieldName)
                    .oldValue(null)
                    .newValue(String.valueOf(deletedCount))
                    .description(description)
                    .detail(detail)
                    .build();

            entityHistoryRepository.save(history);

            log.debug("Batch execution result recorded to entity_history");

        } catch (Exception e) {
            // Don't throw exception if recording fails, just log it
            log.error("Failed to record batch execution to entity_history", e);
        }
    }
}
