# SPRINT-098: Email Sync Consolidation

- Created: 2026-02-23
- Status: Planned
- Base: develop (with SPRINT-095/096/097 merged)
- Ref: BACKLOG-786

## Context

The email fetching/sync code has grown organically across 5 different scenarios, resulting in a 1,539-line handler monolith (`emailSyncHandlers.ts`), fragmented date-range logic, 4 confusing lookback settings, and a gap where manual-attach searches don't cache results locally. TASK-2060 (Sprint 096) made good progress by extracting `fetchStoreAndDedup()` and adding audit-period date filtering, but the full consolidation remains.

## Sprint Goal

Consolidate all email fetch/sync paths into a clean, unified service architecture with consistent date-range handling and local caching.

## In-Scope

| ID | Title | Batch | Est Tokens | Actual | PR | Status |
|----|-------|-------|-----------|--------|-----|--------|
| TASK-2065 | Split emailSyncHandlers.ts into domain handler files | 1 (parallel) | ~30K | | | Pending |
| TASK-2066 | Extract EmailSyncService with unified orchestration | 2 (sequential) | ~50K | | | Pending |
| TASK-2067 | Make manual-attach search store emails locally | 3 (parallel) | ~40K | | | Pending |
| TASK-2068 | Unify date-range calculation | 1 (parallel) | ~35K | | | Pending |
| TASK-2069 | Consolidate lookback settings to 2 | 3 (parallel) | ~25K | | | Pending |

**Total Estimated:** ~180K (engineering) + ~50K (SR review) = ~230K

## Out of Scope

- Full sync orchestrator unification (BACKLOG-801) -- routing all sync through SyncOrchestratorService
- UI changes -- no changes to sync buttons, progress indicators, or settings pages
- Message import lookback -- `messageImport.filters.lookbackMonths` is iMessage-specific, works correctly
- Transaction scan refactoring -- `transactionService.scanAndExtractTransactions()` has its own logic
- Provider fetch service refactoring -- `outlookFetchService.ts` / `gmailFetchService.ts` are large but functional

---

## Task Details

### TASK-2065: Split emailSyncHandlers.ts into domain handler files

**Goal:** Break the 1,539-line monolith into 3 focused files.

**Extract into new files:**
- `electron/handlers/emailLinkingHandlers.ts` -- 7 handlers: `get-unlinked-messages`, `get-unlinked-emails`, `link-emails`, `get-message-contacts`, `get-messages-by-contact`, `link-messages`, `unlink-messages` (~550 lines)
- `electron/handlers/emailAutoLinkHandlers.ts` -- 2 handlers: `auto-link-texts`, `resync-auto-link` (~160 lines)

**Remaining in emailSyncHandlers.ts:** scan handlers (2) + sync handler (1) + shared helpers + constants (~700 lines)

**Also modify:** `electron/transaction-handlers.ts` -- add `registerEmailLinkingHandlers()` and `registerEmailAutoLinkHandlers()`

**Rules:** No IPC channel name changes, no logic changes, no moving helpers yet.

---

### TASK-2066: Extract EmailSyncService with unified orchestration

**Goal:** Move the 460-line sync orchestration logic from handler into a proper service.

**New file:** `electron/services/emailSyncService.ts`

**Service API:**
```typescript
class EmailSyncService {
  async syncTransactionEmails(params: {
    transactionId: string;
    userId: string;
    contactAssignments: ContactAssignment[];
    contactEmails: string[];
    transactionDetails: TransactionDetails;
  }): Promise<SyncResult>
}
```

**What moves:** `fetchStoreAndDedup()`, `computeEmailFetchSinceDate()`, provider fetch orchestration (Outlook inbox/sent/all-folders + Gmail search/all-labels), auto-link loop, constants (`EMAIL_FETCH_SAFETY_CAP`, `SENT_ITEMS_SAFETY_CAP`), network resilience wrapping.

**Handler becomes:** thin wrapper (~80 lines) -- input validation, rate limiting, delegate to service.

**Also update:** `electron/handlers/__tests__/emailSyncHelpers.test.ts` -- point imports at new service location.

---

### TASK-2067: Make manual-attach search store emails locally

**Goal:** Fix the gap where manual-attach fetches emails from provider but discards them if user doesn't attach.

**Current flow (broken):**
```
get-unlinked-emails -> provider API -> return to renderer (emails vanish)
```

