package com.kiosk.backend.repository;

import com.kiosk.backend.entity.EntityHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EntityHistoryRepository extends JpaRepository<EntityHistory, Long> {

    // Find all history ordered by timestamp descending
    List<EntityHistory> findAllByOrderByTimestampDesc();

    // Find history by entity type
    List<EntityHistory> findByEntityTypeOrderByTimestampDesc(EntityHistory.EntityType entityType);

    // Find history by entity ID
    List<EntityHistory> findByEntityIdOrderByTimestampDesc(String entityId);

    // Find history by POS ID
    List<EntityHistory> findByPosidOrderByTimestampDesc(String posid);

    // Find history by entity type and POS ID
    List<EntityHistory> findByEntityTypeAndPosidOrderByTimestampDesc(
            EntityHistory.EntityType entityType, String posid);

    // Find history by user
    List<EntityHistory> findByUseridOrderByTimestampDesc(String userid);

    // Find history by action type
    List<EntityHistory> findByActionOrderByTimestampDesc(EntityHistory.ActionType action);

    // Find history by entity type and action
    List<EntityHistory> findByEntityTypeAndActionOrderByTimestampDesc(
            EntityHistory.EntityType entityType, EntityHistory.ActionType action);

    // Find history by entity type and entity ID
    List<EntityHistory> findByEntityTypeAndEntityIdOrderByTimestampDesc(
            EntityHistory.EntityType entityType, String entityId);

    // Delete old records for non-USER entities (KIOSK and STORE) older than specified date
    @Modifying
    @Query("DELETE FROM EntityHistory e WHERE e.entityType != :userType AND e.timestamp < :cutoffDate")
    int deleteOldNonUserRecords(@Param("userType") EntityHistory.EntityType userType,
                                @Param("cutoffDate") LocalDateTime cutoffDate);

    // Find recent batch job executions (entityId = 'BATCH_JOB')
    List<EntityHistory> findTop10ByEntityIdOrderByTimestampDesc(String entityId);
}
