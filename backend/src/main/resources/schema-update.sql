-- Update video_type and media_type columns to support new enum values
ALTER TABLE videos MODIFY COLUMN video_type VARCHAR(20) NOT NULL;
ALTER TABLE videos MODIFY COLUMN media_type VARCHAR(20) NOT NULL;
