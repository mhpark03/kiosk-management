-- SQL Script to update entity_history table to support User activity tracking
-- Run this script in MySQL Workbench or any MySQL client

USE kioskdb;

-- Step 1: Update entity_type ENUM to include USER
ALTER TABLE entity_history
MODIFY COLUMN entity_type ENUM('KIOSK', 'STORE', 'USER') NOT NULL;

-- Step 2: Update action ENUM to include user-specific actions
ALTER TABLE entity_history
MODIFY COLUMN action ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATE_CHANGE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE') NOT NULL;

-- Verify the changes
SHOW COLUMNS FROM entity_history WHERE Field = 'entity_type' OR Field = 'action';

-- Display message
SELECT 'Database schema updated successfully!' AS Status;
