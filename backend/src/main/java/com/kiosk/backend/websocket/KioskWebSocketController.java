package com.kiosk.backend.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.Map;

@Controller
@Slf4j
public class KioskWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    public KioskWebSocketController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

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
