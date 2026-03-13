# TASK-2160: Move transaction_limit and ai_detection to Plan Features

**Sprint:** SPRINT-127
**Backlog:** BACKLOG-930
**Phase:** Phase 2
**Branch:** `feature/task-2160-transaction-limit-ai-detection`
**Status:** In Progress
**Estimated Effort:** ~25K tokens

---

## Summary

Migrate `transaction_limit` and `ai_detection_enabled` reads from the `licenses` table to plan-feature-based checks via `useFeatureGate`. This is the final piece of SPRINT-127's Phase 2 feature consolidation, building on TASK-2159's LicenseContext bridge.

After this task, all feature access decisions flow through `useFeatureGate` / `check_feature_access`, and the license table columns (`transaction_limit`, `ai_detection_enabled`) become legacy fallbacks only.

## Prerequisites

- TASK-2159 merged (LicenseContext bridge for canExport/canSubmit/hasAIAddon is in place) -- PR #1132 MERGED
- TASK-2158 merged (feature definitions for `ai_detection` and `max_transactions` exist in DB) -- PR #1130 MERGED

---

## Scope

### 1. LicenseContext: transactionLimit from plan feature

**File:** `src/contexts/LicenseContext.tsx`

Currently `transactionLimit` is derived from `validationStatus?.transactionLimit` which reads from the `licenses.transaction_limit` column.

**Change:**
- Import and call `useFeatureGate()` in `LicenseProvider` (it may already be imported from TASK-2159 work -- check first)
- Derive `transactionLimit` from `features['max_transactions']?.value` (parse as integer) when available
- Fall back to `validationStatus?.transactionLimit` when feature gate value is not available
- Apply the same pattern to `canCreateTransaction`: compare `transactionCount` against the plan-feature-derived `transactionLimit`

**Important:** The `FeatureAccess.value` field is a string. For integer features like `max_transactions`, parse with `parseInt(value, 10)`. If parsing fails or value is empty, fall back to the license column value.

### 2. LicenseContext: hasAIAddon from plan feature

**File:** `src/contexts/LicenseContext.tsx`

Currently `hasAIAddon` is derived from `validationStatus.aiEnabled` which reads from `licenses.ai_detection_enabled`.

**Change:**
- Derive `hasAIAddon` from `useFeatureGate().isAllowed('ai_detection')` when feature gate has initialized
- Fall back to `validationStatus?.aiEnabled` when feature gate hasn't loaded
- Note: TASK-2159 already migrated `canAutoDetect` to use `useFeatureGate('ai_detection')` -- verify this is done and avoid duplication. The key change here is that the `hasAIAddon` STATE in LicenseProvider itself should reflect the plan feature, not just the computed `canAutoDetect` flag.

### 3. licenseService.ts (Electron main process): plan feature fallback

**File:** `electron/services/licenseService.ts`

The `calculateLicenseStatus()` function currently reads `transaction_limit` and `ai_detection_enabled` directly from the license record.

