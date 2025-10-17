package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

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
    private String kioskid; // 12-digit kiosk ID

    @Column(nullable = false, length = 8)
    private String posid; // Store ID

    @Column(nullable = false, length = 255)
    private String userid; // User email who made the change

    @Column(nullable = false, length = 50)
    private String action; // CREATE, UPDATE, DELETE, RESTORE, STATE_CHANGE

    @Column(columnDefinition = "TEXT")
    private String detail; // Detailed description of changes

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime updatetime;
}
