# SPRINT-079: Contact Bug Fixes (Outlook Sync, Source Filter, Import Refresh)

**Status:** In Progress
**Created:** 2026-02-10
**Branch From:** develop
**Target:** develop

---

## Sprint Goal

Fix three contact-related bugs reported by the user:
1. Outlook contacts are not imported automatically during auto-refresh
2. Outlook/email source filter is missing from contact selection screens
3. ImportContactsModal does not refresh after a manual sync from Settings

All three bugs have been investigated and root causes are confirmed. This is a fix-only sprint with no investigation phase needed.

## Scope

### In Scope

| Task | Title | Priority | Est. Tokens | Phase |
|------|-------|----------|-------------|-------|
| TASK-1953 | Wire Outlook contacts sync into auto-refresh flow | P1 | ~25K | 1 |
| TASK-1954 | Add Outlook source pill and contact source filter | P2 | ~30K | 1 |
| TASK-1955 | Auto-refresh ImportContactsModal on sync completion | P2 | ~15K | 1 |

**Total estimated (engineering):** ~70K tokens
**SR Review overhead:** ~30K tokens
**Grand Total:** ~100K tokens

### Out of Scope / Deferred

- Re-authentication flow for users missing `Contacts.Read` scope
- Contact deduplication between Outlook and macOS Contacts
- Source filtering in ContactSelector (inline component, not modal)
- Manual "Refresh" button in ImportContactsModal
- Retroactive scope migration for existing users

---

## Phase Plan

### Phase 1: All Three Fixes (Parallel - Worktrees)

All three bugs are independent and touch different files. They can be executed in parallel using worktrees.

```
Phase 1 (Parallel):
  ├── TASK-1953: Wire Outlook contacts sync into auto-refresh
  ├── TASK-1954: Add Outlook source pill + source filter to ContactSelectModal
  └── TASK-1955: Add sync-complete listener to ImportContactsModal
```

**Parallel safety analysis:**

| Task Pair | Shared Files | Conflict Risk | Verdict |
|-----------|-------------|---------------|---------|
| 1953 vs 1954 | None | None | Safe parallel |
| 1953 vs 1955 | None | None | Safe parallel |
| 1954 vs 1955 | None | None | Safe parallel |

**File ownership per task:**

TASK-1953 touches:
- `src/services/SyncOrchestratorService.ts`
- `src/hooks/useAutoRefresh.ts`
- Possibly `electron/preload/contactBridge.ts` (type exposure)

TASK-1954 touches:
- `src/components/shared/SourcePill.tsx`
- `src/components/ContactSelectModal.tsx`

TASK-1955 touches:
- `src/components/contact/components/ImportContactsModal.tsx`

**No overlapping files between any tasks.**

---

## Dependency Graph

```
TASK-1953 (Outlook auto-sync)  ──┐
                                 │
TASK-1954 (Source pill + filter) ├──> All merge independently to develop
                                 │
TASK-1955 (Import modal refresh) ┘
```

No inter-task dependencies. All tasks can merge in any order.

---

## Merge Plan

All tasks branch from `develop` and merge independently back to `develop`.

**Branch naming:**
- `fix/TASK-1953-outlook-contacts-auto-sync`
- `fix/TASK-1954-source-pill-outlook-filter`
- `fix/TASK-1955-import-modal-refresh-listener`

**Worktrees for parallel execution:**
```bash
git worktree add ../Mad-TASK-1953 -b fix/TASK-1953-outlook-contacts-auto-sync develop
git worktree add ../Mad-TASK-1954 -b fix/TASK-1954-source-pill-outlook-filter develop
git worktree add ../Mad-TASK-1955 -b fix/TASK-1955-import-modal-refresh-listener develop
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `syncOutlookContacts` not exposed in preload bridge | Low | Medium | Check bridge first; if missing, add exposure |
| ContactSelectModal is large/complex | Low | Low | Changes are additive (new filter, not refactoring) |
| Outlook contacts use different source value | Low | Medium | Verify database source value before implementing |
| Token overrun on parallel execution | Low | Medium | Each task has 4x token cap; simple targeted fixes |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Unit Tests | Integration Tests | Manual |
|------|-----------|-------------------|--------|
| TASK-1953 | No (wiring) | No | App start -> Outlook contacts appear |
| TASK-1954 | Yes (SourcePill variant) | No | ContactSelectModal filter works |
| TASK-1955 | No (event listener) | No | Open modal -> trigger sync -> modal refreshes |

### CI Requirements

All PRs must pass:
- `npm run type-check`
- `npm run lint`
- `npm test`

### Manual Verification Checklist (Post-Sprint)

**For the user to verify in the morning:**

- [ ] **Bug 1 (TASK-1953):** Start the app with Microsoft email connected. Outlook contacts should appear in the contacts list without manual intervention.
- [ ] **Bug 2 (TASK-1954):** Open ContactSelectModal (when adding contacts to a transaction). Verify source filter pills appear. Select "Outlook" to see only Outlook contacts. Verify Outlook contacts show a distinct "Outlook" badge (indigo color).
- [ ] **Bug 3 (TASK-1955):** Open the ImportContactsModal. Go to Settings and trigger a manual macOS Contacts sync. Return to the modal -- it should have refreshed automatically with the newly synced contacts.

---

## Progress Tracking

| Task | Status | Billable Tokens | Duration | PR |
|------|--------|----------------|----------|-----|
| TASK-1953 | TODO | - | - | - |
| TASK-1954 | TODO | - | - | - |
| TASK-1955 | TODO | - | - | - |

---

## Unplanned Work Log

| Task | Source | Root Cause | Added Date | Impact |
|------|--------|------------|------------|--------|
| - | - | - | - | - |

### Unplanned Work Summary

| Metric | Value |
|--------|-------|
| Unplanned tasks | 0 |
| Unplanned PRs | 0 |
| Unplanned lines changed | 0 |
| Root causes | - |

---

## Validation Checklist (End of Sprint)

- [ ] Outlook contacts sync during auto-refresh (app start)
- [ ] SourcePill shows "Outlook" badge for Outlook contacts
- [ ] ContactSelectModal has source filter
- [ ] ImportContactsModal refreshes on sync-complete event
- [ ] No regressions in existing contact flows
- [ ] All CI checks pass on develop after all merges
