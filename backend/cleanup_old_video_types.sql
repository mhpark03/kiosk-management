-- ================================================================
-- Clean up old video_type enum values from database
-- ================================================================
-- This script removes videos with RUNWAY_GENERATED and VEO_GENERATED types
-- which have been unified to AI_GENERATED type in the current system.
--
-- IMPORTANT: AI_GENERATED is NOT deleted - it's the current type in use!
--
-- Usage:
--   mysql -h <host> -u <user> -p kioskdb < cleanup_old_video_types.sql
-- ================================================================

-- Step 1: Check current state
SELECT
    '=== Current Video Types ===' as '';

SELECT
    video_type,
    COUNT(*) as count,
    ROUND(SUM(file_size) / 1024 / 1024, 2) as total_size_mb
FROM videos
GROUP BY video_type;

-- Step 2: Check old enum values
SELECT
    '' as '',
    '=== Old Enum Values to Delete ===' as '';

SELECT
    id,
    title,
    video_type,
    media_type,
    original_filename,
    DATE_FORMAT(uploaded_at, '%Y-%m-%d %H:%i:%s') as uploaded_at
FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
ORDER BY id;

-- Step 3: Count old enum values
SELECT
    video_type,
    COUNT(*) as count
FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'VEO_GENERATED')
GROUP BY video_type;

-- Step 4: Delete old enum values
-- UNCOMMENT the following lines to perform the actual deletion:
-- DELETE FROM videos WHERE video_type = 'RUNWAY_GENERATED';
-- DELETE FROM videos WHERE video_type = 'VEO_GENERATED';

-- Step 5: Verify deletion (run after uncommenting above)
-- SELECT
--     '=== After Deletion ===' as '';
--
-- SELECT
--     video_type,
--     COUNT(*) as count
-- FROM videos
-- GROUP BY video_type;

-- ================================================================
-- MANUAL DELETION COMMANDS (safer - shows what will be deleted)
-- ================================================================
-- Run these one by one after reviewing the output:

-- 1. Check what will be deleted:
-- SELECT * FROM videos WHERE video_type = 'RUNWAY_GENERATED';
-- SELECT * FROM videos WHERE video_type = 'VEO_GENERATED';

-- 2. Delete RUNWAY_GENERATED videos:
-- DELETE FROM videos WHERE video_type = 'RUNWAY_GENERATED';

-- 3. Delete VEO_GENERATED videos:
-- DELETE FROM videos WHERE video_type = 'VEO_GENERATED';

-- 4. Verify cleanup:
-- SELECT video_type, COUNT(*) FROM videos GROUP BY video_type;
