-- Check AI generated videos count
SELECT COUNT(*) as count, video_type
FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED')
GROUP BY video_type;

-- Show details of AI generated videos
SELECT id, title, video_type, media_type, original_filename, uploaded_at
FROM videos
WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED')
ORDER BY id;

-- Delete AI generated videos (uncomment to execute)
-- DELETE FROM videos WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED');

-- Verify deletion (uncomment after delete)
-- SELECT COUNT(*) as remaining FROM videos WHERE video_type IN ('RUNWAY_GENERATED', 'AI_GENERATED', 'VEO_GENERATED');
