# Task TASK-1940: Extract AppModals.tsx Below 150-Line Trigger

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Extract code from `AppModals.tsx` (currently 194 lines) to bring it below the 150-line trigger defined in architecture guardrails. Extract the IPhoneSyncFlow wrapper and email settings callbacks into separate modules.

## Non-Goals

- Do NOT change modal behavior or appearance
- Do NOT refactor modal state management
- Do NOT extract modals that are already small/simple
- Do NOT change the public API of AppModals

## Deliverables

1. New file: `src/appCore/modals/IPhoneSyncModal.tsx` — Extract IPhoneSyncFlow wrapper component
2. New file (if needed): `src/appCore/hooks/useEmailSettingsCallbacks.ts` — Extract email settings callback hooks
3. Update: `src/appCore/AppModals.tsx` — Import extracted components, reduce to <150 lines

## Technical Details

### Architecture Guardrail Reference
From `.claude/docs/shared/architecture-guardrails.md`:
- AppModals.tsx trigger: >150 lines → mandatory extraction
- Current: 194 lines (44 lines over trigger)

### Extraction Strategy

1. **IPhoneSyncModal** — The IPhoneSyncFlow modal wrapper is the largest single block. Extract it as `IPhoneSyncModal.tsx` that takes the same props AppModals passes to it.

2. **Email Settings Callbacks** — If there are email settings handler callbacks that take >10 lines, extract them into a custom hook `useEmailSettingsCallbacks`.

3. **Keep AppModals as orchestrator** — After extraction, AppModals should be a thin orchestrator that conditionally renders each modal based on app state.

### File Structure
```
src/appCore/
├── AppModals.tsx          (< 150 lines, orchestrator)
└── modals/
    └── IPhoneSyncModal.tsx (extracted wrapper)
```

## Acceptance Criteria

- [ ] `AppModals.tsx` is under 150 lines
- [ ] All modals render and function identically to before
- [ ] No new props or state management changes
- [ ] Extracted components are properly typed
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes

## Branch & Worktree

- **Branch:** `fix/TASK-1940-appmodals-extraction`
- **Worktree:** `../Mad-TASK-1940`
- **Base:** `develop`
- **Target:** `develop`

## Sprint

- **Sprint:** SPRINT-076
- **Phase:** 1 (parallel with TASK-1938, TASK-1939)
- **Priority:** P1 High
- **Estimated Tokens:** ~20K
