# TASK-2027: Consolidate Duplicate Contact Resolution Methods & Fix Export normalizePhone Bug

| Field            | Value                                      |
|------------------|--------------------------------------------|
| **Sprint**       | SPRINT-089                                 |
| **Backlog Item** | BACKLOG-755, BACKLOG-756                   |
| **Type**         | Bug Fix + Refactor                         |
| **Priority**     | High                                       |
| **Status**       | In Progress                                |
| **Phase**        | 8                                          |
| **Estimated Tokens** | ~50K                                  |
| **Actual Tokens**    | -                                      |
| **Execution**    | Sequential (depends on Phase 7 TASK-2026)  |
| **Risk**         | Medium                                     |

---

## Problem Statement

TASK-2026 created a shared `contactResolutionService.ts` in `electron/services/`, but the export service and UI renderer still retain private copies of the same methods. More critically, the export services have a **bug**: the main-process `normalizePhone()` strips all non-digits, so email handles like `madisonsola@gmail.com` become empty strings `""`. This causes:

- **Duplicate conversation PDFs** in exports (phone thread + email thread not merged)
- **Unresolved email participants** in exported group chats
- **11 vulnerable call sites** across `folderExportService.ts` (6) and `pdfExportService.ts` (5)

**User-verified:** Exported the Madison transaction — export produces two separate PDFs for her phone and email threads, confirming the UI (fixed in TASK-2026) is now correct but the export is still broken.

**Three phases, all in this task:**

