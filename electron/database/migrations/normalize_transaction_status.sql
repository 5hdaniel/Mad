-- Migration: normalize_transaction_status.sql
-- Purpose: Normalize legacy transaction status values to canonical values
--
-- This migration ensures all existing status values conform to the
-- TransactionStatus enum: 'pending', 'active', 'closed', 'rejected'
--
-- Status Value Mapping:
-- Legacy Value    ->  Canonical Value
-- -----------------------------------------
-- "completed"     ->  "closed"
-- "open"          ->  "active"
-- null/undefined  ->  "active"
-- ""              ->  "active"
-- "cancelled"     ->  "closed"
-- "archived"      ->  "closed"
--
-- Note: The schema.sql has CHECK (status IN ('pending', 'active', 'closed', 'rejected'))
-- This migration fixes existing data that predates the constraint.

-- Step 1: Normalize 'completed' to 'closed'
UPDATE transactions SET status = 'closed' WHERE status = 'completed';

-- Step 2: Normalize 'open' to 'active'
UPDATE transactions SET status = 'active' WHERE status = 'open';

-- Step 3: Normalize null or empty to 'active'
UPDATE transactions SET status = 'active' WHERE status IS NULL OR status = '';

-- Step 4: Normalize 'cancelled' to 'closed'
UPDATE transactions SET status = 'closed' WHERE status = 'cancelled';

-- Step 5: Normalize 'archived' to 'closed' (archived was a legacy status)
UPDATE transactions SET status = 'closed' WHERE status = 'archived';

-- Verification query (run manually to verify):
-- SELECT DISTINCT status, COUNT(*) as count FROM transactions GROUP BY status;
-- Should only show: pending, active, closed, rejected
