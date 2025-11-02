-- Add KIOSK_CONNECTED to the event_type enum
-- This SQL adds the new KIOSK_CONNECTED event type to the kiosk_events table

USE kiosk_management;

-- Check current column type
SHOW COLUMNS FROM kiosk_events LIKE 'event_type';

-- Modify the column to VARCHAR if it's currently ENUM
-- VARCHAR is more flexible and matches the JPA @Enumerated(EnumType.STRING) annotation
ALTER TABLE kiosk_events MODIFY COLUMN event_type VARCHAR(50) NOT NULL;

-- Verify the change
SHOW COLUMNS FROM kiosk_events LIKE 'event_type';