1. **Phase 1:** Extract renderer-side phone normalization utilities into a shared module
2. **Phase 2:** Delegate export service private methods to the shared contactResolutionService
3. **Phase 3:** Fix `normalizePhone()` in the shared service to handle email handles (use renderer's `normalizePhoneForLookup` as the correct reference), and fix all 11 vulnerable call sites in `folderExportService.ts` and `pdfExportService.ts`

## Branch Information

**Branch From:** develop (after Phase 7 TASK-2026 PR #906 merged)
**Branch Into:** develop
**Branch Name:** fix/task-2027-consolidate-contact-resolution

---

## Implementation Plan

### Phase 1: Extract Renderer-Side Utilities

**Goal:** Create `src/utils/phoneNormalization.ts` with three pure functions currently duplicated across renderer components.

#### 1a. Create `src/utils/phoneNormalization.ts`

Extract these functions:

| Function | Current Location(s) | Line Ref |
|----------|---------------------|----------|
| `normalizePhoneForLookup()` | `MessageThreadCard.tsx:209`, `ConversationViewModal.tsx:44` | Duplicated identically |
| `getSenderPhone()` | `MessageThreadCard.tsx:183`, `ConversationViewModal.tsx:54` | Duplicated identically |
| `extractAllHandles()` | `TransactionMessagesTab.tsx:110` | Near-duplicate of `contactResolutionService.extractParticipantHandles` |

All three are pure functions with no side effects -- safe to extract without architectural changes.

#### 1b. Update Consuming Components

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Remove local `normalizePhoneForLookup()` and `getSenderPhone()`, import from `src/utils/phoneNormalization` |
| `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` | Remove local `normalizePhoneForLookup()` and `getSenderPhone()`, import from `src/utils/phoneNormalization` |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Remove local `extractAllHandles()`, import from `src/utils/phoneNormalization` |

**Expected result:** 4 files touched (1 new, 3 modified), ~50 lines of duplication removed.

### Phase 2: Delegate Export Service to Shared Service

**Goal:** Replace private methods in `folderExportService.ts` with calls to the shared `contactResolutionService.ts`, removing ~160 lines of duplicated logic.

#### 2a. Replace Method Calls

| Private Method | Call Sites | Replacement |
|----------------|-----------|-------------|
| `this.normalizePhone()` | 6 call sites | Import shared `normalizePhone()` (already aliased as `sharedNormalizePhone` in imports) |
| `this.extractAllPhones()` | 2 call sites | Import shared `extractParticipantHandles()` from contactResolutionService |
| `this.getGroupChatParticipants()` | 1 call site | Import shared `resolveGroupChatParticipants()` + return type adapter |

#### 2b. Delete Private Methods

Remove these private methods from `folderExportService.ts`:

| Method to Delete | Reason |
|-----------------|--------|
| `normalizePhone()` | Replaced by shared `normalizePhone()` |
| `extractAllPhones()` | Replaced by shared `extractParticipantHandles()` |
| `getGroupChatParticipants()` | Replaced by shared `resolveGroupChatParticipants()` |
| `getContactNamesByPhonesAsync()` | Replaced by shared `resolvePhoneNames()` |

#### 2c. KEEP (Do Not Delete)

| Method | Reason |
|--------|--------|
| `getContactNamesByPhones()` (sync version) | Legitimate fallback for PDF generation -- sync context cannot await async shared service |

**Expected result:** 1 file modified, ~160 lines of dead code removed.

### Phase 3: Fix normalizePhone Email Handle Bug

**Goal:** Update the shared `normalizePhone()` in `contactResolutionService.ts` to handle email handles correctly, and fix all 11 vulnerable call sites in the export services.

#### 3a. Replace Shared `normalizePhone()` with the Renderer's Correct Version

The renderer's `normalizePhoneForLookup` already handles emails correctly. The main-process `normalizePhone` in `contactResolutionService.ts` is broken (strips emails to empty strings). Simply replace it with the renderer's working version:

```typescript
// BROKEN (current main-process):
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// CORRECT (renderer's version — use this):
function normalizePhone(phone: string): string {
  if (phone.includes("@")) return phone.toLowerCase();
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
```

No new logic needed — just adopt the version that already works.

#### 3b. Fix Vulnerable Call Sites

**`folderExportService.ts` — 6 vulnerable sites (after Phase 2 these will use the shared version automatically):**
- `getThreadKey()` lines 1177, 1181 — participant from/to passed without email filter
- `getThreadContact()` lines 1222, 1234 — phone/sender passed without email filter
- `getGroupChatParticipants()` line 1397 — phone normalized before type check
- `formatThreadMessage()` line 1692 — sender normalized without email filter

**`pdfExportService.ts` — 5 vulnerable sites (must also delegate or add guards):**
- `getThreadKey()` lines 679, 682 — same pattern as folderExportService
- `getThreadContact()` lines 714, 725 — same pattern
- `formatThreadMessage()` line 937 — sender normalized without email filter

#### 3c. Verify Export Thread Merging

After fixing normalizePhone, the export should merge Madison's phone and email threads into one conversation PDF, matching the UI behavior.

**Safe call sites (no changes needed):**
- `contactResolutionService.ts` lines 125, 447 — already guarded by phone type check
- `threadMergeUtils.ts` lines 96, 98, 139, 169 — already guarded by `isPhoneNumber()`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/phoneNormalization.ts` | Shared renderer-side phone/handle normalization utilities |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Remove local functions, import from phoneNormalization |
| `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` | Remove local functions, import from phoneNormalization |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Remove local extractAllHandles, import from phoneNormalization |
| `electron/services/folderExportService.ts` | Delete 4 private methods, delegate to shared contactResolutionService |
| `electron/services/pdfExportService.ts` | Fix 5 vulnerable normalizePhone call sites — delegate to shared service or add email guards |
| `electron/services/contactResolutionService.ts` | Update normalizePhone to handle email handles (match renderer behavior) |

---

## Acceptance Criteria

- [ ] `src/utils/phoneNormalization.ts` exists with `normalizePhoneForLookup()`, `getSenderPhone()`, `extractAllHandles()`
- [ ] No duplicate `normalizePhoneForLookup()` or `getSenderPhone()` in MessageThreadCard.tsx or ConversationViewModal.tsx
- [ ] No duplicate `extractAllHandles()` in TransactionMessagesTab.tsx
- [ ] `folderExportService.ts` delegates `normalizePhone`, `extractAllPhones`, `getGroupChatParticipants`, `getContactNamesByPhonesAsync` to shared service
- [ ] `getContactNamesByPhones()` (sync) is preserved in folderExportService
- [ ] No regression in group chat participant display (TASK-2026 fixes preserved)
- [ ] No regression in export output
- [ ] Type-check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)

## Testing Requirements

| Type | Requirement |
|------|-------------|
| **Unit** | Existing tests for contactResolutionService still pass |
| **Unit** | Existing tests for folderExportService still pass |
| **Regression** | All 507+ existing tests pass |
| **Manual** | Group chat still shows all participants correctly |
| **Manual** | Export produces identical output to pre-refactor |
| **Manual** | 1:1 chats and thread merge unaffected |

---

## Estimated Effort

| Category | Estimate |
|----------|----------|
| Phase 1: Extract renderer utils | ~10K |
| Phase 2: Delegate export service | ~12K |
| Phase 3: Fix normalizePhone + pdfExportService | ~15K |
| Testing + verification | ~5K |
| SR Review | ~8K |
| **Total** | **~50K** |

**Soft Cap:** ~200K (4x estimate -- PM will check at this threshold)

---

## Dependencies

- **TASK-2026 (Phase 7):** Must be merged first. Creates the shared `contactResolutionService.ts` that Phase 2 delegates to. PR #906 merged.
- **TASK-2024 (Phase 5):** Must be merged first. Introduces `isTextMessage()` helper. PR #904 merged.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Export regression from method delegation | High | Low | Run export tests; compare output before/after on real transaction |
| Return type mismatch between shared and private methods | Medium | Medium | Adapter pattern for resolveGroupChatParticipants return type |
| Renderer import path wrong (Vite vs Electron) | Low | Low | phoneNormalization.ts is in src/utils, fully in renderer scope |
| Sync getContactNamesByPhones accidentally deleted | High | Low | Explicitly marked KEEP in plan; acceptance criteria checks for it |

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | (auto-captured) |
| **Files Changed** | 7 (1 created, 6 modified) |
| **Tests Added** | 0 (existing 440 tests pass, no new logic added) |
| **PR** | TBD |
| **Branch** | fix/task-2027-consolidate-contact-resolution |
| **Merged** | - |

### Changes Made

**Phase 1: Extract renderer-side utilities**
- Created `src/utils/phoneNormalization.ts` with `normalizePhoneForLookup()`, `getSenderPhone()`, `extractAllHandles()`
- Removed local copies from `MessageThreadCard.tsx`, `ConversationViewModal.tsx`, `TransactionMessagesTab.tsx`
- ~50 lines of duplication removed from renderer components

**Phase 2: Delegate export service to shared service**
- Replaced 6 `this.normalizePhone()` calls with `sharedNormalizePhone()` in `folderExportService.ts`
- Replaced `this.extractAllPhones()` calls with `extractParticipantHandles()` from shared service
- Replaced `this.getGroupChatParticipants()` with `sharedResolveGroupChatParticipants()` + adapter
- Deleted 4 private methods: `normalizePhone`, `extractAllPhones`, `getGroupChatParticipants`, `getContactNamesByPhonesAsync`
- Kept `getContactNamesByPhones` (sync version) as legitimate fallback for PDF generation
- Removed unused `getContactNames` import
- ~160 lines of dead code removed

**Phase 3: Fix normalizePhone email handle bug**
- Replaced broken `normalizePhone()` in `contactResolutionService.ts` with correct version that preserves email handles
- Fixed `pdfExportService.ts`: replaced local `normalizePhone` closure with shared version
- Fixed `pdfExportService._isGroupChat()`: replaced inline `.replace(/\D/g, '').slice(-10)` with `sharedNormalizePhone()`
- All 11 vulnerable call sites now use the corrected version

**Bug Fix:** `normalizePhone("madisonsola@gmail.com")` now returns `"madisonsola@gmail.com"` instead of `""` (empty string)

### Deviations
None. Implementation followed the task plan exactly.

### Issues/Blockers
None.
