package com.kiosk.backend.websocket;

import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.service.KioskEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * WebSocket event listener for tracking kiosk connections and disconnections
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final KioskEventService kioskEventService;

    /**
     * Handle WebSocket disconnect events
     */
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        // Get kiosk ID from session attributes
        String kioskId = (String) headerAccessor.getSessionAttributes().get("kioskId");

        if (kioskId != null) {
            log.info("Kiosk disconnected: {}", kioskId);

            // Record WebSocket disconnection event
            try {
                kioskEventService.recordEvent(kioskId, KioskEvent.EventType.WEBSOCKET_DISCONNECTED,
                    "WebSocket 연결 해제됨");
                log.info("Recorded WEBSOCKET_DISCONNECTED event for kiosk: {}", kioskId);
            } catch (Exception e) {
                log.error("Failed to record WebSocket disconnect event for kiosk: {}", kioskId, e);
            }
        } else {
            log.debug("WebSocket disconnected but no kiosk ID found in session");
        }
    }
}
