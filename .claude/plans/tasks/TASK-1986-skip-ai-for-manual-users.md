# TASK-1986: Skip AI tools screen for manual-only users

**Backlog ID:** BACKLOG-694
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `feature/task-1986-skip-ai-manual`
**Estimated Tokens:** ~10K (ui x 1.0)

---

## Objective

For users who do not have the AI add-on, the "Start New Audit" flow should skip the AI-detected transactions screen and go directly to Step 1 of creating a transaction manually (the address verification step in `AuditTransactionModal`).

---

## Context

- `src/components/StartNewAuditModal.tsx` is the entry point for new audits
- It shows AI-detected transactions (wrapped in `<LicenseGate requires="ai_addon">`) and secondary actions (View Active, Add Manually)
- The `useLicense()` hook provides `hasAIAddon` boolean
- For non-AI users, the modal shows an empty state with just "View Active Transactions" and "Add Manually" buttons -- this is unnecessary friction
- The `onCreateManually` callback opens the `AuditTransactionModal` at Step 1

The fix: when a user without AI add-on clicks "New Audit" on the Dashboard, bypass `StartNewAuditModal` entirely and go straight to `AuditTransactionModal` (manual transaction creation, Step 1).

---

## Requirements

### Must Do:
1. In the component that launches the new audit flow (likely `Dashboard.tsx` or `AppShell.tsx`), check `hasAIAddon` before deciding which modal to show
2. If `hasAIAddon` is `false`: directly trigger the manual transaction creation flow (same as clicking "Add Manually")
3. If `hasAIAddon` is `true`: show `StartNewAuditModal` as usual (with AI-detected transactions)
4. Ensure the "transaction limit reached" check still happens before opening the manual flow

### Must NOT Do:
- Remove `StartNewAuditModal` (still needed for AI users)
- Change the `AuditTransactionModal` component
- Modify the license checking logic
- Skip the transaction limit check

---

## Acceptance Criteria

- [ ] Non-AI users clicking "New Audit" go directly to Step 1 (address/transaction type)
- [ ] AI users clicking "New Audit" still see the StartNewAuditModal with AI-detected transactions
- [ ] Transaction limit check still prevents creating if limit reached (for non-AI users)
- [ ] Non-AI users can still access "View Active Transactions" from other entry points
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/Dashboard.tsx` - Conditional logic in `handleStartNewAuditClick` based on `hasAIAddon`
- Possibly `src/appCore/AppShell.tsx` - If the modal routing happens there

## Files to Read (for context)

- `src/components/Dashboard.tsx` - New audit click handler
- `src/components/StartNewAuditModal.tsx` - Current modal with AI section
- `src/components/AuditTransactionModal.tsx` - Manual creation flow
- `src/contexts/LicenseContext.tsx` - `useLicense()` hook and `hasAIAddon`

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests unless a utility function is extracted
- **Existing tests to update:** `src/components/__tests__/StartNewAuditModal.test.tsx` may need updates

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(audit): skip AI screen and go directly to manual for non-AI users`
- **Branch:** `feature/task-1986-skip-ai-manual`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 10K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-02-13 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop (AFTER TASK-1983 is merged)
- **Branch Into:** develop
- **Suggested Branch Name:** feature/task-1986-skip-ai-manual

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-1983 (shared `Dashboard.tsx`)
- **Blocks:** None

### Shared File Analysis
- Files modified: `Dashboard.tsx`, possibly `AppShell.tsx`
- Conflicts with: **TASK-1983** on `Dashboard.tsx`. TASK-1983 adds user greeting logic; this task adds conditional modal bypass logic. TASK-1983 must merge first.

### Technical Considerations
- Engineer should check ALL entry points for "New Audit" beyond Dashboard (keyboard shortcuts, menu bar, etc.) to ensure the bypass is comprehensive
- The `canCreateTransaction` limit check must still fire before bypassing -- do not skip the transaction limit gate
- If `AppShell.tsx` needs changes, be careful with entry file line budgets (target 150, trigger 200)

---

## Guardrails

**STOP and ask PM if:**
- The modal launch logic is deeply embedded in state machine transitions and hard to intercept
- There are other entry points to "New Audit" besides the Dashboard card
- The `canCreateTransaction` check is not easily accessible at the point where you need to skip
- You encounter blockers not covered in the task file