**Change:**
- In `calculateLicenseStatus()`, add a comment noting that these values are now legacy fallbacks -- the renderer reads from plan features via `useFeatureGate` first
- Do NOT remove the license column reads yet (that's Phase 3 / SPRINT-128)
- The licenseService continues to return these values for offline/fallback scenarios

### 4. Admin Portal: Remove ai_detection_enabled from EditLicenseDialog

**File:** `admin-portal/app/dashboard/users/[id]/components/EditLicenseDialog.tsx`

The dialog currently does NOT show an `ai_detection_enabled` toggle (confirmed by code review). However:
- The `transaction_limit` field IS shown in the dialog
- Add a helper text/note below the transaction_limit field: "Note: Transaction limits are now managed via Plan Features. This value is a legacy fallback."
- This is informational only -- do not remove the field (admins may still need to override individual license limits)

### 5. Admin Portal: Show feature source indicator on LicenseCard

**File:** `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx`

**Change:**
- Next to the "Transactions: X / Y" display, add a small badge or note indicating the source: "(plan)" if the org has a `max_transactions` plan feature, "(license)" otherwise
- This helps admins understand which system is providing the limit
- To determine source: the user detail page likely already fetches org data -- check if plan features are available in the page data. If not, this can be a simple static note: "Managed via Plan Features" with a link to the plan management page.

### 6. NOT in Scope

- Do NOT remove `transaction_limit` or `ai_detection_enabled` columns from the `licenses` table (Phase 3)
- Do NOT modify the `incrementTransactionCount` RPC (it still increments `licenses.transaction_count` -- the limit check happens client-side via feature gate)
- Do NOT modify `featureGateService.ts` in Electron (it's key-agnostic, already handles `max_transactions` and `ai_detection`)
- Do NOT modify broker-portal files
- No new Supabase migrations needed

---

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/LicenseContext.tsx` | Read transactionLimit from plan feature; read hasAIAddon from plan feature |
| `admin-portal/app/dashboard/users/[id]/components/EditLicenseDialog.tsx` | Add helper text for transaction_limit field |
| `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx` | Add feature source indicator for transaction display |
| Test files for LicenseContext | Update mocks to include feature gate values |

## Files NOT to Modify

- `electron/services/licenseService.ts` -- Add comments only (legacy fallback), no logic changes
- `electron/services/featureGateService.ts` -- Key-agnostic, no changes needed
- Supabase migrations -- No schema changes
- Broker portal files -- Not affected
- `src/hooks/useFeatureGate.ts` -- No changes needed

---

## Key Design Decisions

1. **Fallback strategy:** If `useFeatureGate` hasn't initialized or `max_transactions` feature doesn't exist, fall back to the license column value. This ensures backward compatibility during rollout.

2. **Integer parsing:** `FeatureAccess.value` is always a string. For `max_transactions`, parse as integer. Invalid/empty values fall back to license column.

3. **hasAIAddon deduplication:** TASK-2159 already migrated `canAutoDetect` to check `useFeatureGate('ai_detection')`. This task ensures the underlying `hasAIAddon` state also reflects the plan feature, so any consumer reading `hasAIAddon` directly (not just `canAutoDetect`) gets the correct value.

4. **Admin portal is informational only:** We're adding notes/badges to help admins understand the source of limits, but NOT removing edit functionality for the license fields (still needed as fallback).

---

## Testing Checklist

- [ ] `transactionLimit` in LicenseContext reads from `max_transactions` plan feature when available
- [ ] `transactionLimit` falls back to license column when plan feature is not available
- [ ] `hasAIAddon` reflects `ai_detection` plan feature status when feature gate has initialized
- [ ] `hasAIAddon` falls back to license `aiEnabled` when feature gate hasn't loaded
- [ ] `canCreateTransaction` correctly uses plan-feature-derived limit
- [ ] Admin EditLicenseDialog shows helper text on transaction_limit field
- [ ] Admin LicenseCard shows feature source indicator
- [ ] All existing LicenseContext tests pass (backward-compatible interface)
- [ ] App type-checks: `npm run type-check`
- [ ] App lint passes: `npm run lint`
- [ ] Admin portal type-checks: `cd admin-portal && npx tsc --noEmit`
- [ ] Admin portal builds: `cd admin-portal && npx next build`

---

## Acceptance Criteria

1. Transaction limit reads from plan feature first, license column second
2. AI detection reads from plan feature first, license column second
3. Backward compatibility maintained -- all existing consumers work unchanged
4. Admin portal surfaces where limits are sourced from
5. No regressions in existing tests

---

## Implementation Summary

### Changes Made

1. **`src/contexts/LicenseContext.tsx`** -- Core migration:
   - Imported `useFeatureGate` hook into `LicenseProvider`
   - `hasAIAddon` now reads from `featureIsAllowed("ai_detection")` when feature gate has initialized, with fallback to `state.hasAIAddon` (license column)
   - `transactionLimit` now reads from `planFeatures["max_transactions"]?.value` (parsed as int) when feature gate has initialized and value is valid, with fallback to `validationStatus?.transactionLimit`
   - `canCreateTransaction` now computed from plan-feature-derived `transactionLimit`
   - Updated `useMemo` dependency array to include `hasAIAddon`

2. **`admin-portal/.../EditLicenseDialog.tsx`** -- Added helper text below transaction_limit input noting it is now plan-managed (legacy fallback)

3. **`admin-portal/.../LicenseCard.tsx`** -- Added "(legacy)" indicator next to transaction count display with tooltip explaining plan feature management

4. **`electron/services/licenseService.ts`** -- Added SPRINT-127 comments marking `transaction_limit` and `ai_detection_enabled` reads as legacy fallbacks

5. **`tests/setup.js`** -- Added `featureGate` mock to global `window.api` (getAll, check, invalidateCache)

6. **`src/components/__tests__/StartNewAuditModal.test.tsx`** -- Added `useFeatureGate` mock to fix timing issue caused by the new async featureGate mock in setup.js

### Test Results
- 1689 tests pass, 2 pre-existing failures in `transaction-handlers.integration.test.ts` (unrelated)
- TypeScript type-check passes (main app + admin-portal)
- Zero regressions introduced

### Issues/Blockers: None

## Actual Effort

_To be filled by PM after merge._
