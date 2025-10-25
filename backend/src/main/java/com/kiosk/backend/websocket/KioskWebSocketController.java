package com.kiosk.backend.websocket;

import com.kiosk.backend.dto.KioskVideoDTO;
import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.service.KioskEventService;
import com.kiosk.backend.service.KioskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Controller
@Slf4j
@RequiredArgsConstructor
public class KioskWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final KioskService kioskService;
    private final KioskEventService kioskEventService;

    /**
     * Handle kiosk connection
     */
    @MessageMapping("/kiosk/connect")
    @SendTo("/topic/kiosk/status")
    public Map<String, Object> handleKioskConnect(@Payload Map<String, Object> payload,
                                                    SimpMessageHeaderAccessor headerAccessor) {
        String kioskId = (String) payload.get("kioskId");
        log.info("Kiosk connected: {}", kioskId);

        // Store kiosk ID in session
        headerAccessor.getSessionAttributes().put("kioskId", kioskId);

        // Record WebSocket connection event
        try {
            kioskEventService.recordEvent(kioskId, KioskEvent.EventType.WEBSOCKET_CONNECTED,
                "WebSocket 연결됨");
            log.info("Recorded WEBSOCKET_CONNECTED event for kiosk: {}", kioskId);
        } catch (Exception e) {
            log.error("Failed to record WebSocket connect event for kiosk: {}", kioskId, e);
        }

        return Map.of(
            "type", "CONNECTED",
            "kioskId", kioskId,
            "timestamp", LocalDateTime.now().toString(),
            "message", "Successfully connected to server"
        );
    }

    /**
     * Handle kiosk heartbeat/ping
     */
    @MessageMapping("/kiosk/heartbeat")
    public void handleHeartbeat(@Payload Map<String, Object> payload) {
        String kioskId = (String) payload.get("kioskId");
        log.debug("Heartbeat from kiosk: {}", kioskId);

        // Send acknowledgment back to specific kiosk
        messagingTemplate.convertAndSend("/topic/kiosk/" + kioskId, Map.of(
            "type", "HEARTBEAT_ACK",
            "timestamp", LocalDateTime.now().toString()
        ));
    }

    /**
     * Handle video sync request from kiosk
     */
    @MessageMapping("/kiosk/sync")
    public void handleSyncRequest(@Payload Map<String, Object> payload,
                                   SimpMessageHeaderAccessor headerAccessor) {
        String kioskId = (String) payload.get("kioskId");
        log.info("Video sync request from kiosk: {}", kioskId);

        try {
            // Get videos for this kiosk
            List<KioskVideoDTO> videos = kioskService.getKioskVideosWithStatusByKioskId(kioskId);

            // Send video list back to the requesting kiosk
            messagingTemplate.convertAndSend("/topic/kiosk/" + kioskId, Map.of(
                "type", "SYNC_RESPONSE",
                "success", true,
                "data", videos,
                "timestamp", LocalDateTime.now().toString(),
                "message", "영상 목록 동기화 완료"
            ));

            log.info("Sent {} videos to kiosk {}", videos.size(), kioskId);

        } catch (Exception e) {
            log.error("Error processing sync request for kiosk " + kioskId, e);

            // Send error response
            messagingTemplate.convertAndSend("/topic/kiosk/" + kioskId, Map.of(
                "type", "SYNC_RESPONSE",
                "success", false,
                "error", e.getMessage(),
                "timestamp", LocalDateTime.now().toString(),
                "message", "영상 목록 동기화 실패"
            ));
        }
    }

    /**
     * Handle status updates from kiosk
     */
    @MessageMapping("/kiosk/status")
    public void handleStatusUpdate(@Payload Map<String, Object> payload) {
        String kioskId = (String) payload.get("kioskId");
        String status = (String) payload.get("status");
        log.info("Status update from kiosk {}: {}", kioskId, status);

        // Broadcast to monitoring dashboard (if any)
        messagingTemplate.convertAndSend("/topic/kiosk/status", Map.of(
            "kioskId", kioskId,
            "status", status,
            "timestamp", LocalDateTime.now().toString()
        ));
    }

    /**
     * Send notification to specific kiosk
     */
    public void sendNotificationToKiosk(String kioskId, String message, String type) {
        log.info("Sending notification to kiosk {}: {}", kioskId, message);

        messagingTemplate.convertAndSend("/topic/kiosk/" + kioskId, Map.of(
            "type", type,
            "message", message,
            "timestamp", LocalDateTime.now().toString()
        ));
    }

    /**
     * Broadcast notification to all connected kiosks
     */
    public void broadcastToAllKiosks(String message, String type) {
        log.info("Broadcasting to all kiosks: {}", message);

        messagingTemplate.convertAndSend("/topic/kiosk/broadcast", Map.of(
            "type", type,
            "message", message,
            "timestamp", LocalDateTime.now().toString()
        ));
    }
}
