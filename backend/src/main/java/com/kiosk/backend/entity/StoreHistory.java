package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "storehis")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long storeId; // Reference to the store

    @Column(length = 8)
    private String posid; // Store POS ID for easy reference

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private ActionType action;

    @Column(nullable = false, length = 255)
    private String userid; // User email who performed the action

    @Column(length = 200)
    private String username; // User display name

    @Column(nullable = false)
    private LocalDateTime timestamp; // When the action was performed

    @Column(length = 100)
    private String fieldName; // Which field was changed (e.g., "posname", "state", "address")

    @Column(length = 1000)
    private String oldValue; // Old value (before change)

    @Column(length = 1000)
    private String newValue; // New value (after change)

    @Column(length = 500)
    private String description; // Human-readable description of the change

    public enum ActionType {
        CREATE,     // Store created
        UPDATE,     // Store updated
        DELETE,     // Store soft deleted
        RESTORE,    // Store restored from deletion
        STATE_CHANGE // State changed
    }

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
