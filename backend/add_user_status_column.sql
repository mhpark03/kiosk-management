-- SQL Script to add status column to users table and update entity_history action enum
-- Run this script in MySQL Workbench or any MySQL client

USE kioskdb;

-- Step 1: Add status column to users table
ALTER TABLE users
ADD COLUMN status ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE' AFTER memo;

-- Step 2: Update action ENUM to include user management actions
ALTER TABLE entity_history
MODIFY COLUMN action ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATE_CHANGE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'SUSPEND', 'ACTIVATE') NOT NULL;

-- Verify the changes
SHOW COLUMNS FROM users WHERE Field = 'status';
SHOW COLUMNS FROM entity_history WHERE Field = 'action';

-- Display message
SELECT 'Database schema updated successfully for user management!' AS Status;
