-- Delete all existing video records from the database
-- Run this script in MySQL Workbench

USE kioskdb;

-- First, check how many videos exist
SELECT COUNT(*) as total_videos FROM videos;

-- Show all videos before deletion (optional)
SELECT id, filename, s3_key, s3_url, uploaded_by, uploaded_at FROM videos;

-- Delete all video records
DELETE FROM videos;

-- Verify deletion
SELECT COUNT(*) as remaining_videos FROM videos;

-- Reset auto-increment (optional - starts ID from 1 again)
ALTER TABLE videos AUTO_INCREMENT = 1;
