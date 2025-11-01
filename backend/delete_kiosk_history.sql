-- Deletion script: Remove kiosk_history table and data
-- This script deletes all data from kiosk_history table without migration
-- Run this script after confirming all new events are being recorded in kiosk_events

-- Step 1: Show current record counts before deletion
SELECT
    'kiosk_history' AS table_name,
    COUNT(*) AS record_count
FROM kiosk_history
UNION ALL
SELECT
    'kiosk_events' AS table_name,
    COUNT(*) AS record_count
FROM kiosk_events;

-- Step 2: Truncate kiosk_history table (removes all data)
TRUNCATE TABLE kiosk_history;

-- Step 3: Verify deletion
SELECT
    'kiosk_history (after truncate)' AS table_name,
    COUNT(*) AS record_count
FROM kiosk_history;

-- Step 4: Optional - Drop kiosk_history table completely
-- WARNING: This is irreversible! Only run after confirming the system works correctly with kiosk_events
-- DROP TABLE kiosk_history;
