-- Fix event_type column in kiosk_events table
-- This script checks and fixes the column definition to match the entity

-- Step 1: Check current column definition
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM
    INFORMATION_SCHEMA.COLUMNS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kiosk_events'
    AND COLUMN_NAME = 'event_type';

-- Step 2: Alter the column to VARCHAR(50) if needed
-- This will convert ENUM or shorter VARCHAR to VARCHAR(50)
ALTER TABLE kiosk_events
MODIFY COLUMN event_type VARCHAR(50) NOT NULL;

-- Step 3: Verify the change
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM
    INFORMATION_SCHEMA.COLUMNS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kiosk_events'
    AND COLUMN_NAME = 'event_type';

-- Step 4: Check for any problematic data
SELECT
    event_type,
    LENGTH(event_type) as length,
    COUNT(*) as count
FROM
    kiosk_events
GROUP BY
    event_type
ORDER BY
    length DESC;
