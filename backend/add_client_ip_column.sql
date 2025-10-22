-- Add client_ip column to kiosk_events table
-- Run this SQL script if using spring.jpa.hibernate.ddl-auto=none or validate

ALTER TABLE kiosk_events ADD COLUMN client_ip VARCHAR(45);

COMMENT ON COLUMN kiosk_events.client_ip IS 'IP address of the client that triggered the event (supports IPv6)';