**New flow:**
```
get-unlinked-emails -> emailSyncService.searchProviderEmails()
  -> provider API -> fetchStoreAndDedup() (stores locally) -> return to renderer
```

**Add to EmailSyncService:**
```typescript
async searchProviderEmails(params: {
  userId: string;
  searchParams: EmailSearchParams;
  transactionId?: string;
}): Promise<SearchResult>
```

**Files:** `electron/handlers/emailLinkingHandlers.ts` (update handler), `electron/services/emailSyncService.ts` (add method)

**Rules:** IPC response shape unchanged, manual link confidence stays 1.0.

---

### TASK-2068: Unify date-range calculation

**Goal:** One canonical function replacing 3 separate implementations.

**New file:** `electron/utils/emailDateRange.ts`

```typescript
export function computeTransactionDateRange(params: {
  started_at?: Date | string;
  created_at?: Date | string;
  closed_at?: Date | string;
}): { start: Date; end: Date }
```

**Logic:**
- **Start:** `started_at` > `created_at` > 2 years ago (matches current `computeEmailFetchSinceDate`)
- **End:** `closed_at` + 30 days buffer, or today (matches current autoLinkService)

**Replaces:**
1. `computeEmailFetchSinceDate()` in emailSyncHandlers.ts
2. `getTransactionDateRange()` + `getDefaultDateRange()` in autoLinkService.ts
3. Removes `DEFAULT_LOOKBACK_MONTHS = 6` from autoLinkService.ts

**Files:** New utility file, update `emailSyncService.ts`, update `autoLinkService.ts`, update tests.

---

### TASK-2069: Consolidate lookback settings to 2

**Goal:** Remove redundant settings.

**KEEP:**
1. `scan.lookbackMonths` (default 9) -- how far back transaction scanner looks
2. `messageImport.filters.lookbackMonths` (default 3) -- how far back iMessage import looks

**REMOVE:**
1. `emailSync.lookbackMonths` / `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS` in constants.ts -- redundant after TASK-2060 made audit period primary. First-time scan uses `scan.lookbackMonths` instead.
2. `DEFAULT_LOOKBACK_MONTHS = 6` in autoLinkService.ts -- already removed by TASK-2068.

**Files:** `electron/services/transactionService/transactionService.ts`, `electron/constants.ts`, related tests.

---

## Execution Plan

### Batch 1 (Parallel): TASK-2065, TASK-2068
No file overlap -- safe for parallel execution.

| Task | Primary Files | Overlap Risk |
|------|--------------|--------------|
| TASK-2065 (Split handlers) | emailSyncHandlers.ts, new handler files | None with 2068 |
| TASK-2068 (Date range) | autoLinkService.ts, new emailDateRange.ts | None with 2065 |

### Batch 2 (Sequential): TASK-2066
Extracts EmailSyncService from the now-slimmed handler file. Must run after TASK-2065.

### Batch 3 (Parallel): TASK-2067, TASK-2069
Both depend on TASK-2066. Touch different files, safe for parallel.

| Task | Primary Files | Overlap Risk |
|------|--------------|--------------|
| TASK-2067 (Store locally) | emailLinkingHandlers.ts, emailSyncService.ts | Low with 2069 |
| TASK-2069 (Lookback) | transactionService.ts, constants.ts | None with 2067 |

### Dependency Graph

```
Batch 1:  TASK-2065 (Split)     TASK-2068 (Date range)
              |                       |
              v                       |
Batch 2:  TASK-2066 (Service)         |
              |                       |
              v                       v
Batch 3:  TASK-2067 (Store)    TASK-2069 (Lookback)
```

## Risks

| Risk | Mitigation |
|------|-----------|
| Handler split breaks IPC registration | Each new file exports `registerXHandlers()`. Test all channels after split. |
| Service extraction misses edge cases | Extract without changing logic. Existing tests validate helpers. |
| Local storage on search slows UX | Dedup check is fast (SQLite lookup). Provider API call dominates latency. |
| Date range change affects auto-link | New behavior (2-year fallback) is more permissive than old (6-month). Tests verify. |
| Removing emailSync.lookbackMonths affects first scans | Scan already uses scan.lookbackMonths. Only first-time sync fallback changes. |

## Verification

1. `npm run type-check` -- passes after each task
2. `npm test` -- all existing email sync tests pass
3. Manual test: open transaction, trigger sync, verify emails fetched with date filtering
4. Manual test: open manual attach modal, search, verify results appear AND are cached locally
5. Verify auto-link works when contact is assigned to transaction
