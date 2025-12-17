-- Migration: Add LLM Platform Allowance Fields
-- Purpose: Enable admin-managed LLM token budgets per user
-- Date: 2025-12-17
-- Task: TASK-304

-- Add LLM allowance fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_monthly_allowance INTEGER DEFAULT 50000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_allowance_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_allowance_reset_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN users.llm_monthly_allowance IS 'Admin-set monthly token budget for LLM features (default 50K tokens)';
COMMENT ON COLUMN users.llm_allowance_used IS 'Tokens used against platform allowance this month';
COMMENT ON COLUMN users.llm_allowance_reset_date IS 'Date when allowance was last reset';

-- Create function to reset allowance monthly (optional - can be cron job)
CREATE OR REPLACE FUNCTION reset_llm_allowance_if_needed()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset if it's a new month since last reset
  IF NEW.llm_allowance_reset_date IS NULL OR
     DATE_TRUNC('month', NEW.llm_allowance_reset_date) < DATE_TRUNC('month', CURRENT_DATE) THEN
    NEW.llm_allowance_used := 0;
    NEW.llm_allowance_reset_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger creation is optional, can be handled in application code
-- Uncomment below if you want automatic reset on user update:
-- CREATE TRIGGER reset_llm_allowance_trigger
-- BEFORE UPDATE ON users
-- FOR EACH ROW
-- EXECUTE FUNCTION reset_llm_allowance_if_needed();

-- ============================================================
-- Manual Application Steps (for Supabase Dashboard):
-- ============================================================
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy this entire SQL file content
-- 3. Execute the SQL
-- 4. Verify columns added with:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'llm%';
-- ============================================================
