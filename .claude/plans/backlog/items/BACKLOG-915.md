# BACKLOG-915: raw_user_meta_data Field Name May Vary Across Supabase Versions

## Status: Pending | Priority: Low | Area: schema

## Summary

The impersonation migration references `raw_user_meta_data` from `auth.users`, but the field name has varied across Supabase versions (`raw_user_meta_data` vs `raw_user_metadata`). If Supabase updates the column name, the RPC would silently fail or return null metadata.

## Current Behavior

- Migration hardcodes `raw_user_meta_data` column name
- No fallback or version detection
- Could break silently on Supabase version upgrade

## Expected Behavior

- Verify correct column name for current Supabase version
- Add fallback: try both column names with COALESCE or check information_schema
- Document which Supabase version the migration targets

## Files to Change

- `supabase/migrations/20260307_impersonation_sessions.sql` -- add column name verification/fallback

## Source

SR Engineer code review of Sprint 116 (Finding 19, 2026-03-07)
