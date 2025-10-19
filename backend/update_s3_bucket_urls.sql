-- Update S3 URLs from kiosk-video-bucket to kiosk-video-local-bucket
-- Run this script on your local database

-- First, check current URLs
SELECT
    id,
    filename,
    s3_key,
    s3_url,
    CASE
        WHEN s3_url LIKE '%kiosk-video-bucket%' THEN 'NEEDS UPDATE'
        ELSE 'OK'
    END as status
FROM videos;

-- Update the URLs
UPDATE videos
SET s3_url = REPLACE(s3_url, 'kiosk-video-bucket', 'kiosk-video-local-bucket')
WHERE s3_url LIKE '%kiosk-video-bucket%';

-- Verify the update
SELECT
    id,
    filename,
    s3_url,
    'UPDATED' as status
FROM videos
WHERE s3_url LIKE '%kiosk-video-local-bucket%';

-- Show summary
SELECT
    COUNT(*) as total_videos,
    SUM(CASE WHEN s3_url LIKE '%kiosk-video-local-bucket%' THEN 1 ELSE 0 END) as local_bucket_count,
    SUM(CASE WHEN s3_url LIKE '%kiosk-video-bucket%' AND s3_url NOT LIKE '%local%' THEN 1 ELSE 0 END) as remote_bucket_count
FROM videos;
