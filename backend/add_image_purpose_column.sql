-- Migration script to add image_purpose column to videos table
-- This column categorizes images by their intended usage:
-- - GENERAL: General purpose images
-- - REFERENCE: Reference images for video generation (Runway, Veo)
-- - MENU: Coffee kiosk menu product images

-- Step 1: Add the image_purpose column with default value
ALTER TABLE videos
ADD COLUMN image_purpose VARCHAR(20) DEFAULT 'GENERAL';

-- Step 2: Update existing AI-generated images to REFERENCE
-- These are typically used for video generation
UPDATE videos
SET image_purpose = 'REFERENCE'
WHERE media_type = 'IMAGE'
  AND video_type = 'AI_GENERATED';

-- Step 3: Verify the migration
SELECT
    image_purpose,
    media_type,
    video_type,
    COUNT(*) as count
FROM videos
GROUP BY image_purpose, media_type, video_type
ORDER BY image_purpose, media_type, video_type;

-- Expected results after migration:
-- - All existing uploaded images: GENERAL
-- - AI-generated images: REFERENCE
-- - New uploads will use purpose specified in application code

COMMIT;
