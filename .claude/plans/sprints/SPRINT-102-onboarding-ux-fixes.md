# SPRINT-102: Onboarding & Tour UX Fixes

**Created:** 2026-02-26
**Status:** Planning
**Base:** `develop`

---

## Sprint Goal

Fix four user-reported onboarding and UX issues: remove dead checkbox from Secure Storage screen, prevent joyride tour from losing its anchor when sync auto-dismisses, ensure macOS Contacts sync during onboarding, and extend the joyride tour to cover audit screens.

## Sprint Narrative

User testing revealed several onboarding gaps. The Secure Storage Setup screen has a "Don't show this explanation again" checkbox that does nothing (the value is never read to skip the step). The joyride onboarding tour conflicts with fast sync completion -- the sync status indicator auto-dismisses after 3 seconds, removing the tour anchor mid-step. macOS Contacts are not reliably synced during onboarding when the Permissions step is skipped (already granted). Additionally, the tour only covers the Dashboard and should extend to the audit and transactions screens. A fourth request (address-based email filtering) is deferred as a separate epic due to its scope (~80K tokens, requires design spike).

---

## In-Scope

| ID | Title | Task | Batch | Est Tokens | Actual Tokens | PR | Merged | Status |
|----|-------|------|-------|-----------|---------------|-----|--------|--------|
| BACKLOG-816 | Remove unnecessary checkbox from Secure Storage | TASK-2080 | 1 (parallel) | ~15K | - | - | - | Pending |
| BACKLOG-817 | Joyride tour: pause sync auto-dismiss + extend tour | TASK-2081 + TASK-2082 | 1 (parallel) + 2 (sequential) | ~15K + ~20K | - | - | - | Pending |
| BACKLOG-818 | macOS Contacts + email cache during onboarding | TASK-2083 + TASK-2084 | 1 (parallel) + 2 (sequential) | ~15K + ~25K | - | - | - | Pending |

**Total Estimated Tokens:** ~90K (engineering) + ~40K (SR review) = ~130K

---

## Out of Scope

- **BACKLOG-819: Address-based email filtering** -- Large feature (~80K tokens), requires design spike, address parser utility, and multi-sprint planning. Tracked separately as future epic.
- **BACKLOG-569: Full joyride tour update** -- Partially addressed by TASK-2082 (new screens), but full audit of existing step text/targets deferred.
- **BACKLOG-582: Joyride not triggering after completing flow** -- Separate root cause investigation needed.
- **BACKLOG-801: SyncOrchestrator unification** -- Structural refactor, not in this sprint.
- **Email cache retention/cleanup** -- TASK-2084 adds initial cache, cleanup policy is follow-up.

---

## Execution Plan

### Batch 1 (Parallel): TASK-2080, TASK-2081, TASK-2083

These three tasks touch completely different areas of the codebase:

| Task | Primary Files | Overlap Risk |
|------|--------------|--------------|
| TASK-2080 | `SecureStorageStep.tsx`, `useSecureStorage.ts`, `useKeychainHandlers.ts`, `types.ts` | None with others |
| TASK-2081 | `SyncStatusIndicator.tsx`, `Dashboard.tsx`, `useTour.ts` | Minimal -- only SyncStatusIndicator |
| TASK-2083 | `PermissionsStep.tsx`, `OnboardingFlow.tsx`, `macosFlow.ts`, `useAutoRefresh.ts` | None with others |

SR Engineer to confirm parallel safety during Technical Review.

### Batch 2 (Sequential): TASK-2082 (after TASK-2081), TASK-2084 (after TASK-2083)

| Task | Depends On | Reason |
|------|-----------|--------|
| TASK-2082 (extend tour to new screens) | TASK-2081 (tour/sync fix) | Tour infrastructure changes in TASK-2081 must land first |
| TASK-2084 (email cache during onboarding) | TASK-2083 (contacts sync fix) | Onboarding sync changes in TASK-2083 must land first |

These two Batch 2 tasks are independent of each other and CAN run in parallel.

---

## Dependency Graph

```
TASK-2080 (remove checkbox)          ──┐
TASK-2081 (tour/sync auto-dismiss)   ──┼── Batch 1 (parallel)
TASK-2083 (contacts onboarding sync) ──┘
                                       │
                    ┌──────────────────┘
                    │
                    ▼
TASK-2082 (extend tour screens)      ──┐
                                       ├── Batch 2 (parallel with each other)
TASK-2084 (email cache onboarding)   ──┘
```

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Removing dontShowAgain prop may have downstream consumers not found by grep | TASK-2080 must verify no references remain via type-check |
| Tour step anchors for new screens may not exist yet in the DOM | TASK-2082 must add data-tour attributes to target components first |
| Email cache during onboarding may slow down first-time user experience | TASK-2084 should run email fetch in background, not block onboarding progression |
| macOS contacts sync timing -- if FDA not granted yet, contacts sync will fail silently | TASK-2083 must handle the case where contacts.getAll fails due to permissions and not block progression |
| SyncStatusIndicator auto-dismiss suppression may leave indicator stuck if tour is abandoned | TASK-2081 must resume normal dismiss behavior when tour ends/is skipped |

---

## Technical Review Checklist (SR Engineer)

- [ ] Confirm Batch 1 tasks have no shared file conflicts
- [ ] Review branch strategy for each task
- [ ] Add technical considerations to each task file
- [ ] Flag any architectural concerns
- [ ] Verify TASK-2081 handles tour skip/close edge cases
- [ ] Verify TASK-2084 email fetch approach (background, non-blocking)

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Unit Tests | Integration Tests | Manual QA |
|------|-----------|-------------------|-----------|
| TASK-2080 | Update SecureStorageStep tests, remove skipKeychainExplanation tests | N/A | Verify onboarding flow still works on macOS |
| TASK-2081 | Update SyncStatusIndicator auto-dismiss tests for tour state | N/A | Start tour, trigger sync, verify indicator stays during tour step |
| TASK-2082 | Add tour step snapshot tests | N/A | Walk through full extended tour on Dashboard + Transactions + Audit |
| TASK-2083 | Update PermissionsStep/useAutoRefresh tests | N/A | New macOS user onboarding: verify contacts appear after setup |
| TASK-2084 | Test email fetch trigger during onboarding | N/A | After onboarding, check Settings > email cache has data |

### CI Requirements

All PRs must pass:
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm test`

---

## Retrospective

*To be filled after sprint completion.*
