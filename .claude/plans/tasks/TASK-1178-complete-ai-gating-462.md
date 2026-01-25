# TASK-1178: Complete AI Feature Gating (BACKLOG-462)

**Backlog ID:** BACKLOG-462
**Sprint:** SPRINT-053 - License Enhancement & AI Gating Verification
**Phase:** Phase 3 - AI Features (Final)
**Branch:** `fix/task-1178-complete-ai-gating`
**Estimated Turns:** 3-5
**Estimated Tokens:** ~15K

---

## Objective

Complete the remaining AI feature gating for BACKLOG-462. The previous PR #570 addressed Settings section gating, but two UI elements still need to be hidden when the user does not have the AI add-on:

1. **Rejected filter tab** - Should not appear in transaction toolbar
2. **Rejected status wrapper** - Transaction cards should not show "Rejected" styling

---

## Context

**Prior Work (PR #570 - Merged):**
- Settings AI section is now gated behind `LicenseGate requires="ai_addon"`
- Dev toggle added: `window.api.license.devToggleAIAddon(userId, true/false)`

**Current State:**
- Modal subtitle: Already gated (different text based on `hasAIAddon`)
- Manual pill on cards: Already gated (`ManualEntryBadge` returns null if no AI add-on)
- Rejected tab: NOT gated (always visible)
- Rejected status wrapper: NOT gated (shows "Rejected" styling regardless of AI add-on)

**Why This Matters:**
"Rejected" is an AI-specific concept - it means "false positive from AI detection". Without AI detection, there are no false positives to reject, so this status should not exist in the UI.

---

## Requirements

### Must Do:
1. Wrap the "Rejected" filter tab in `LicenseGate requires="ai_addon"` in `TransactionToolbar.tsx`
2. Modify `getStatusConfig()` in `TransactionStatusWrapper.tsx` to treat rejected transactions as "Active" when user has no AI add-on
3. Add unit tests for both gating behaviors
4. Ensure existing tests still pass

### Must NOT Do:
- Change the underlying database schema or detection_status values
- Modify how transactions are stored (only UI display)
- Touch any components not directly related to this gating

---

## Acceptance Criteria

- [ ] Without AI add-on: "Rejected" tab is hidden in transaction toolbar
- [ ] Without AI add-on: Transactions with `detection_status === "rejected"` display as "Active" (not "Rejected")
- [ ] With AI add-on: All behaviors remain unchanged (Rejected tab visible, Rejected status visible)
- [ ] All existing tests pass
- [ ] New tests verify gating behavior

---

## Files to Modify

- `src/components/transaction/components/TransactionToolbar.tsx` - Wrap Rejected tab with LicenseGate
- `src/components/transaction/components/TransactionStatusWrapper.tsx` - Gate rejected status styling
- `src/components/transaction/components/__tests__/TransactionToolbar.test.tsx` - Add gating tests (create if needed)
- `src/components/transaction/components/__tests__/TransactionStatusWrapper.test.tsx` - Add gating tests (create if needed)

## Files to Read (for context)

- `src/contexts/LicenseContext.tsx` - How `hasAIAddon` works
- `src/components/common/LicenseGate.tsx` - How LicenseGate works
- Current state of files to modify (already read in task creation)

---

## Implementation Guidance

### TransactionToolbar.tsx (lines 191-205)

Current code:
```tsx
<button
  onClick={() => onFilterChange("rejected")}
  className={`px-4 py-2 rounded-md font-medium transition-all ${
    filter === "rejected"
      ? "bg-white text-red-600 shadow-sm"
      : "text-gray-600 hover:text-gray-900"
  }`}
>
  Rejected
  {filterCounts.rejected > 0 && (
    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
      {filterCounts.rejected}
    </span>
  )}
</button>
```

Wrap with:
```tsx
<LicenseGate requires="ai_addon">
  {/* existing button */}
</LicenseGate>
```

### TransactionStatusWrapper.tsx (lines 93-169)

Current `getStatusConfig()` checks for `detectionStatus === "rejected"` unconditionally.

Add `hasAIAddon` parameter and modify:
```tsx
export function getStatusConfig(transaction: Transaction, hasAIAddon: boolean): StatusConfig {
  // ... existing pending check ...

  // Rejected - Red (AI add-on only)
  // Without AI, treat rejected as Active
  if (detectionStatus === "rejected" && hasAIAddon) {
    return {
      // ... rejected config
    };
  }

  // ... rest of function
}
```

Then update the component call (line 186):
```tsx
const { hasAIAddon } = useLicense();
const config = getStatusConfig(transaction, hasAIAddon);
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  1. TransactionToolbar: Rejected tab hidden without AI add-on
  2. TransactionToolbar: Rejected tab visible with AI add-on
  3. TransactionStatusWrapper: Rejected transactions show as Active without AI add-on
  4. TransactionStatusWrapper: Rejected transactions show as Rejected with AI add-on

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(license): complete AI feature gating for rejected status (BACKLOG-462)`
- **Branch:** `fix/task-1178-complete-ai-gating`
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
- **Actual Turns**: X (Est: 3-5)
- **Actual Tokens**: ~XK (Est: 15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find other places where "rejected" status is exposed to users without AI gating
- Tests are failing in unexpected ways
- The LicenseContext or LicenseGate patterns differ from what's documented here
- You encounter blockers not covered in the task file
