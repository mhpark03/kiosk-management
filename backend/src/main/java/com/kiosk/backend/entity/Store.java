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
@Table(name = "stores")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 8)
    private String posid; // 8-digit store ID (e.g., 00000001)

    @Column(nullable = false, length = 200)
    private String posname; // Store name

    @Column(length = 20)
    private String postcode; // Postal code

    @Column(length = 500)
    private String address; // Full address

    @Column(length = 500)
    private String addressDetail; // Detailed address

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private StoreState state = StoreState.ACTIVE;

    @Column(length = 255)
    private String userid; // User email who created/modified the store

    private LocalDateTime regdate; // Registration date

    private LocalDateTime startdate; // Start date (operation start)

    private LocalDateTime deldate; // Delete date

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public enum StoreState {
        ACTIVE,
        INACTIVE,
        MAINTENANCE,
        DELETED
    }
}
