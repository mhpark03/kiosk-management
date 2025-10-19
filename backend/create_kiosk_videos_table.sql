-- Create kiosk_videos table for many-to-many relationship between kiosks and videos
CREATE TABLE IF NOT EXISTS kiosk_videos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    kiosk_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(255),
    assigned_at TIMESTAMP,
    UNIQUE KEY unique_kiosk_video (kiosk_id, video_id),
    INDEX idx_kiosk_id (kiosk_id),
    INDEX idx_video_id (video_id),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
