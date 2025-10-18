package com.kiosk.backend.controller;

import com.kiosk.backend.batch.EntityHistoryCleanupScheduler;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.repository.EntityHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller for manual batch job execution.
 * Only accessible by ADMIN users.
 */
@RestController
@RequestMapping("/api/batch")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BatchController {

    private final EntityHistoryCleanupScheduler cleanupScheduler;
    private final EntityHistoryRepository entityHistoryRepository;

    /**
     * Manually trigger entity history cleanup batch job.
     * Deletes KIOSK and STORE history records older than 1 month.
     * USER records are preserved.
     *
     * @return Response with number of deleted records
     */
    @PostMapping("/cleanup-history")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> cleanupHistory() {
        int deletedCount = cleanupScheduler.executeCleanupManually();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("deletedRecords", deletedCount);
        response.put("message", "Entity history cleanup completed successfully");

        return ResponseEntity.ok(response);
    }

    /**
     * Get recent batch execution history (last 10 executions).
     *
     * @return List of batch execution records
     */
    @GetMapping("/execution-history")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<EntityHistory>> getBatchExecutionHistory() {
        List<EntityHistory> history = entityHistoryRepository.findTop10ByEntityIdOrderByTimestampDesc("BATCH_JOB");
        return ResponseEntity.ok(history);
    }
}
