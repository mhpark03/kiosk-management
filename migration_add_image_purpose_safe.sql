-- Safe migration script to add image_purpose column to videos table
-- This script checks if the column exists before attempting to add it
-- Categories:
-- - GENERAL: General purpose images
-- - REFERENCE: Reference images for video generation (Runway, Veo)
-- - MENU: Coffee kiosk menu product images

-- Use the kioskdb database
USE kioskdb;

-- Check and add image_purpose column if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kioskdb'
    AND TABLE_NAME = 'videos'
    AND COLUMN_NAME = 'image_purpose'
);

-- Prepare the ALTER TABLE statement
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE videos ADD COLUMN image_purpose VARCHAR(20) DEFAULT ''GENERAL''',
    'SELECT ''Column image_purpose already exists, skipping...'' AS message'
);

-- Execute the statement
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Display the result
SELECT
    CASE
        WHEN @column_exists = 0 THEN 'Column image_purpose added successfully'
        ELSE 'Column image_purpose already exists'
    END AS result;
