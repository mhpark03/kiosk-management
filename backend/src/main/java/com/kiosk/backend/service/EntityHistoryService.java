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
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            String executionType = isManual ? "Manual Execution" : "Automatic Scheduled Execution";
            String executedBy = user != null ? user.getEmail() + " (" + user.getDisplayName() + ")" : "System Scheduler";

            String detail = String.format(
                "Execution Type: %s\n" +
                "Executed By: %s\n" +
                "Batch Execution Time: %s\n" +
                "Status: %s\n" +
                "Deleted Records: %d\n" +
                "Target: Non-USER entity history older than 1 month\n" +
                "%s",
                executionType,
                executedBy,
                startTime.format(formatter),
                status,
                deletedCount,
                errorMessage != null ? "Error: " + errorMessage : "Completed successfully"
            );

            String userid = user != null ? user.getEmail() : "SYSTEM";
            String username = user != null ? user.getDisplayName() : "System Batch Job";
            String description = isManual ? "Manual entity history cleanup batch job" : "Automated entity history cleanup batch job";

            // Use KIOSK as entityType instead of null to avoid database constraint
            EntityHistory history = EntityHistory.builder()
                    .entityType(EntityHistory.EntityType.KIOSK) // Use KIOSK type for batch jobs
                    .entityId("BATCH_JOB")
                    .posid(null)
                    .userid(userid)
                    .username(username)
                    .action(EntityHistory.ActionType.DELETE) // Represents cleanup/delete action
                    .timestamp(LocalDateTime.now())
                    .fieldName("entity_history_cleanup")
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
