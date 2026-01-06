# TASK-958: Add Dismiss Button to Notification Banners

**Backlog ID:** N/A (Ad-hoc feature request)
**Sprint:** Unassigned
**Phase:** N/A
**Branch:** `feature/task-958-dismissible-notifications`
**Estimated Tokens:** ~25K (UI category, apply 1.0x)
**Token Cap:** 100K

---

## Objective

Add dismiss/close functionality to the AIStatusCard notification banners in the transactions/dashboard view, allowing users to temporarily hide notifications until state changes.

---

## Context

The `AIStatusCard` component (`src/components/dashboard/AIStatusCard.tsx`) displays two types of notification banners:

1. **"All Caught Up" banner** - Shows when `pendingCount === 0` with the message "No transactions awaiting review. We'll notify you when new ones are detected."

2. **"AI Transaction Detection" banner** - Shows when `pendingCount > 0` with "{count} transaction(s) awaiting review" and a "Review Now" button.

Users have requested the ability to dismiss these banners temporarily. The dismissal should reset when the underlying state changes (e.g., new transactions arrive, or user reviews all pending transactions).

---

## Requirements

### Must Do:

1. **Add dismiss button (X icon)** to both notification banner variants:
   - "All Caught Up" banner (empty state)
   - "AI Transaction Detection" banner (pending state)

2. **Implement dismiss state management:**
   - Track dismissed state per banner type
   - Reset dismissed state when `pendingCount` changes
   - Dismissed state should be session-scoped (not persisted across app restarts)

3. **Maintain visual consistency:**
   - Use existing design patterns (Tailwind classes, icon styles)
   - Position dismiss button in top-right corner of the banner
   - Use subtle X icon that doesn't compete with primary content

4. **Update component interface:**
   - Add optional `onDismiss` callback prop
   - Consider whether dismissal state should be managed internally or by parent

### Must NOT Do:

- Persist dismissal state to database or localStorage (session-only)
- Change existing banner layouts significantly
- Remove the "Review Now" button functionality
- Auto-dismiss banners after a timeout

---

## Acceptance Criteria

- [ ] Both banner variants have a visible dismiss button (X icon)
- [ ] Clicking dismiss hides the respective banner
- [ ] Dismissing "All Caught Up" banner: re-appears when new transactions arrive (pendingCount goes from 0 to >0)
- [ ] Dismissing "AI Transaction Detection" banner: re-appears when pendingCount changes
- [ ] Dismiss button has proper hover/focus states for accessibility
- [ ] Existing "Review Now" button continues to work correctly
- [ ] Component renders correctly when dismissed (should return null or empty fragment)
- [ ] Unit tests updated/added for dismiss functionality
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/dashboard/AIStatusCard.tsx` - Add dismiss button, state management
- `src/components/dashboard/__tests__/AIStatusCard.test.tsx` - Add dismiss functionality tests

## Files to Read (for context)

- `src/components/dashboard/AIStatusCard.tsx` - Current implementation
- `src/components/dashboard/__tests__/AIStatusCard.test.tsx` - Existing test patterns

---

## Implementation Notes

### Recommended Approach: Internal State with Effect Reset

```typescript
interface AIStatusCardProps {
  pendingCount: number;
  onViewPending: () => void;
  isLoading?: boolean;
}

export function AIStatusCard({
  pendingCount,
  onViewPending,
  isLoading = false,
}: AIStatusCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when pendingCount changes
  useEffect(() => {
    setIsDismissed(false);
  }, [pendingCount]);

  // If dismissed, render nothing
  if (isDismissed) {
    return null;
  }

  // ... rest of component
}
```

### Dismiss Button Pattern

```tsx
<button
  onClick={() => setIsDismissed(true)}
  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
  aria-label="Dismiss notification"
  data-testid="ai-status-dismiss-button"
>
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
</button>
```

### Container Position Update

Both banner containers need `position: relative` for absolute positioning of dismiss button:

```tsx
<div className="relative bg-gray-50 border border-gray-200 rounded-xl p-4">
```

### Test Cases to Add

```typescript
it('shows dismiss button on empty state banner', () => {
  render(<AIStatusCard pendingCount={0} onViewPending={mockFn} />);
  expect(screen.getByTestId('ai-status-dismiss-button')).toBeInTheDocument();
});

it('hides banner when dismiss button clicked', () => {
  render(<AIStatusCard pendingCount={0} onViewPending={mockFn} />);
  fireEvent.click(screen.getByTestId('ai-status-dismiss-button'));
  expect(screen.queryByTestId('ai-status-card-empty')).not.toBeInTheDocument();
});

it('resets dismissed state when pendingCount changes', () => {
  const { rerender } = render(<AIStatusCard pendingCount={0} onViewPending={mockFn} />);
  fireEvent.click(screen.getByTestId('ai-status-dismiss-button'));
  expect(screen.queryByTestId('ai-status-card-empty')).not.toBeInTheDocument();

  rerender(<AIStatusCard pendingCount={3} onViewPending={mockFn} />);
  expect(screen.getByTestId('ai-status-card-pending')).toBeInTheDocument();
});
```

---

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  - Dismiss button renders on empty state banner
  - Dismiss button renders on pending state banner
  - Clicking dismiss hides the empty state banner
  - Clicking dismiss hides the pending state banner
  - Dismissed state resets when pendingCount changes
  - Dismiss button has correct aria-label
- **Existing tests to update:** May need to account for new dismiss button in existing DOM queries

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(ui): add dismiss button to AIStatusCard notification banners`
- **Branch:** `feature/task-958-dismissible-notifications`
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
- [ ] Recorded Agent ID: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Agent ID in description
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Notification banners cannot be dismissed
- **After**: Users can dismiss banners; they reappear when state changes
- **Actual Tokens**: (auto-captured via SubagentStop hook)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The dismiss behavior should persist across sessions (database/localStorage)
- The dismiss button should be optional (controlled by prop)
- There are multiple places where AIStatusCard is used with different dismiss requirements
- You encounter blockers not covered in the task file
