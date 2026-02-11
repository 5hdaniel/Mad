# SPRINT-078: Contact Source Selection & Message Filtering

**Status:** Completed
**Created:** 2026-02-10
**Completed:** 2026-02-10
**Branch From:** develop
**Target:** develop

---

## Sprint Goal

Give users control over which contact sources are imported and add message filtering to limit database size. The user currently has 678,070+ messages imported, causing DB bloat. This sprint adds a Contact Sources preferences UI and message import filtering.

## Scope

### In Scope

| Task | Title | Priority | Est. Tokens | Phase |
|------|-------|----------|-------------|-------|
| TASK-1949 | Contact source preferences UI | P1 | ~20K | 1 |
| TASK-1950 | Wire direct contact imports to preferences | P1 | ~25K | 2 |
| TASK-1951 | Wire inferred contacts to preferences | P1 | ~25K | 2 |
| TASK-1952 | Filter messages on import to limit DB size | P2 | ~30K | 2 |

**Total estimated:** ~100K tokens (engineering) + ~60K (SR review overhead)

### Out of Scope / Deferred

- Retroactive filtering (deleting already-imported messages based on new filters)
- Per-conversation message filtering (only bulk date/count)
- Gmail-specific message import (not currently implemented as macOS Messages covers SMS/iMessage)
- Contact deduplication improvements
- Message search/indexing performance

---

## Phase Plan

### Phase 1: UI Foundation (Sequential)

```
TASK-1949: Contact source preferences UI
  - Add "Contact Sources" section to Settings
  - Two subsections: "Import From" and "Auto-discover from conversations"
  - Persist new preferences via existing preferences:update IPC
  - CI gate: type-check, lint, tests pass
```

**Rationale:** Phase 2 tasks all depend on the preferences schema and UI being in place.

### Phase 2: Wiring & Filtering (Parallel - Worktrees)

```
Phase 2 (Parallel):
  ├── TASK-1950: Wire direct contact imports to preferences
  ├── TASK-1951: Wire inferred contacts to preferences
  └── TASK-1952: Filter messages on import to limit DB size
```

**Parallel safety analysis:**

| Task Pair | Shared Files | Conflict Risk | Verdict |
|-----------|-------------|---------------|---------|
| 1950 vs 1951 | preferences read (read-only) | None | Safe parallel |
| 1950 vs 1952 | None | None | Safe parallel |
| 1951 vs 1952 | None | None | Safe parallel |

TASK-1950 touches: `electron/contact-handlers.ts`, `electron/services/db/externalContactDbService.ts`
TASK-1951 touches: `electron/services/transactionService.ts`, `electron/services/extraction/hybridExtractorService.ts`
TASK-1952 touches: `electron/handlers/messageImportHandlers.ts`, `electron/services/macOSMessagesImportService.ts`, `src/components/settings/MacOSMessagesImportSettings.tsx`

No overlapping files between phase 2 tasks.

---

## Dependency Graph

```
TASK-1949 (Contact source preferences UI)
    │
    ├──> TASK-1950 (Wire direct imports) [reads contactSources prefs]
    ├──> TASK-1951 (Wire inferred contacts) [reads contactSources prefs]
    └──> TASK-1952 (Message filtering) [independent, same phase timing]
```

**TASK-1952** is technically independent of TASK-1949 (message filtering does not need contact source prefs), but is grouped in Phase 2 for sprint flow.

---

## Merge Plan

1. TASK-1949 branch merges to develop first (Phase 1)
2. Phase 2 tasks branch from develop (after TASK-1949 merged)
3. Each Phase 2 task merges independently to develop (no ordering required)

**Branch naming:**
- `feature/TASK-1949-contact-source-prefs-ui`
- `feature/TASK-1950-wire-direct-imports`
- `feature/TASK-1951-wire-inferred-contacts`
- `feature/TASK-1952-message-import-filter`

**Worktrees for Phase 2:**
```bash
git worktree add ../Mad-TASK-1950 -b feature/TASK-1950-wire-direct-imports develop
git worktree add ../Mad-TASK-1951 -b feature/TASK-1951-wire-inferred-contacts develop
git worktree add ../Mad-TASK-1952 -b feature/TASK-1952-message-import-filter develop
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Preferences schema conflicts with future features | Low | Medium | Use namespaced key `contactSources` with clear sub-keys |
| Inferred contact pipeline is complex (LLM + pattern) | Medium | Medium | Task scoped to adding a preference check gate, not refactoring pipeline |
| Message count filtering edge cases (partial imports) | Medium | Low | Clear UI messaging about what filtering does |
| macOS Messages DB path varies by OS version | Low | Low | Already handled by existing import service |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Unit Tests | Integration Tests | Manual |
|------|-----------|-------------------|--------|
| TASK-1949 | Preference save/load | Toggle UI states | Visual in Settings |
| TASK-1950 | Import skip logic | Full import flow | Disable source, verify skip |
| TASK-1951 | Extraction gate check | Scan with prefs | Disable inferred, scan |
| TASK-1952 | Date/count filter logic | Import with filters | Import with cap, verify count |

### CI Requirements

All PRs must pass:
- `npm run type-check`
- `npm run lint`
- `npm test`

---

## Validation Checklist (End of Sprint)

- [x] Contact Sources section visible in Settings
- [x] Toggles persist across app restarts (via Supabase preferences)
- [x] Disabling Outlook Contacts skips Outlook contact sync
- [x] Disabling macOS Contacts skips macOS Contacts import
- [x] Disabling inferred sources prevents contacts from appearing via email scan
- [x] Message import filters work (date range or count cap)
- [x] No regressions in existing import flows
- [x] All CI checks pass on develop after all merges

---

## Completion Summary

**All 4 tasks completed and merged to develop on 2026-02-10.**

| Task | PR | Status |
|------|-----|--------|
| TASK-1949 | PR #797 | Merged |
| TASK-1950 | PR #799 | Merged |
| TASK-1951 | PR #800 | Merged |
| TASK-1952 | PR #798 | Merged |

**Follow-up:** BACKLOG-657 (Message Import Cap Warning & Default Filters) created as a quick follow-up outside the sprint. PR #801 in progress on branch `fix/message-import-default-filters`.

**Related:** BACKLOG-634 (Message Import Date Filter) marked Completed -- implemented by TASK-1952.
