package com.kiosk.backend.batch;

import com.kiosk.backend.entity.User;
import com.kiosk.backend.service.EntityHistoryService;
import com.kiosk.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Scheduled batch job to clean up old entity history records.
 * Deletes non-USER entity history records (KIOSK and STORE) older than 1 month.
 * User-related history is preserved indefinitely for audit purposes.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EntityHistoryCleanupScheduler {

    private final UserService userService;
    private final EntityHistoryService entityHistoryService;

    /**
     * Runs daily at 2:00 AM KST (Korea Standard Time) to clean up old entity history records.
     * Deletes KIOSK and STORE entity history older than 1 month.
     */
    @Scheduled(cron = "0 0 2 * * ?", zone = "Asia/Seoul") // Every day at 2:00 AM KST
    public void cleanupOldHistoryRecords() {
        log.info("Starting entity history cleanup batch job...");

        LocalDateTime startTime = LocalDateTime.now();
        String status = "SUCCESS";
        String errorMessage = null;
        int deletedCount = 0;

        try {
            // Perform cleanup in separate transaction via EntityHistoryService
            deletedCount = entityHistoryService.performHistoryCleanup();

            log.info("Entity history cleanup completed. Deleted {} old records", deletedCount);

        } catch (Exception e) {
            status = "FAILED";
            errorMessage = e.getMessage();
            log.error("Error during entity history cleanup batch job", e);
        }

        // Record batch execution result (runs in separate transaction via EntityHistoryService)
        entityHistoryService.recordBatchExecution(startTime, deletedCount, status, errorMessage, null, false);
    }

    /**
     * Manual cleanup method that can be called on demand.
     * Useful for testing or manual execution.
     *
     * @return Number of records deleted
     */
    public int executeCleanupManually() {
        log.info("Manual entity history cleanup requested...");

        LocalDateTime startTime = LocalDateTime.now();
        String status = "SUCCESS";
        String errorMessage = null;
        int deletedCount = 0;

        // Get current user for manual execution
        User currentUser = null;
        try {
            currentUser = userService.getCurrentUser();
        } catch (Exception e) {
            log.warn("Unable to get current user for manual batch execution", e);
        }

        try {
            // Perform cleanup in separate transaction via EntityHistoryService
            deletedCount = entityHistoryService.performHistoryCleanup();
            log.info("Manual cleanup completed. Deleted {} old records", deletedCount);
        } catch (Exception e) {
            status = "FAILED";
            errorMessage = e.getMessage();
            log.error("Error during manual cleanup", e);
            // Record failure
            entityHistoryService.recordBatchExecution(startTime, deletedCount, status, errorMessage, currentUser, true);
            throw e;
        }

        // Record success (after transaction is completed)
        entityHistoryService.recordBatchExecution(startTime, deletedCount, status, errorMessage, currentUser, true);
        return deletedCount;
    }

}
