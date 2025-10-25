package com.kiosk.backend.websocket;

import com.kiosk.backend.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            log.info("WebSocket CONNECT request received");

            // Extract Authorization header
            List<String> authHeaders = accessor.getNativeHeader("Authorization");

            if (authHeaders == null || authHeaders.isEmpty()) {
                log.error("No Authorization header found in WebSocket connection");
                throw new IllegalArgumentException("Missing Authorization header");
            }

            String authHeader = authHeaders.get(0);

            if (!authHeader.startsWith("Bearer ")) {
                log.error("Invalid Authorization header format");
                throw new IllegalArgumentException("Invalid Authorization header format");
            }

            String token = authHeader.substring(7); // Remove "Bearer " prefix

            // Validate token
            if (!jwtTokenProvider.validateToken(token)) {
                log.error("Invalid JWT token for WebSocket connection");
                throw new IllegalArgumentException("Invalid or expired token");
            }

            // Extract kiosk information from token
            try {
                Claims claims = jwtTokenProvider.getKioskClaimsFromToken(token);
                String kioskId = claims.getSubject();
                String posId = claims.get("posId", String.class);
                Integer kioskNo = claims.get("kioskNo", Integer.class);
                String tokenType = claims.get("type", String.class);

                // Verify this is a kiosk token
                if (!"kiosk".equals(tokenType)) {
                    log.error("Token is not a kiosk token");
                    throw new IllegalArgumentException("Invalid token type");
                }

                // Store kiosk information in session attributes
                accessor.getSessionAttributes().put("kioskId", kioskId);
                accessor.getSessionAttributes().put("posId", posId);
                accessor.getSessionAttributes().put("kioskNo", kioskNo);
                accessor.getSessionAttributes().put("authenticated", true);

                log.info("WebSocket authenticated for kiosk: {} (POS: {}, No: {})", kioskId, posId, kioskNo);

            } catch (Exception e) {
                log.error("Error extracting kiosk information from token", e);
                throw new IllegalArgumentException("Invalid token claims");
            }
        }

        return message;
    }
}
