package com.kiosk.backend.service;

import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.repository.KioskEventRepository;
import com.kiosk.backend.repository.KioskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service for managing kiosk event records.
 * Handles recording and retrieval of kiosk events from the downloader app.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KioskEventService {

    private final KioskEventRepository kioskEventRepository;
    private final KioskRepository kioskRepository;

    /**
     * Records a kiosk event.
     * Runs in its own transaction to ensure it commits independently.
     *
     * @param kioskid 12-digit kiosk ID
     * @param eventType Type of event
     * @param userEmail User email (optional)
     * @param userName User name (optional)
     * @param message Event message
     * @param metadata Additional metadata (JSON or text)
     * @param clientIp IP address of the client (optional)
     * @return The saved event
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public KioskEvent recordEvent(String kioskid, KioskEvent.EventType eventType,
                                  String userEmail, String userName,
                                  String message, String metadata, String clientIp) {
        try {
            // Try to find kiosk to get additional information
            Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(kioskid);

            KioskEvent.KioskEventBuilder builder = KioskEvent.builder()
                    .kioskid(kioskid)
                    .eventType(eventType)
                    .userEmail(userEmail)
                    .userName(userName)
                    .message(message)
                    .metadata(metadata)
                    .clientIp(clientIp)
                    .timestamp(LocalDateTime.now());

            // Add kiosk info if found
            if (kioskOpt.isPresent()) {
                Kiosk kiosk = kioskOpt.get();
                builder.kioskId(kiosk.getId())
                       .posid(kiosk.getPosid())
                       .kioskno(kiosk.getKioskno());
            }

            KioskEvent event = builder.build();
            KioskEvent savedEvent = kioskEventRepository.save(event);

            log.debug("Kiosk event recorded: {} - {} for kiosk {}", eventType, message, kioskid);
            return savedEvent;

        } catch (Exception e) {
            log.error("Failed to record kiosk event for kiosk {}", kioskid, e);
            throw e;
        }
    }

    /**
     * Records a simple kiosk event with just event type and message.
     *
     * @param kioskid 12-digit kiosk ID
     * @param eventType Type of event
     * @param message Event message
     * @return The saved event
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public KioskEvent recordEvent(String kioskid, KioskEvent.EventType eventType, String message) {
        return recordEvent(kioskid, eventType, null, null, message, null, null);
    }

    /**
     * Get all events ordered by timestamp descending.
     *
     * @return List of all events
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getAllEvents() {
        return kioskEventRepository.findAllByOrderByTimestampDesc();
    }

    /**
     * Get events for a specific kiosk by kioskid.
     *
     * @param kioskid 12-digit kiosk ID
     * @return List of events for the kiosk
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getEventsByKioskid(String kioskid) {
        return kioskEventRepository.findByKioskidOrderByTimestampDesc(kioskid);
    }

    /**
     * Get recent events for a specific kiosk (last 50).
     *
     * @param kioskid 12-digit kiosk ID
     * @return List of recent events for the kiosk
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getRecentEventsByKioskid(String kioskid) {
        return kioskEventRepository.findTop50ByKioskidOrderByTimestampDesc(kioskid);
    }

    /**
     * Get events for a specific kiosk by event type.
     *
     * @param kioskid 12-digit kiosk ID
     * @param eventType Type of event
     * @return List of events
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getEventsByKioskidAndType(String kioskid, KioskEvent.EventType eventType) {
        return kioskEventRepository.findByKioskidAndEventTypeOrderByTimestampDesc(kioskid, eventType);
    }

    /**
     * Get events by POS ID.
     *
     * @param posid POS ID
     * @return List of events
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getEventsByPosid(String posid) {
        return kioskEventRepository.findByPosidOrderByTimestampDesc(posid);
    }

    /**
     * Get events within a date range.
     *
     * @param startDate Start date
     * @param endDate End date
     * @return List of events
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getEventsBetweenDates(LocalDateTime startDate, LocalDateTime endDate) {
        return kioskEventRepository.findEventsBetweenDates(startDate, endDate);
    }

    /**
     * Get events for a kiosk within a date range.
     *
     * @param kioskid 12-digit kiosk ID
     * @param startDate Start date
     * @param endDate End date
     * @return List of events
     */
    @Transactional(readOnly = true)
    public List<KioskEvent> getEventsByKioskidBetweenDates(String kioskid, LocalDateTime startDate, LocalDateTime endDate) {
        return kioskEventRepository.findEventsByKioskidBetweenDates(kioskid, startDate, endDate);
    }

    /**
     * Count events for a kiosk.
     *
     * @param kioskid 12-digit kiosk ID
     * @return Event count
     */
    @Transactional(readOnly = true)
    public long countEventsByKioskid(String kioskid) {
        return kioskEventRepository.countByKioskid(kioskid);
    }

    /**
     * Clean up old events older than the specified cutoff date.
     * Runs in its own transaction.
     *
     * @param cutoffDate Cutoff date
     * @return Number of events deleted
     */
    @Transactional
    public int cleanupOldEvents(LocalDateTime cutoffDate) {
        try {
            int deletedCount = kioskEventRepository.deleteOldEvents(cutoffDate);
            log.info("Cleaned up {} old kiosk events before {}", deletedCount, cutoffDate);
            return deletedCount;
        } catch (Exception e) {
            log.error("Failed to cleanup old kiosk events", e);
            throw e;
        }
    }

    /**
     * Clean up old events older than the specified number of months.
     *
     * @param months Number of months to keep
     * @return Number of events deleted
     */
    @Transactional
    public int cleanupOldEvents(int months) {
        LocalDateTime cutoffDate = LocalDateTime.now().minusMonths(months);
        return cleanupOldEvents(cutoffDate);
    }
}
