package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "kiosk_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 12)
    private String kioskid; // Kiosk ID (12 digits)

    @Column(length = 8)
    private String posid; // Store POS ID

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private ActionType action;

    @Column(nullable = false)
    private LocalDateTime timestamp; // When the action was performed

    @Column(length = 500)
    private String description; // Human-readable description

    @Column(columnDefinition = "TEXT")
    private String detail; // Additional detailed information

    public enum ActionType {
        CONFIG_READ,        // Kiosk app read configuration
        CONFIG_SAVED,       // Kiosk app saved configuration
        SYNC_COMPLETED,     // Video sync completed
        DOWNLOAD_STARTED,   // Download started
        DOWNLOAD_COMPLETED, // Download completed
        HEARTBEAT,          // Heartbeat received
        CONNECTED,          // Kiosk connected
        DISCONNECTED        // Kiosk disconnected
    }

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
