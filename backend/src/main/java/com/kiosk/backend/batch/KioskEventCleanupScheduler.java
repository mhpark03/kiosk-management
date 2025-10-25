package com.kiosk.backend.batch;

import com.kiosk.backend.service.EntityHistoryService;
import com.kiosk.backend.service.KioskEventService;
import com.kiosk.backend.service.UserService;
import com.kiosk.backend.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Scheduled batch job to clean up old kiosk event records.
 * Deletes kiosk event records older than 2 days.
 * Runs daily at 3:00 AM KST (Korea Standard Time).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KioskEventCleanupScheduler {

    private final KioskEventService kioskEventService;
    private final EntityHistoryService entityHistoryService;
    private final UserService userService;

    private static final int RETENTION_DAYS = 2; // Keep events for 2 days

    /**
     * Runs daily at 3:00 AM KST to clean up old kiosk event records.
     * Deletes events older than 2 days.
     */
    @Scheduled(cron = "0 0 3 * * ?", zone = "Asia/Seoul") // Every day at 3:00 AM KST
    public void cleanupOldKioskEvents() {
        log.info("Starting kiosk event cleanup batch job...");

        LocalDateTime startTime = LocalDateTime.now();
        String status = "SUCCESS";
        String errorMessage = null;
        int deletedCount = 0;

        try {
            // Delete events older than 2 days
            deletedCount = kioskEventService.cleanupOldEventsInDays(RETENTION_DAYS);

            log.info("Kiosk event cleanup completed. Deleted {} old records (older than {} days)",
                    deletedCount, RETENTION_DAYS);

        } catch (Exception e) {
            status = "FAILED";
            errorMessage = e.getMessage();
            log.error("Error during kiosk event cleanup batch job", e);
        }

        // Record batch execution result
        try {
            entityHistoryService.recordBatchExecution(
                startTime,
                deletedCount,
                status,
                errorMessage,
                null,
                false,
                "KIOSK_EVENT"
            );
        } catch (Exception e) {
            log.error("Failed to record batch execution history", e);
        }
    }

    /**
     * Manual cleanup method that can be called on demand.
     * Useful for testing or manual execution.
     *
     * @return Number of records deleted
     */
    public int executeCleanupManually() {
        log.info("Manual kiosk event cleanup requested...");

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
            // Delete events older than 2 days
            deletedCount = kioskEventService.cleanupOldEventsInDays(RETENTION_DAYS);
            log.info("Manual cleanup completed. Deleted {} old records (older than {} days)",
                    deletedCount, RETENTION_DAYS);
        } catch (Exception e) {
            status = "FAILED";
            errorMessage = e.getMessage();
            log.error("Error during manual cleanup", e);

            // Record failure
            try {
                entityHistoryService.recordBatchExecution(
                    startTime,
                    deletedCount,
                    status,
                    errorMessage,
                    currentUser,
                    true,
                    "KIOSK_EVENT"
                );
            } catch (Exception ex) {
                log.error("Failed to record batch execution history", ex);
            }
            throw e;
        }

        // Record success
        try {
            entityHistoryService.recordBatchExecution(
                startTime,
                deletedCount,
                status,
                errorMessage,
                currentUser,
                true,
                "KIOSK_EVENT"
            );
        } catch (Exception e) {
            log.error("Failed to record batch execution history", e);
        }

        return deletedCount;
    }
}
