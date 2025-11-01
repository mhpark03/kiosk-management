package com.kiosk.backend.aspect;

import com.kiosk.backend.annotation.RecordActivity;
import com.kiosk.backend.entity.EntityHistory;
import com.kiosk.backend.entity.User;
import com.kiosk.backend.repository.EntityHistoryRepository;
import com.kiosk.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * AOP Aspect that automatically records entity activities to entity_history table.
 * Intercepts methods annotated with @RecordActivity and creates history records.
 */
@Aspect
@Component
@Order(100) // Execute after transaction aspect
@Slf4j
@RequiredArgsConstructor
public class ActivityRecordingAspect {

    private final EntityHistoryRepository entityHistoryRepository;
    private final UserRepository userRepository;

    /**
     * Intercepts methods annotated with @RecordActivity and automatically records activity.
     */
    @Around("@annotation(com.kiosk.backend.annotation.RecordActivity)")
    public Object recordActivity(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        RecordActivity annotation = method.getAnnotation(RecordActivity.class);

        Object result = null;
        Throwable thrownException = null;

        try {
            // Execute the original method
            result = joinPoint.proceed();
            return result;
        } catch (Throwable e) {
            thrownException = e;
            throw e;
        } finally {
            // Record activity after method execution (or on error if configured)
            boolean shouldRecord = (thrownException == null) || annotation.recordOnError();
            if (shouldRecord) {
                try {
                    recordHistoryEntry(joinPoint, annotation, result, thrownException);
                } catch (Exception e) {
                    log.error("Failed to record activity for method: {}", method.getName(), e);
                    // Don't propagate this error - activity recording failure shouldn't break the API call
                }
            }
        }
    }

    /**
     * Creates and saves the entity history record in a separate transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    protected void recordHistoryEntry(ProceedingJoinPoint joinPoint, RecordActivity annotation,
                                      Object result, Throwable error) {
        try {
            // Get current user from security context
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
                log.debug("Skipping activity recording - no authenticated user");
                return;
            }

            String userEmail = authentication.getName();
            User user = userRepository.findByEmail(userEmail).orElse(null);
            if (user == null) {
                log.warn("User not found for activity recording: {}", userEmail);
                return;
            }

            // Extract entity ID
            String entityId = extractEntityId(joinPoint, annotation, result);
            if (entityId == null) {
                log.warn("Could not extract entity ID for activity recording");
                return;
            }

            // Build description
            String description = buildDescription(annotation, result, error);

            // Extract additional info from result if available
            String newValue = extractNewValue(result);

            // Extract client IP from HttpServletRequest
            String clientIp = extractClientIp(joinPoint);

            // Create history record
            EntityHistory history = EntityHistory.builder()
                    .entityType(annotation.entityType())
                    .entityId(entityId)
                    .posid(null) // Can be enhanced to extract from context if needed
                    .userid(user.getEmail())
                    .username(user.getDisplayName())
                    .action(annotation.action())
                    .timestamp(LocalDateTime.now())
                    .fieldName(null)
                    .oldValue(null)
                    .newValue(newValue)
                    .description(description)
                    .detail(error != null ? error.getMessage() : null)
                    .clientIp(clientIp)
                    .build();

            entityHistoryRepository.save(history);

            log.debug("Activity recorded: {} - {} by {} (entityId: {})",
                     annotation.action(), description, user.getEmail(), entityId);
        } catch (Exception e) {
            log.error("Failed to save activity history", e);
            // Don't throw - activity recording failure shouldn't break the API
        }
    }

    /**
     * Extracts entity ID from method parameters or result.
     */
    private String extractEntityId(ProceedingJoinPoint joinPoint, RecordActivity annotation, Object result) {
        // Try to get from parameter if specified
        if (!annotation.entityIdParam().isEmpty()) {
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            String[] paramNames = signature.getParameterNames();
            Object[] paramValues = joinPoint.getArgs();

            for (int i = 0; i < paramNames.length; i++) {
                if (paramNames[i].equals(annotation.entityIdParam())) {
                    Object value = paramValues[i];
                    return value != null ? value.toString() : null;
                }
            }
        }

        // Try to extract from ResponseEntity result
        if (result instanceof ResponseEntity) {
            ResponseEntity<?> responseEntity = (ResponseEntity<?>) result;
            Object body = responseEntity.getBody();

            if (body instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) body;

                // Try common ID field names
                for (String key : new String[]{"id", "videoId", "kioskId", "storeId", "userId"}) {
                    if (map.containsKey(key)) {
                        Object idValue = map.get(key);
                        return idValue != null ? idValue.toString() : null;
                    }
                }

                // Check nested objects
                if (map.containsKey("video")) {
                    Object video = map.get("video");
                    if (video instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> videoMap = (Map<String, Object>) video;
                        Object idValue = videoMap.get("id");
                        return idValue != null ? idValue.toString() : null;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Builds the description string for the history record.
     */
    private String buildDescription(RecordActivity annotation, Object result, Throwable error) {
        String baseDescription = annotation.description();

        if (error != null) {
            return baseDescription + " (Failed: " + error.getMessage() + ")";
        }

        return baseDescription;
    }

    /**
     * Extracts a meaningful value from the result to store in newValue field.
     */
    private String extractNewValue(Object result) {
        if (result instanceof ResponseEntity) {
            ResponseEntity<?> responseEntity = (ResponseEntity<?>) result;
            Object body = responseEntity.getBody();

            if (body instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) body;

                // Try to get title or name
                for (String key : new String[]{"title", "name", "filename", "originalFilename"}) {
                    if (map.containsKey(key)) {
                        Object value = map.get(key);
                        return value != null ? value.toString() : null;
                    }
                }

                // Check nested video object
                if (map.containsKey("video")) {
                    Object video = map.get("video");
                    if (video instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> videoMap = (Map<String, Object>) video;
                        Object title = videoMap.get("title");
                        return title != null ? title.toString() : null;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extracts client IP address from HTTP request.
     * Checks various proxy headers before falling back to remote address.
     * Uses RequestContextHolder to get the current HTTP request in AOP context.
     */
    private String extractClientIp(ProceedingJoinPoint joinPoint) {
        try {
            // Try to get HttpServletRequest from RequestContextHolder
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes == null) {
                log.debug("No request attributes available for IP extraction");
                return null;
            }

            HttpServletRequest request = attributes.getRequest();

            // Check X-Forwarded-For (for proxies/load balancers)
            String ip = request.getHeader("X-Forwarded-For");
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                // X-Forwarded-For can contain multiple IPs, take the first one
                int commaIndex = ip.indexOf(',');
                if (commaIndex != -1) {
                    ip = ip.substring(0, commaIndex).trim();
                }
                return ip;
            }

            // Check X-Real-IP
            ip = request.getHeader("X-Real-IP");
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                return ip;
            }

            // Check Proxy-Client-IP
            ip = request.getHeader("Proxy-Client-IP");
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                return ip;
            }

            // Check WL-Proxy-Client-IP (WebLogic)
            ip = request.getHeader("WL-Proxy-Client-IP");
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                return ip;
            }

            // Fallback to remote address
            return request.getRemoteAddr();
        } catch (Exception e) {
            log.debug("Failed to extract client IP: {}", e.getMessage());
            return null;
        }
    }
}
