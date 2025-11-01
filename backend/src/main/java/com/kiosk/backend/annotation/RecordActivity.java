package com.kiosk.backend.annotation;

import com.kiosk.backend.entity.EntityHistory;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to automatically record entity activity to entity_history table.
 * Place this annotation on controller methods to automatically track user actions.
 *
 * Example usage:
 * @RecordActivity(
 *   entityType = EntityHistory.EntityType.VIDEO,
 *   action = EntityHistory.ActionType.VIDEO_UPLOAD,
 *   description = "Video uploaded"
 * )
 * public ResponseEntity<?> uploadVideo(...) { ... }
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RecordActivity {

    /**
     * Type of entity being acted upon (KIOSK, STORE, USER, VIDEO)
     */
    EntityHistory.EntityType entityType();

    /**
     * Type of action being performed (CREATE, UPDATE, DELETE, etc.)
     */
    EntityHistory.ActionType action();

    /**
     * Human-readable description of the activity.
     * Can use SpEL expressions with #result, #args, etc.
     */
    String description();

    /**
     * Name of the parameter that contains the entity ID.
     * If empty, will try to extract from result.
     */
    String entityIdParam() default "";

    /**
     * Whether to record activity even if the method throws an exception.
     * Default is false (only record on success).
     */
    boolean recordOnError() default false;
}
