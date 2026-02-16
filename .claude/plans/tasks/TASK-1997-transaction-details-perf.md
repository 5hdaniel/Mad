# TASK-1997: Fix UI Freeze When Opening Transaction Details

**Backlog:** BACKLOG-705
**Sprint:** SPRINT-083
**Status:** Pending
**Priority:** High
**Category:** fix (performance)
**Estimated Tokens:** ~30K

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Summary

Opening a transaction's details page causes a 2-3 second UI freeze. Investigation has identified 4 root causes, all related to N+1 query patterns and unnecessary bulk fetches in the contact resolution flow.

---

## Root Causes (From Investigation)

### Root Cause 1: N+1 Subqueries in Contact Fetch
The `getTransactionContacts()` function in `transactionContactDbService.ts` uses correlated subqueries to fetch email and phone data for each contact. For a transaction with 10 contacts, this generates 20+ subqueries.

**Fix:** Replace correlated subqueries with JOINs and `json_group_array` aggregations.

### Root Cause 2: Fetching ALL Contacts for Suggested Contacts
The `useTransactionDetails` hook fetches ALL contacts from the database to resolve "suggested contacts" for empty roles. For a database with 5000+ contacts, this is a massive unnecessary query.

**Fix:** Create a `contacts:get-by-ids` IPC handler that accepts a list of contact IDs and returns only those contacts. Use this for suggested contact resolution instead of fetching all.

### Root Cause 3: Multiple Hook Re-renders on Mount
Several hooks in the transaction details module fire sequentially on mount, each triggering a re-render that cascades into re-fetches.

**Fix:** Consolidate data fetching into fewer hooks or use `useMemo`/`useCallback` to prevent unnecessary re-renders.

### Root Cause 4: Sync Handler Rewrite Side Effects
The recent sync handler changes in SPRINT-083 may have introduced additional fetches during mount when sync state is being checked.

**Fix:** Investigate whether sync status checks trigger unnecessary re-renders and gate them appropriately.

---

## Files to Change

| File | Change |
|------|--------|
| `electron/services/db/transactionContactDbService.ts` | Replace N+1 subqueries with JOINs |
| `src/components/transactionDetailsModule/hooks/useTransactionDetails.ts` | Remove bulk contact fetch, use targeted query |
| `electron/contact-handlers.ts` | Add `contacts:get-by-ids` IPC handler |
| `electron/preload/contactBridge.ts` | Add `getContactsByIds` bridge method |
| `electron/services/db/contactDbService.ts` | Add `getContactsByIds` DB method |

---

## Acceptance Criteria

- [ ] Transaction details page opens in under 500ms (no perceptible freeze)
- [ ] No N+1 subqueries in `getTransactionContacts`
- [ ] Suggested contacts resolved via targeted query, not ALL contacts fetch
- [ ] No regressions in transaction details display
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Testing Requirements

### Performance Testing (Manual)
- [ ] Open a transaction with 5+ contacts -- verify no freeze
- [ ] Open a transaction with 10+ contacts -- verify no freeze
- [ ] Measure render time before/after fix

### Unit Tests
- [ ] `getTransactionContacts` returns correct data with JOIN-based query
- [ ] `contacts:get-by-ids` returns correct subset of contacts
- [ ] Empty IDs array returns empty result (not error)

### CI Gates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Implementation Summary

_To be filled by Engineer after implementation._

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Branch** | |
| **PR** | |
| **Files Changed** | |
| **Tests Added** | |
| **Issues/Blockers** | |
