# Task TASK-705: Dashboard AI Detection Display

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Update the Dashboard component to prominently showcase the AI auto-detection features. Users should see pending auto-detected transactions awaiting review and understand that the app is actively detecting transactions from their communications.

## Non-Goals

- Do NOT change the auto-detection logic itself
- Do NOT modify the pending review workflow
- Do NOT add new AI features
- Do NOT change the existing action cards layout

## Deliverables

1. Add "AI Detection Status" section to Dashboard
2. Show pending auto-detected transaction count
3. Quick link to pending review queue
4. Visual indicator of AI activity status

## Background

SPRINT-006 and SPRINT-007 implemented:
- AI-powered email analysis for transaction detection (`detection_status: 'pending_review'`)
- Thread-based detection with 97% cost reduction
- Automatic transaction suggestions with approve/reject workflow
- Detection results stored in `transactions` table with `detection_status` field

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Dashboard.tsx` | Add AI status section |
| Potentially new: `src/components/dashboard/AIStatusCard.tsx` | Extract to component if complex |

## Acceptance Criteria

- [ ] Dashboard shows count of pending auto-detected transactions
- [ ] Users can click to navigate to pending review queue
- [ ] Visual indicator of last scan time or AI status
- [ ] Consistent styling with existing dashboard cards
- [ ] No performance impact from data fetching
- [ ] Graceful handling when no pending items
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Data Fetching

Need to get count of transactions with `detection_status = 'pending_review'`:

```typescript
// Check if this IPC exists, or use transactions.getAll and filter
const pendingCount = await window.api.transactions.getPendingReviewCount(userId);

// Or if no specific endpoint:
const allTransactions = await window.api.transactions.getAll(userId);
const pendingCount = allTransactions.filter(
  t => t.detection_status === 'pending_review'
).length;
```

### Dashboard Integration

Add section above or below action cards:

```tsx
// In Dashboard.tsx
{pendingCount > 0 && (
  <div className="mb-8">
    <AIStatusCard
      pendingCount={pendingCount}
      onViewPending={handleViewPending}
    />
  </div>
)}
```

### AIStatusCard Component

```tsx
interface AIStatusCardProps {
  pendingCount: number;
  onViewPending: () => void;
}

export function AIStatusCard({ pendingCount, onViewPending }: AIStatusCardProps) {
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* AI/Magic wand icon */}
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" ...>
              {/* Sparkles or wand icon */}
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              AI Transaction Detection
            </h3>
            <p className="text-xs text-indigo-700">
              {pendingCount} transaction{pendingCount !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
        </div>
        <button
          onClick={onViewPending}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Review Now
        </button>
      </div>
    </div>
  );
}
```

### Navigation to Pending Review

The Dashboard receives `onViewTransactions` callback. Need to check if TransactionList supports filtering by detection_status:

```tsx
// If TransactionList supports filter param:
const handleViewPending = () => {
  // Navigate to transactions with pending_review filter
  onViewTransactions({ filter: 'pending_review' });
};

// Or if navigation needs query param:
// This may require update to navigation/routing
```

### Zero State (No Pending Items)

When no pending items, show subtle encouragement:

```tsx
{pendingCount === 0 && (
  <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-5 h-5 text-green-600" ...>
          {/* Checkmark icon */}
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700">
          All Caught Up
        </h3>
        <p className="text-xs text-gray-500">
          No transactions awaiting review. We'll notify you when new ones are detected.
        </p>
      </div>
    </div>
  </div>
)}
```

## Do / Don't

### Do:

- Keep the dashboard focused and uncluttered
- Use consistent styling with existing cards
- Lazy load the pending count to avoid blocking
- Handle loading/error states gracefully
- Make the call-to-action clear

### Don't:

- Don't add complex animations or distracting elements
- Don't block dashboard rendering while fetching count
- Don't duplicate the pending review functionality
- Don't modify the core action cards significantly

## When to Stop and Ask

- If there's no API to get pending count efficiently
- If navigation to filtered transactions is complex
- If the dashboard layout needs significant restructuring
- If performance concerns arise with the data fetch

## Integration Notes

- **Depends on:** None (independent task)
- **Imports from:** Transaction types, navigation callbacks
- **May need:** IPC endpoint for pending count (check if exists)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - AIStatusCard component renders correctly
  - Pending count display
  - Click handler works
  - Zero state renders correctly
- Existing tests to update:
  - Dashboard.test.tsx (if exists) - add AI status section tests

### Coverage

- Coverage impact: Should improve (new UI tested)

### Integration / Feature Tests

- Required scenarios:
  - Dashboard with pending items shows review button
  - Dashboard with no pending items shows "all caught up"
  - Click Review Now navigates to correct view

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(dashboard): add AI detection status display`
- **Labels**: `enhancement`, `dashboard`, `ai`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 6-10
- **Tokens:** ~35K-55K
- **Time:** ~1-2h

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 1-2 files | +2-3 |
| New component | AIStatusCard (optional) | +2-3 |
| Code volume | ~100-150 lines | +1-2 |
| Data fetching | May need hook or IPC check | +1-2 |
| Test complexity | Low-Medium | +1-2 |

**Confidence:** Medium (depends on existing IPC support)

**Risk factors:**
- May need new IPC endpoint for pending count
- Navigation to filtered view may need work

**Similar past tasks:** Dashboard enhancements typically 5-8 turns

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] AIStatusCard.tsx (if extracted)

Files modified:
- [ ] Dashboard.tsx

Features implemented:
- [ ] Pending count display
- [ ] Review Now button
- [ ] Zero state message
- [ ] Navigation to pending

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document IPC approach and layout decisions>

**Issues encountered:**
<Document any challenges>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 1-2 | X | +/- X | <reason> |
| New component | 0-1 | X | +/- X | <reason> |
| Code volume | ~100-150 lines | ~X lines | +/- X | <reason> |
| IPC work | Low | Low/Med/High | - | <reason> |

**Total Variance:** Est 6-10 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
