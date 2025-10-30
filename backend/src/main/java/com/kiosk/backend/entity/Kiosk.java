package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "kiosks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"posid", "kioskno"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Kiosk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 12)
    private String kioskid; // 12-digit kiosk ID (e.g., 000000000001)

    @Column(nullable = false, length = 8)
    private String posid; // Store ID (foreign key reference)

    @Column(nullable = false)
    private Integer kioskno; // Kiosk number within the store (1, 2, 3, ...)

    @Column(length = 100)
    private String maker; // Kiosk manufacturer

    @Column(length = 100)
    private String serialno; // Serial number

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KioskState state = KioskState.INACTIVE;

    // Configuration fields from Kiosk app
    @Column(length = 500)
    private String downloadPath; // Download path for videos

    @Column(length = 500)
    private String apiUrl; // API server URL

    private Boolean autoSync; // Auto-sync enabled

    private Integer syncInterval; // Sync interval in hours

    private LocalDateTime lastSync; // Last sync timestamp

    @Column(nullable = false)
    @Builder.Default
    private Boolean configModifiedByWeb = false; // Flag: admin modified config via web

    private LocalDateTime regdate; // Registration date

    private LocalDateTime setdate; // Setup date

    private LocalDateTime deldate; // Delete date

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    // Optional: Add @ManyToOne relationship to Store
    // @ManyToOne(fetch = FetchType.LAZY)
    // @JoinColumn(name = "posid", referencedColumnName = "posid", insertable = false, updatable = false)
    // private Store store;

    public enum KioskState {
        PREPARING,
        ACTIVE,
        INACTIVE,
        MAINTENANCE,
        DELETED
    }
}
