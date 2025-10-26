-- Add VEO_GENERATED to video_type ENUM in videos table
-- This fixes the "Data truncated for column 'video_type'" error when saving Veo-generated videos

-- Check current ENUM values
SELECT COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kiosk_db'
  AND TABLE_NAME = 'videos'
  AND COLUMN_NAME = 'video_type';

-- Add VEO_GENERATED to the ENUM
ALTER TABLE videos
MODIFY COLUMN video_type ENUM('UPLOAD', 'RUNWAY_GENERATED', 'VEO_GENERATED') NOT NULL;

-- Verify the change
SELECT COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kiosk_db'
  AND TABLE_NAME = 'videos'
  AND COLUMN_NAME = 'video_type';

-- Optional: Check if there are any existing rows that might be affected
SELECT video_type, COUNT(*) as count
FROM videos
GROUP BY video_type;
