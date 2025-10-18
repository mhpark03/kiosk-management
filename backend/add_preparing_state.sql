-- Add PREPARING state to kiosks table
USE kioskdb;

-- Check current column definition
SHOW CREATE TABLE kiosks;

-- Alter the state column to change from ENUM to VARCHAR if needed
-- Or add PREPARING to the ENUM values
ALTER TABLE kiosks MODIFY COLUMN state VARCHAR(20) NOT NULL;

-- Verify the change
DESCRIBE kiosks;
