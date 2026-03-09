# BACKLOG-912: Zero Test Coverage for Impersonation Feature

## Status: Pending | Priority: Low | Area: service

## Summary

The entire impersonation feature (Sprint 116) shipped with zero automated test coverage. There are no unit tests for the impersonation guards, cookie handling, or provider; no integration tests for the RPCs; and no e2e tests for the impersonation flow.

## Current Behavior

- No tests for `impersonation-guards.ts` helper functions
- No tests for cookie signing/parsing (once TASK-2131 adds signing)
- No tests for `ImpersonationProvider` React component
- No tests for impersonation RPCs (`admin_start_impersonation`, `admin_validate_impersonation_token`)
- No e2e tests for the full impersonation flow

## Expected Behavior

- Unit tests for all guard functions (blockWriteDuringImpersonation, getDataClient, etc.)
- Unit tests for cookie handling (sign, verify, parse, reject tampered)
- Component tests for ImpersonationProvider (timer, end session, context values)
- Integration tests for RPCs (start, validate, end, status checks)
- At minimum, happy-path e2e test for the full flow

## Files to Change

- New test files throughout broker-portal

## Source

SR Engineer code review of Sprint 116 (Finding 16, 2026-03-07)
