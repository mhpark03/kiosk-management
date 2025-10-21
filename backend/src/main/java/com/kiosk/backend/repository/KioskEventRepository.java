package com.kiosk.backend.repository;

import com.kiosk.backend.entity.KioskEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface KioskEventRepository extends JpaRepository<KioskEvent, Long> {

    // Find all events ordered by timestamp descending
    List<KioskEvent> findAllByOrderByTimestampDesc();

    // Find events by kiosk ID (database ID)
    List<KioskEvent> findByKioskIdOrderByTimestampDesc(Long kioskId);

    // Find events by kioskid (12-digit string)
    List<KioskEvent> findByKioskidOrderByTimestampDesc(String kioskid);

    // Find events by posid
    List<KioskEvent> findByPosidOrderByTimestampDesc(String posid);

    // Find events by event type
    List<KioskEvent> findByEventTypeOrderByTimestampDesc(KioskEvent.EventType eventType);

    // Find events by kiosk ID and event type
    List<KioskEvent> findByKioskIdAndEventTypeOrderByTimestampDesc(Long kioskId, KioskEvent.EventType eventType);

    // Find events by kioskid and event type
    List<KioskEvent> findByKioskidAndEventTypeOrderByTimestampDesc(String kioskid, KioskEvent.EventType eventType);

    // Find events by user email
    List<KioskEvent> findByUserEmailOrderByTimestampDesc(String userEmail);

    // Find events within date range
    @Query("SELECT e FROM KioskEvent e WHERE e.timestamp >= :startDate AND e.timestamp <= :endDate ORDER BY e.timestamp DESC")
    List<KioskEvent> findEventsBetweenDates(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    // Find events by kioskid within date range
    @Query("SELECT e FROM KioskEvent e WHERE e.kioskid = :kioskid AND e.timestamp >= :startDate AND e.timestamp <= :endDate ORDER BY e.timestamp DESC")
    List<KioskEvent> findEventsByKioskidBetweenDates(@Param("kioskid") String kioskid, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    // Find recent events by kioskid (limit)
    List<KioskEvent> findTop50ByKioskidOrderByTimestampDesc(String kioskid);

    // Find recent events by kiosk ID (limit)
    List<KioskEvent> findTop50ByKioskIdOrderByTimestampDesc(Long kioskId);

    // Delete old events older than specified date
    @Modifying
    @Query("DELETE FROM KioskEvent e WHERE e.timestamp < :cutoffDate")
    int deleteOldEvents(@Param("cutoffDate") LocalDateTime cutoffDate);

    // Count events by kioskid
    long countByKioskid(String kioskid);

    // Count events by event type
    long countByEventType(KioskEvent.EventType eventType);

    // Count events by kioskid and event type
    long countByKioskidAndEventType(String kioskid, KioskEvent.EventType eventType);
}
