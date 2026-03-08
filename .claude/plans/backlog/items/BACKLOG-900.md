# BACKLOG-900: End Session Route Trusts Cookie Data for Audit Log

## Status: Pending | Priority: High | Area: security

## Summary

The end-session route (`/api/impersonation/end`) reads `admin_user_id` and `target_user_id` from the unsigned cookie and writes those values directly to `admin_audit_logs` via the service-role client. An attacker who can forge the cookie could insert false audit entries attributing impersonation actions to arbitrary admin users or targeting arbitrary users.

## Current Behavior

- End route reads admin_user_id/target_user_id from unsigned cookie
- Writes those values directly to admin_audit_logs via service role
- No validation that the cookie values match the actual DB session record

## Expected Behavior

- End route validates session_id against DB before writing audit log
- Uses DB record values (not cookie values) for admin_user_id and target_user_id in audit log
- Invalid or tampered session_id results in error, not false audit entry

## Resolution Path

This will be addressed by existing SPRINT-118 tasks:
- **TASK-2131** (cookie signing) makes the cookie tamper-proof via HMAC-SHA256
- **TASK-2133** (DB validation) ensures all routes validate session against DB and use DB values

No separate task needed -- these two tasks together eliminate the attack vector.

## Files to Change

- `broker-portal/app/api/impersonation/end/route.ts`

## Source

SR Engineer code review of Sprint 116 (Finding 3, 2026-03-07)
