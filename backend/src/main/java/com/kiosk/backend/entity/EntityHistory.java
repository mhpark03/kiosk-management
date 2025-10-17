package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "entity_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EntityHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private EntityType entityType; // KIOSK or STORE

    @Column(length = 20)
    private String entityId; // kioskid (12 digits) or storeId (number as string)

    @Column(length = 8)
    private String posid; // Store POS ID (common field)

    @Column(nullable = false, length = 255)
    private String userid; // User email who performed the action

    @Column(length = 200)
    private String username; // User display name

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private ActionType action;

    @Column(nullable = false)
    private LocalDateTime timestamp; // When the action was performed

    @Column(length = 100)
    private String fieldName; // Which field was changed (e.g., "posname", "state")

    @Column(length = 1000)
    private String oldValue; // Old value (before change)

    @Column(length = 1000)
    private String newValue; // New value (after change)

    @Column(length = 500)
    private String description; // Human-readable description

    @Column(columnDefinition = "TEXT")
    private String detail; // Additional detailed information (mainly for kiosk)

    public enum EntityType {
        KIOSK,  // Kiosk entity
        STORE,  // Store entity
        USER    // User entity
    }

    public enum ActionType {
        CREATE,         // Entity created
        UPDATE,         // Entity updated
        DELETE,         // Entity soft deleted
        RESTORE,        // Entity restored from deletion
        STATE_CHANGE,   // State changed
        LOGIN,          // User logged in
        LOGOUT,         // User logged out
        PASSWORD_CHANGE,// User changed password
        SUSPEND,        // User suspended
        ACTIVATE        // User activated
    }

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
