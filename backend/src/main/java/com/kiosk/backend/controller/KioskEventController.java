package com.kiosk.backend.controller;

import com.kiosk.backend.dto.KioskEventDTO;
import com.kiosk.backend.dto.RecordKioskEventRequest;
import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.service.KioskEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/kiosk-events")
@CrossOrigin(origins = "https://localhost:5173")
@RequiredArgsConstructor
@Slf4j
public class KioskEventController {

    private final KioskEventService kioskEventService;

    /**
     * Record a new kiosk event.
     * POST /api/kiosk-events
     */
    @PostMapping
    public ResponseEntity<KioskEventDTO> recordEvent(@RequestBody RecordKioskEventRequest request) {
        log.info("POST /api/kiosk-events - Recording event for kiosk {}: {}",
                 request.getKioskid(), request.getEventType());

        try {
            KioskEvent.EventType eventType = KioskEvent.EventType.valueOf(request.getEventType().toUpperCase());

            KioskEvent event = kioskEventService.recordEvent(
                request.getKioskid(),
                eventType,
                request.getUserEmail(),
                request.getUserName(),
                request.getMessage(),
                request.getMetadata()
            );

            return ResponseEntity.ok(KioskEventDTO.fromEntity(event));
        } catch (IllegalArgumentException e) {
            log.error("Invalid event type: {}", request.getEventType());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error recording kiosk event", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get all kiosk events.
     * GET /api/kiosk-events
     */
    @GetMapping
    public ResponseEntity<List<KioskEventDTO>> getAllEvents() {
        log.info("GET /api/kiosk-events - Fetching all events");
        List<KioskEvent> events = kioskEventService.getAllEvents();
        List<KioskEventDTO> eventDTOs = events.stream()
                .map(KioskEventDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(eventDTOs);
    }

    /**
     * Get events for a specific kiosk by kioskid.
     * GET /api/kiosk-events/kiosk/{kioskid}
     */
    @GetMapping("/kiosk/{kioskid}")
    public ResponseEntity<List<KioskEventDTO>> getEventsByKioskid(@PathVariable String kioskid) {
        log.info("GET /api/kiosk-events/kiosk/{} - Fetching events", kioskid);
        List<KioskEvent> events = kioskEventService.getEventsByKioskid(kioskid);
        List<KioskEventDTO> eventDTOs = events.stream()
                .map(KioskEventDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(eventDTOs);
    }

    /**
     * Get recent events for a specific kiosk (last 50).
     * GET /api/kiosk-events/kiosk/{kioskid}/recent
     */
    @GetMapping("/kiosk/{kioskid}/recent")
    public ResponseEntity<List<KioskEventDTO>> getRecentEventsByKioskid(@PathVariable String kioskid) {
        log.info("GET /api/kiosk-events/kiosk/{}/recent - Fetching recent events", kioskid);
        List<KioskEvent> events = kioskEventService.getRecentEventsByKioskid(kioskid);
        List<KioskEventDTO> eventDTOs = events.stream()
                .map(KioskEventDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(eventDTOs);
    }

    /**
     * Get events by event type.
     * GET /api/kiosk-events/type/{eventType}
     */
    @GetMapping("/type/{eventType}")
    public ResponseEntity<List<KioskEventDTO>> getEventsByType(@PathVariable String eventType) {
        log.info("GET /api/kiosk-events/type/{} - Fetching events", eventType);
        try {
            KioskEvent.EventType type = KioskEvent.EventType.valueOf(eventType.toUpperCase());
            List<KioskEvent> events = kioskEventService.getEventsByKioskidAndType(null, type);
            List<KioskEventDTO> eventDTOs = events.stream()
                    .map(KioskEventDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(eventDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid event type: {}", eventType);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get events for a kiosk by event type.
     * GET /api/kiosk-events/kiosk/{kioskid}/type/{eventType}
     */
    @GetMapping("/kiosk/{kioskid}/type/{eventType}")
    public ResponseEntity<List<KioskEventDTO>> getEventsByKioskidAndType(
            @PathVariable String kioskid,
            @PathVariable String eventType) {
        log.info("GET /api/kiosk-events/kiosk/{}/type/{} - Fetching events", kioskid, eventType);
        try {
            KioskEvent.EventType type = KioskEvent.EventType.valueOf(eventType.toUpperCase());
            List<KioskEvent> events = kioskEventService.getEventsByKioskidAndType(kioskid, type);
            List<KioskEventDTO> eventDTOs = events.stream()
                    .map(KioskEventDTO::fromEntity)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(eventDTOs);
        } catch (IllegalArgumentException e) {
            log.error("Invalid event type: {}", eventType);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get events by POS ID.
     * GET /api/kiosk-events/pos/{posid}
     */
    @GetMapping("/pos/{posid}")
    public ResponseEntity<List<KioskEventDTO>> getEventsByPosid(@PathVariable String posid) {
        log.info("GET /api/kiosk-events/pos/{} - Fetching events", posid);
        List<KioskEvent> events = kioskEventService.getEventsByPosid(posid);
        List<KioskEventDTO> eventDTOs = events.stream()
                .map(KioskEventDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(eventDTOs);
    }

    /**
     * Get events within a date range.
     * GET /api/kiosk-events/range?start={startDate}&end={endDate}
     * Date format: yyyy-MM-dd'T'HH:mm:ss
     */
    @GetMapping("/range")
    public ResponseEntity<List<KioskEventDTO>> getEventsBetweenDates(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        log.info("GET /api/kiosk-events/range - Fetching events between {} and {}", start, end);
        List<KioskEvent> events = kioskEventService.getEventsBetweenDates(start, end);
        List<KioskEventDTO> eventDTOs = events.stream()
                .map(KioskEventDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(eventDTOs);
    }

    /**
     * Get events for a kiosk within a date range.
     * GET /api/kiosk-events/kiosk/{kioskid}/range?start={startDate}&end={endDate}
     */
    @GetMapping("/kiosk/{kioskid}/range")
    public ResponseEntity<List<KioskEventDTO>> getEventsByKioskidBetweenDates(
            @PathVariable String kioskid,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        log.info("GET /api/kiosk-events/kiosk/{}/range - Fetching events between {} and {}",
                 kioskid, start, end);
        List<KioskEvent> events = kioskEventService.getEventsByKioskidBetweenDates(kioskid, start, end);
        List<KioskEventDTO> eventDTOs = events.stream()
                .map(KioskEventDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(eventDTOs);
    }

    /**
     * Get event count for a kiosk.
     * GET /api/kiosk-events/kiosk/{kioskid}/count
     */
    @GetMapping("/kiosk/{kioskid}/count")
    public ResponseEntity<Long> countEventsByKioskid(@PathVariable String kioskid) {
        log.info("GET /api/kiosk-events/kiosk/{}/count - Counting events", kioskid);
        long count = kioskEventService.countEventsByKioskid(kioskid);
        return ResponseEntity.ok(count);
    }
}
