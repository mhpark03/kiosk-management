package com.kiosk.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "kiosk_videos", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"kiosk_id", "video_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KioskVideo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kiosk_id", nullable = false)
    private Long kioskId;

    @Column(name = "video_id", nullable = false)
    private Long videoId;

    @Column(nullable = false)
    @Builder.Default
    private Integer displayOrder = 0; // Order in which videos should be displayed

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "assigned_by", length = 255)
    private String assignedBy; // User who assigned this video

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "download_status", length = 20)
    @Builder.Default
    private String downloadStatus = "PENDING"; // PENDING, DOWNLOADING, COMPLETED, FAILED

    @Column(name = "source_type", length = 20)
    @Builder.Default
    private String sourceType = "MANUAL"; // MANUAL (키오스크 관리 화면에서 직접 추가), MENU_VIDEO (메뉴 영상), MENU_IMAGE (메뉴 이미지)

    @Column(name = "menu_id", length = 255)
    private String menuId; // 메뉴에서 추가된 경우 메뉴 ID 저장
}
