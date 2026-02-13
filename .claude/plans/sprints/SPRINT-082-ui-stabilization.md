# SPRINT-082: UI Stabilization & Polish

**Status:** Planning
**Created:** 2026-02-13
**Branch:** TBD (per SR Engineer technical review)
**Target:** develop (via PR)

---

## Sprint Goal

Fix 10 user-reported UI issues and UX friction points across the onboarding flow, audit creation, contacts management, and dashboard. These are all stabilization items that improve the daily-use experience.

## Scope

### In Scope

| # | Task | Backlog | Title | Category | Priority | Est. Tokens |
|---|------|---------|-------|----------|----------|-------------|
| 1 | TASK-1978 | BACKLOG-686 | Remove numbers from onboarding step trackers | ui | Low | ~8K |
| 2 | TASK-1979 | BACKLOG-687 | macOS iPhone contacts toggle persistence | fix | Medium | ~20K |
| 3 | TASK-1980 | BACKLOG-688 | Auto-detection start date wording + default + settings | ui | Medium | ~15K |
| 4 | TASK-1981 | BACKLOG-689 | Space bar in contact search input | fix | High | ~5K |
| 5 | TASK-1982 | BACKLOG-690 | Email count showing 0 on submission summary | fix | High | ~15K |
| 6 | TASK-1983 | BACKLOG-691 | Personalized welcome back message | feature | Low | ~10K |
| 7 | TASK-1984 | BACKLOG-692 | Clickable contact rows everywhere | feature | Medium | ~20K |
| 8 | TASK-1985 | BACKLOG-693 | Switch Add Manually / View Active buttons | ui | Low | ~5K |
| 9 | TASK-1986 | BACKLOG-694 | Skip AI tools for manual-only users | feature | Medium | ~10K |
| 10 | TASK-1987 | BACKLOG-695 | Remove contact on Step 3 of new audit | fix | Medium | ~10K |

**Total Estimated Tokens:** ~118K (engineer work only, excludes SR review overhead)

### Out of Scope

- AI detection accuracy improvements
- Sync orchestrator refactoring (BACKLOG-674 deferred)
- Database schema changes
- New IPC channels (unless absolutely required for TASK-1979)
- Backend/Supabase changes

---

## Dependency Graph

**Awaiting SR Engineer Technical Review** -- the following is a preliminary grouping.

### Preliminary Grouping (Pre-Review)

**Likely Independent (Parallel Candidates):**

| Group | Tasks | Rationale |
|-------|-------|-----------|
| A - Onboarding/Welcome | TASK-1978, TASK-1983 | Different screens, no shared files |
| B - Audit Flow | TASK-1980, TASK-1981, TASK-1985, TASK-1986, TASK-1987 | All touch audit modal or related components -- potential file conflicts |
| C - Contacts | TASK-1984 | Touches many contact display files |
| D - Sync/Settings | TASK-1979 | Sync service + settings |
| E - Submit | TASK-1982 | TransactionDetails + submit modal |

**Likely Sequential (Within Group B):**
- TASK-1981 (spacebar fix) and TASK-1987 (remove button) both touch `ContactSearchList`/`ContactRoleRow` area
- TASK-1985 (swap buttons) and TASK-1986 (skip AI) both touch `StartNewAuditModal`/`Dashboard`
- TASK-1980 touches `AddressVerificationStep` and `Settings` independently

**SR Engineer to confirm:**
1. Which tasks can truly run in parallel without merge conflicts
2. Whether Group B should be split or sequential
3. Whether TASK-1984 (clickable everywhere) should wait until after TASK-1987 (remove on step 3)

---

## Execution Order (Preliminary)

### Phase 1: Quick Fixes (Low Conflict Risk)
1. TASK-1978 - Onboarding circles (isolated, ~8K)
2. TASK-1981 - Spacebar fix (1-line change, ~5K)
3. TASK-1985 - Swap buttons (code move, ~5K)

### Phase 2: Medium Complexity
4. TASK-1983 - Welcome back message (~10K)
5. TASK-1982 - Email count fix (~15K, investigation needed)
6. TASK-1986 - Skip AI for manual users (~10K)
7. TASK-1987 - Remove contact step 3 (~10K)

### Phase 3: Higher Complexity
8. TASK-1979 - Contacts toggle persistence (~20K, may need main process changes)
9. TASK-1980 - Start date wording + settings (~15K, touches Settings + audit)
10. TASK-1984 - Clickable contacts everywhere (~20K, touches many files)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TASK-1979 sync fix requires IPC changes | Medium | Medium | Investigate first, escalate if main process changes needed |
| TASK-1984 (clickable everywhere) causes merge conflicts with TASK-1987 | Medium | Low | Run TASK-1987 first, then TASK-1984 |
| TASK-1982 email count is a deeper data issue | Low | Medium | Investigation step first before fix |
| Multiple tasks touch Settings.tsx | Medium | Medium | Run TASK-1980 before TASK-1979 or vice versa, not parallel |

---

## Validation Checklist (End of Sprint)

- [ ] All 10 tasks completed and merged
- [ ] No regression in existing functionality
- [ ] `npm test` passes on develop after all merges
- [ ] `npm run type-check` passes on develop
- [ ] User can test all 10 changes in a single build

---

## Progress Tracking

| Task | Status | PR | Notes |
|------|--------|-----|-------|
| TASK-1978 | Pending | - | - |
| TASK-1979 | Pending | - | - |
| TASK-1980 | Pending | - | - |
| TASK-1981 | Pending | - | - |
| TASK-1982 | Pending | - | - |
| TASK-1983 | Pending | - | - |
| TASK-1984 | Pending | - | - |
| TASK-1985 | Pending | - | - |
| TASK-1986 | Pending | - | - |
| TASK-1987 | Pending | - | - |
