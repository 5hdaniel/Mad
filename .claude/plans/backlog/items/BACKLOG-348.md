# BACKLOG-348: Consolidate Field Allowlists (Single Source of Truth)

**Created**: 2026-01-21
**Priority**: Medium
**Category**: Architecture
**Status**: Pending

---

## Description

Field allowlists are maintained in two places, causing potential drift and confusion:
- `electron/services/db/transactionDbService.ts` - `allowedFields` array
- `electron/utils/sqlFieldWhitelist.ts` - centralized whitelist utility

## Source

SR Engineer review (2026-01-21): "started_at, closed_at, and closing_date were added to allowedFields in transactionDbService.ts, but the corresponding sqlFieldWhitelist.ts already had these fields. The duplication could cause confusion."

## Current State

```typescript
// transactionDbService.ts (lines 295-297)
const allowedFields = [..., 'started_at', 'closed_at', 'closing_deadline'];

// sqlFieldWhitelist.ts (lines 98-99)
TRANSACTION_UPDATE_FIELDS = [..., 'started_at', 'closed_at', ...];
```

## Expected State

- `sqlFieldWhitelist.ts` is the ONLY source of truth for allowed fields
- `transactionDbService.ts` imports and uses `validateFields()` from whitelist utility
- No inline `allowedFields` arrays in service files

## Acceptance Criteria

- [ ] Remove duplicate `allowedFields` from transactionDbService.ts
- [ ] Use `validateFields()` from sqlFieldWhitelist.ts
- [ ] Audit other services for similar duplication
- [ ] Single source of truth for all SQL field validation

## Priority

Medium - Prevents allowlist drift and simplifies maintenance
