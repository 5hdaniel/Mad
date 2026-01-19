# BACKLOG-302: Service Pattern Audit - Coordination Refactoring Opportunities

## Status: OPEN
## Priority: Medium
## Category: Technical Debt / Architecture
## Created: 2026-01-18

---

## Summary

Codebase audit for patterns that would benefit from centralized service/coordinator refactoring, similar to the SyncScheduler pattern recommended in BACKLOG-301.

---

## Findings

### 1. Sync Coordination (Already in BACKLOG-301)

**Files:**
- `src/hooks/useAutoRefresh.ts`
- `src/hooks/useMacOSMessagesImport.ts`

**Smells Found:**
| Smell | Evidence |
|-------|----------|
| Cross-module flags | `hasMessagesImportTriggered()` exported, `shouldSkipMessagesSync()` exported |
| Bidirectional imports | Each hook imports from the other |
| Duplicate guards | Both have `let hasTriggered*` module-level flags |
| Same API call | Both call `window.api.messages.importMacOSMessages()` |

**Status:** Already documented in BACKLOG-301 (SyncScheduler)

---

### 2. Transaction Scan Duplication - NEW

**Files:**
- `src/hooks/useAutoRefresh.ts:288` - calls `transactions.scan()`
- `src/components/transaction/hooks/useTransactionScan.ts:71` - calls `transactions.scan()`
- `src/components/Transactions.tsx:195` - calls `transactions.scan()`

**Smells Found:**
| Smell | Evidence |
|-------|----------|
| Ownership ambiguity | 3 different places can trigger transaction scan |
| No coordination | No guards or flags to prevent duplicate scans |
| Hidden coupling | Components may trigger scans while auto-refresh is running |

**Risk:** User could trigger manual scan while auto-refresh is running, causing duplicate processing.

**Recommendation:** Include `transactions.scan` in the SyncScheduler service from BACKLOG-301.

**Priority:** Medium

---

### 3. Messages Import Scatter - NEW

**Files:**
- `src/hooks/useAutoRefresh.ts:328` - auto-refresh trigger
- `src/hooks/useMacOSMessagesImport.ts:88` - background trigger
- `src/components/settings/MacOSMessagesImportSettings.tsx:59` - manual settings trigger
- `src/components/onboarding/steps/PermissionsStep.tsx:263` - onboarding trigger

**Smells Found:**
| Smell | Evidence |
|-------|----------|
| Ownership ambiguity | 4 different places can trigger messages import |
| Partial coordination | Some flags exist but not comprehensive |
| Scattered entry points | Settings, onboarding, background, auto-refresh all trigger same operation |

**Risk:** Already fixed short-term via cross-hook flags, but still fragile.

**Recommendation:** Consolidate into SyncScheduler from BACKLOG-301.

**Priority:** Medium (already mitigated short-term)

---

### 4. Tour State Management - LOW PRIORITY

**Files:**
- `src/hooks/useTour.ts:35` - uses `setTimeout(..., 500)` timing

**Smells Found:**
| Smell | Evidence |
|-------|----------|
| Timing-based coordination | 500ms delay to "let UI settle" |

**Risk:** Low - isolated to tour functionality.

**Recommendation:** Not urgent. Could be improved with proper state machine but low ROI.

**Priority:** Low

---

## Recommended Actions

### Phase 1: Extend SyncScheduler (BACKLOG-301)

When implementing SyncScheduler, include these operations:
- `messages` - macOS Messages import
- `emails` - Email sync/scan
- `contacts` - Contacts sync
- `transactionScan` - Transaction detection scan (NEW)

This consolidates findings #1, #2, and #3 into a single service.

### Phase 2: Future Considerations

| Area | Pattern | Action |
|------|---------|--------|
| Tour | Timing delay | Low priority - leave as-is |
| Preferences | Multiple loaders | Monitor - not yet problematic |
| OAuth | Token refresh | Already well-isolated |

---

## Estimated Effort

Extending BACKLOG-301 to include transaction scan:
- Additional effort: ~10K tokens
- Total SyncScheduler (revised): ~75K tokens

---

## Dependencies

- BACKLOG-301: SyncScheduler Refactor (parent item)

---

## Related Files

```
src/hooks/useAutoRefresh.ts
src/hooks/useMacOSMessagesImport.ts
src/components/transaction/hooks/useTransactionScan.ts
src/components/Transactions.tsx
src/components/settings/MacOSMessagesImportSettings.tsx
src/components/onboarding/steps/PermissionsStep.tsx
```

---

## Notes

- Audit was conducted via grep patterns for known smells
- Most critical issues already addressed in BACKLOG-301
- Transaction scan duplication is the main new finding
- No urgent action needed - current mitigations are working
