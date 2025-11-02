package com.kiosk.backend.websocket;

import com.kiosk.backend.entity.KioskEvent;
import com.kiosk.backend.service.KioskEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * WebSocket event listener for tracking kiosk connections and disconnections
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final KioskEventService kioskEventService;
    private final WebSocketSessionManager sessionManager;

    /**
     * Handle WebSocket connect events
     */
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        // Get kiosk ID and session ID from session attributes
        String kioskId = (String) headerAccessor.getSessionAttributes().get("kioskId");
        String sessionId = headerAccessor.getSessionId();

        if (kioskId != null && sessionId != null) {
            log.info("Kiosk connected: {} with session ID: {}", kioskId, sessionId);

            // Register session in session manager
            sessionManager.registerSession(kioskId, sessionId);

            // Record WebSocket connection event
            try {
                kioskEventService.recordEvent(kioskId, KioskEvent.EventType.WEBSOCKET_CONNECTED,
                    "WebSocket 연결 성공");
                log.info("Recorded WEBSOCKET_CONNECTED event for kiosk: {}", kioskId);
            } catch (Exception e) {
                log.error("Failed to record WebSocket connect event for kiosk: {}", kioskId, e);
            }
        } else {
            log.debug("WebSocket connected but no kiosk ID or session ID found");
        }
    }

    /**
     * Handle WebSocket disconnect events
     */
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        // Get kiosk ID and session ID from session attributes
        String kioskId = (String) headerAccessor.getSessionAttributes().get("kioskId");
        String sessionId = headerAccessor.getSessionId();

        if (kioskId != null && sessionId != null) {
            log.info("Kiosk disconnected: {} with session ID: {}", kioskId, sessionId);

            // Unregister session from session manager
            sessionManager.unregisterSession(kioskId, sessionId);

            // Record WebSocket disconnection event
            try {
                kioskEventService.recordEvent(kioskId, KioskEvent.EventType.WEBSOCKET_DISCONNECTED,
                    "WebSocket 연결 해제됨");
                log.info("Recorded WEBSOCKET_DISCONNECTED event for kiosk: {}", kioskId);
            } catch (Exception e) {
                log.error("Failed to record WebSocket disconnect event for kiosk: {}", kioskId, e);
            }
        } else {
            log.debug("WebSocket disconnected but no kiosk ID or session ID found in session");
        }
    }
}
