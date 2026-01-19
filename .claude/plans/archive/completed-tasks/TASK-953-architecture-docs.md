# Task TASK-953: Update Architecture Documentation

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Update project documentation to reflect the new state machine architecture implemented in BACKLOG-142.

## Non-Goals

- Do NOT create new documentation files unless necessary
- Do NOT document implementation details that may change

## Deliverables

1. Update `.claude/docs/` with state machine architecture overview
2. Add troubleshooting guide for state machine issues
3. Update BACKLOG-142 to mark Phase 3 complete
4. Update backlog INDEX.md with sprint completion

## Documentation Updates

### New File: `.claude/docs/shared/state-machine-architecture.md`

```markdown
# State Machine Architecture

## Overview

Magic Audit uses a unified state machine for app state coordination,
implemented in Phase 1-3 of BACKLOG-142.

## States

| State | Description | Transitions To |
|-------|-------------|----------------|
| loading | App initializing | unauthenticated, onboarding, ready, error |
| unauthenticated | No user logged in | loading (on login) |
| onboarding | User completing setup | ready, error |
| ready | App fully functional | unauthenticated (on logout) |
| error | Recoverable error | loading (on retry) |

## Key Files

| File | Purpose |
|------|---------|
| `src/appCore/state/machine/types.ts` | State and action types |
| `src/appCore/state/machine/reducer.ts` | State transitions |
| `src/appCore/state/machine/AppStateContext.tsx` | React context |
| `src/appCore/state/machine/LoadingOrchestrator.tsx` | Init sequence |

## Feature Flag

Emergency rollback: `localStorage.setItem('useNewStateMachine', 'false')`

## Troubleshooting

...
```

### Update: BACKLOG-142.md

Add Phase 3 completion status and link to architecture docs.

### Update: `.claude/plans/backlog/INDEX.md`

- Mark BACKLOG-142 as complete
- Add SPRINT-022 to sprint history
- Update changelog

## Acceptance Criteria

- [ ] Architecture overview document created
- [ ] Troubleshooting guide added
- [ ] BACKLOG-142 marked complete
- [ ] INDEX.md updated

## PR Preparation

- **Title**: `docs: update architecture documentation for state machine`
- **Branch From**: `develop`
- **Branch Into**: `develop`
- **Branch Name**: `docs/TASK-953-architecture-docs`

---

## PM Estimate (PM-Owned)

**Category:** `docs`

**Estimated Tokens:** ~15K (small scope, well-defined)

**Token Cap:** 60K (docs buffer)

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `docs/TASK-953-architecture-docs`

---

## Implementation Summary (Engineer-Owned)

### What Was Done

1. **Created State Machine Architecture Document**
   - Location: `.claude/docs/shared/state-machine-architecture.md`
   - Contents: State diagram, states/transitions table, key files reference, actions reference, usage examples, troubleshooting guide
   - ~280 lines of comprehensive documentation

2. **Updated BACKLOG-142**
   - Status changed from "Pending" to "Complete"
   - Added Phase Completion Status section with all 3 phases documented
   - Added changelog entries for all phase completions
   - Added reference to architecture documentation

3. **Updated Backlog INDEX.md**
   - BACKLOG-142 status changed to "Completed"
   - State Coordination Overhaul Project section updated to "COMPLETE"
   - Added SPRINT-020, SPRINT-021, SPRINT-022 to Sprint History
   - Added changelog entry for BACKLOG-142 completion

4. **Updated Documentation INDEX.md**
   - Added "State Machine Architecture" to Shared Reference Documents table
   - Updated Last Updated date
   - Added version history entry

### Files Changed

| File | Change |
|------|--------|
| `.claude/docs/shared/state-machine-architecture.md` | NEW - Architecture documentation |
| `.claude/docs/INDEX.md` | Added state machine doc to index |
| `.claude/plans/backlog/BACKLOG-142.md` | Marked complete, added phase status |
| `.claude/plans/backlog/INDEX.md` | Updated status, sprint history, changelog |

### Engineer Checklist

- [x] Architecture overview document created
- [x] Troubleshooting guide added
- [x] BACKLOG-142 marked complete
- [x] INDEX.md updated
- [x] Documentation INDEX.md updated
- [x] Type check passes
- [x] Lint passes

### Deviations

None - implemented exactly as specified in task file.

### Metrics (Auto-Captured)

*Will be populated by SubagentStop hook*
