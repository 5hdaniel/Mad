-- Migration: normalize_transaction_status.sql
-- Purpose: Normalize legacy transaction status values to canonical values
--
-- This migration ensures all existing status values conform to the
-- TransactionStatus enum: 'active', 'closed', 'archived'
--
-- Status Value Mapping:
-- Legacy Value    ->  Canonical Value
-- -----------------------------------------
-- "completed"     ->  "closed"
-- "pending"       ->  "active"
-- "open"          ->  "active"
-- null/undefined  ->  "active"
-- ""              ->  "active"
-- "cancelled"     ->  "archived"
--
-- Note: The schema.sql already has CHECK (status IN ('active', 'closed', 'archived'))
-- This migration fixes existing data that predates the constraint.

-- Step 1: Normalize 'completed' to 'closed'
UPDATE transactions SET status = 'closed' WHERE status = 'completed';

-- Step 2: Normalize 'pending' to 'active'
UPDATE transactions SET status = 'active' WHERE status = 'pending';

-- Step 3: Normalize 'open' to 'active'
UPDATE transactions SET status = 'active' WHERE status = 'open';

-- Step 4: Normalize null or empty to 'active'
UPDATE transactions SET status = 'active' WHERE status IS NULL OR status = '';

-- Step 5: Normalize 'cancelled' to 'archived'
UPDATE transactions SET status = 'archived' WHERE status = 'cancelled';

-- Verification query (run manually to verify):
-- SELECT DISTINCT status, COUNT(*) as count FROM transactions GROUP BY status;
-- Should only show: active, closed, archived
