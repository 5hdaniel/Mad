# TASK-1785: Fix Auto-Link Phone Pattern Matching on Windows

**Backlog ID:** BACKLOG-590
**Sprint:** SPRINT-068
**Phase:** Phase 1 - Critical Path
**Branch:** `sprint/SPRINT-068-windows-ios-contacts` (existing PR #716)
**Estimated Tokens:** ~25K

---

## Objective

Investigate and fix why auto-linking reports `messagesLinked: 0` on Windows even after the participants_flat fix. This is the core feature that allows text messages to automatically attach to transactions based on contact phone numbers.

---

## Context

During SPRINT-068 testing, even after fixing `participants_flat` population, the auto-link feature still reports zero messages linked on Windows. Debug logging was added but the root cause is not yet identified.

**Symptoms:**
- `messagesLinked: 0` in auto-link results
- Phone pattern matching appears to fail
- Works correctly on macOS

---

## Requirements

### Must Do:
1. Investigate phone number format in `participants_flat` column
2. Compare with contact phone number storage format
3. Check normalization logic between contacts and messages
4. Identify why the matching query returns no results
5. Implement fix to enable successful matching

### Must NOT Do:
- Break macOS functionality
- Change database schema (use existing columns)
- Skip investigation - understand root cause before fixing

---

## Acceptance Criteria

- [ ] Root cause documented
- [ ] Auto-linking returns `messagesLinked > 0` for valid matches
- [ ] Windows behavior matches macOS
- [ ] Existing tests pass
- [ ] No regressions on macOS

---

## Files to Investigate

- `electron/services/iPhoneSyncStorageService.ts` - participants_flat population
- Auto-linking service/query (find by searching for "autoLink" or "messagesLinked")
- Contact phone storage format
- Phone normalization utilities

## Files to Reference

- `electron/services/macOSMessagesImportService.ts` - working macOS implementation

---

## Testing Expectations

### Manual Testing (Primary)
1. Create a transaction with contact having phone number
2. Run iPhone sync on Windows
3. Trigger auto-link
4. Verify `messagesLinked > 0` in results

### Unit Tests
- **Required:** If normalization logic is changed, add tests
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Investigation Checklist

Before implementing a fix, document:

1. **Phone format in participants_flat:**
   - What format is being stored? (digits only? with country code?)
   - Example value from database

2. **Contact phone format:**
   - How are contact phones stored?
   - Example value from database

3. **Matching query:**
   - What query is used for matching?
   - Why does it return zero results?

4. **macOS comparison:**
   - How does macOS format differ?
   - Why does it work there?

---

## PR Preparation

- **Title:** `fix(windows): enable auto-link phone pattern matching`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**STATUS: COMPLETED**

*Completed: 2026-02-02*

### Results

- **Root Cause:** `participants_flat` was never being populated during iPhone sync. Additionally, 634K existing messages were missing this data entirely.
- **Before**: messagesLinked: 0
- **After**: messagesLinked: > 0 (verified working)
- **Actual Tokens**: Combined with other tasks in sprint

### Notes

**Investigation findings:**
1. The `participants_flat` column was not being set in `iPhoneSyncStorageService` during message persistence
2. Existing messages in the database had NULL `participants_flat` values
3. Solution was two-fold:
   - Fixed `iPhoneSyncStorageService` to populate `participants_flat` for new messages
   - Created Migration 27c to backfill 634K existing messages with `participants_flat` data
4. Also discovered contact lookup needed to be platform-aware - Windows needed to query `external_contacts` table instead of macOS-specific logic

---

## Guardrails

**STOP and ask PM if:**
- The root cause requires database schema changes
- The fix would break macOS functionality
- You need to modify shared normalization logic used by other features
