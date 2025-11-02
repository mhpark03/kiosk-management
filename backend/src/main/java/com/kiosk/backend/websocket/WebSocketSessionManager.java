package com.kiosk.backend.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages WebSocket sessions for kiosks.
 * Tracks active sessions and provides methods to disconnect sessions when needed.
 */
@Service
@Slf4j
public class WebSocketSessionManager {

    private final SimpMessagingTemplate messagingTemplate;

    // Map of kioskId to session ID
    private final Map<String, String> kioskSessionMap = new ConcurrentHashMap<>();

    public WebSocketSessionManager(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Register a new kiosk session.
     * If a session already exists for this kiosk, it will be replaced.
     *
     * @param kioskId   The kiosk ID
     * @param sessionId The WebSocket session ID
     */
    public void registerSession(String kioskId, String sessionId) {
        String previousSessionId = kioskSessionMap.put(kioskId, sessionId);
        if (previousSessionId != null && !previousSessionId.equals(sessionId)) {
            log.info("Replaced existing session for kiosk {}: {} -> {}", kioskId, previousSessionId, sessionId);
        } else {
            log.info("Registered new session for kiosk {}: {}", kioskId, sessionId);
        }
    }

    /**
     * Unregister a kiosk session.
     *
     * @param kioskId   The kiosk ID
     * @param sessionId The WebSocket session ID
     */
    public void unregisterSession(String kioskId, String sessionId) {
        String currentSessionId = kioskSessionMap.get(kioskId);
        if (sessionId.equals(currentSessionId)) {
            kioskSessionMap.remove(kioskId);
            log.info("Unregistered session for kiosk {}: {}", kioskId, sessionId);
        }
    }

    /**
     * Disconnect the existing WebSocket session for a kiosk.
     * This is called when a new token is issued to invalidate the old session.
     *
     * @param kioskId The kiosk ID
     */
    public void disconnectExistingSession(String kioskId) {
        String sessionId = kioskSessionMap.get(kioskId);
        if (sessionId != null) {
            log.info("Disconnecting existing WebSocket session for kiosk {}: {}", kioskId, sessionId);

            // Send a disconnect message to the client
            try {
                messagingTemplate.convertAndSendToUser(
                    sessionId,
                    "/queue/disconnect",
                    Map.of(
                        "reason", "NEW_TOKEN_ISSUED",
                        "message", "새 토큰이 발급되어 연결이 종료됩니다. 자동으로 재연결됩니다."
                    )
                );
                log.info("Sent disconnect message to kiosk {} session {}", kioskId, sessionId);
            } catch (Exception e) {
                log.error("Failed to send disconnect message to kiosk {} session {}: {}",
                    kioskId, sessionId, e.getMessage());
            }

            // Remove from tracking map
            kioskSessionMap.remove(kioskId);
            log.info("Removed session {} from tracking map for kiosk {}", sessionId, kioskId);
        } else {
            log.debug("No existing WebSocket session found for kiosk {}", kioskId);
        }
    }

    /**
     * Get the current session ID for a kiosk.
     *
     * @param kioskId The kiosk ID
     * @return The session ID, or null if no session exists
     */
    public String getSessionId(String kioskId) {
        return kioskSessionMap.get(kioskId);
    }

    /**
     * Check if a kiosk has an active session.
     *
     * @param kioskId The kiosk ID
     * @return true if the kiosk has an active session
     */
    public boolean hasActiveSession(String kioskId) {
        return kioskSessionMap.containsKey(kioskId);
    }

    /**
     * Get the total number of active sessions.
     *
     * @return The number of active sessions
     */
    public int getActiveSessionCount() {
        return kioskSessionMap.size();
    }
}
