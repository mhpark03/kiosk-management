-- Check pending downloads for kiosk 1 (kioskid = '000000000001')
-- This script helps diagnose why downloads are stuck in PENDING status

-- 1. Find the kiosk ID
SELECT
    k.id as kiosk_db_id,
    k.kioskid,
    k.name,
    k.status,
    k.last_connection
FROM kiosks k
WHERE k.kioskid = '000000000001';

-- 2. Check all videos assigned to kiosk 1 with their download status
SELECT
    kv.id as assignment_id,
    kv.kiosk_id,
    kv.video_id,
    kv.download_status,
    kv.source_type,
    kv.menu_id,
    kv.display_order,
    kv.created_at,
    v.id as video_db_id,
    v.title,
    v.original_filename,
    v.media_type,
    v.file_size_bytes,
    v.s3_key,
    v.presigned_url,
    v.presigned_url_expires_at,
    CASE
        WHEN v.presigned_url_expires_at < NOW() THEN 'EXPIRED'
        WHEN v.presigned_url_expires_at > NOW() THEN 'VALID'
        ELSE 'NO_URL'
    END as url_status,
    TIMESTAMPDIFF(HOUR, kv.created_at, NOW()) as hours_since_assigned
FROM kiosk_videos kv
JOIN kiosks k ON kv.kiosk_id = k.id
JOIN videos v ON kv.video_id = v.id
WHERE k.kioskid = '000000000001'
ORDER BY kv.download_status, kv.created_at DESC;

-- 3. Show only PENDING downloads
SELECT
    kv.id as assignment_id,
    kv.video_id,
    kv.download_status,
    kv.created_at,
    v.title,
    v.original_filename,
    v.media_type,
    CASE
        WHEN v.presigned_url_expires_at < NOW() THEN 'URL_EXPIRED'
        WHEN v.presigned_url_expires_at > NOW() THEN 'URL_VALID'
        ELSE 'NO_URL'
    END as url_status,
    v.presigned_url_expires_at,
    TIMESTAMPDIFF(HOUR, kv.created_at, NOW()) as hours_pending
FROM kiosk_videos kv
JOIN kiosks k ON kv.kiosk_id = k.id
JOIN videos v ON kv.video_id = v.id
WHERE k.kioskid = '000000000001'
  AND kv.download_status = 'PENDING'
ORDER BY kv.created_at DESC;

-- 4. Check recent kiosk events to see if kiosk is connected
SELECT
    ke.event_type,
    ke.message,
    ke.created_at,
    ke.metadata
FROM kiosk_events ke
JOIN kiosks k ON ke.kiosk_id = k.id
WHERE k.kioskid = '000000000001'
ORDER BY ke.created_at DESC
LIMIT 20;

-- 5. Check if there are any recent DOWNLOAD_STARTED or DOWNLOAD_FAILED events
SELECT
    ke.event_type,
    ke.message,
    ke.created_at,
    ke.metadata
FROM kiosk_events ke
JOIN kiosks k ON ke.kiosk_id = k.id
WHERE k.kioskid = '000000000001'
  AND ke.event_type IN ('DOWNLOAD_STARTED', 'DOWNLOAD_COMPLETED', 'DOWNLOAD_FAILED', 'SYNC_STARTED', 'SYNC_COMPLETED')
ORDER BY ke.created_at DESC
LIMIT 20;
