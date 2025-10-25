package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "kiosk_events", indexes = {
    @Index(name = "idx_kiosk_id", columnList = "kiosk_id"),
    @Index(name = "idx_kioskid", columnList = "kioskid"),
    @Index(name = "idx_event_type", columnList = "event_type"),
    @Index(name = "idx_timestamp", columnList = "timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kiosk_id")
    private Long kioskId; // Foreign key reference to Kiosk.id

    @Column(length = 12)
    private String kioskid; // 12-digit kiosk ID for denormalization

    @Column(length = 8)
    private String posid; // Store ID for denormalization

    private Integer kioskno; // Kiosk number for denormalization

    @Column(nullable = false, length = 50, name = "event_type")
    @Enumerated(EnumType.STRING)
    private EventType eventType;

    @Column(length = 255)
    private String userEmail; // Email of user if applicable

    @Column(length = 200)
    private String userName; // Name of user if applicable

    @Column(length = 500)
    private String message; // Event message/description

    @Column(columnDefinition = "TEXT")
    private String metadata; // JSON or additional details

    @Column(length = 45)
    private String clientIp; // IP address of the client that triggered the event (supports IPv6)

    @Column(nullable = false)
    @CreationTimestamp
    private LocalDateTime timestamp;

    // Optional: Add @ManyToOne relationship to Kiosk
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kiosk_id", referencedColumnName = "id", insertable = false, updatable = false)
    private Kiosk kiosk;

    public enum EventType {
        // Authentication events
        APP_START,              // Kiosk downloader app started
        APP_SHUTDOWN,           // Kiosk downloader app shutdown
        USER_LOGIN,             // User logged in
        USER_LOGOUT,            // User logged out

        // Configuration events
        CONFIG_SAVED,           // Configuration saved
        CONFIG_DELETED,         // Configuration deleted
        CONFIG_SYNCED_FROM_SERVER, // Configuration synced from server via WebSocket
        CONFIG_UPDATED_BY_WEB,  // Configuration updated by web admin
        CONNECTION_TEST,        // Connection test performed
        CONNECTION_SUCCESS,     // Connection test succeeded
        CONNECTION_FAILED,      // Connection test failed

        // Sync events
        SYNC_STARTED,           // Video sync started
        SYNC_COMPLETED,         // Video sync completed
        SYNC_FAILED,            // Video sync failed

        // Download events
        DOWNLOAD_STARTED,       // Video download started
        DOWNLOAD_PROGRESS,      // Video download progress update
        DOWNLOAD_COMPLETED,     // Video download completed
        DOWNLOAD_FAILED,        // Video download failed
        DOWNLOAD_CANCELLED,     // Video download cancelled

        // File events
        FILE_DELETED,           // Video file deleted locally
        FILE_VERIFIED,          // Video file verified

        // Error events
        ERROR_OCCURRED,         // Generic error occurred
        NETWORK_ERROR,          // Network error
        STORAGE_ERROR,          // Storage error

        // System events
        AUTO_SYNC_TRIGGERED,    // Auto sync triggered
        MANUAL_ACTION,          // Manual action by user
        HEALTH_CHECK,           // Health check ping

        // WebSocket events
        WEBSOCKET_CONNECTED,    // WebSocket connection established
        WEBSOCKET_DISCONNECTED  // WebSocket connection closed
    }

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }

    public Long getKioskId() {
        return kioskId;
    }

    public void setKioskId(Long kioskId) {
        this.kioskId = kioskId;
    }

    // Explicit getters to work around Lombok handling of all-lowercase field names
    public String getKioskid() {
        return kioskid;
    }

    public void setKioskid(String kioskid) {
        this.kioskid = kioskid;
    }

    public String getPosid() {
        return posid;
    }

    public void setPosid(String posid) {
        this.posid = posid;
    }
}
