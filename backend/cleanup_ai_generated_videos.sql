-- Clean up AI-generated videos from database
-- This removes videos with RUNWAY_GENERATED and VEO_GENERATED types
-- which are no longer supported in the application

-- Delete videos with RUNWAY_GENERATED type
DELETE FROM videos WHERE video_type = 'RUNWAY_GENERATED';

-- Delete videos with VEO_GENERATED type
DELETE FROM videos WHERE video_type = 'VEO_GENERATED';

-- Verify remaining video types
SELECT video_type, COUNT(*) as count
FROM videos
GROUP BY video_type;
