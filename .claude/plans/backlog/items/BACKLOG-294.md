# BACKLOG-294: Extract Reusable DashboardActionCard Component

**Created:** 2026-01-17
**Priority:** Low
**Type:** Refactor
**Status:** Open

---

## Summary

Extract a reusable `DashboardActionCard` component from the repeated button patterns in Dashboard.tsx. All three action buttons (New Audit, All Audits, Contacts) now share the same layout pattern and should be consolidated.

---

## Current State

Dashboard.tsx has three buttons with near-identical structure:
- Icon on the left (gradient background, rounded)
- Title text in the middle
- Optional badge (for pending count)
- Arrow icon on the right with hover animation

Each button is ~30 lines of JSX with repeated patterns.

---

## Proposed Component

```tsx
interface DashboardActionCardProps {
  title: string;
  icon: React.ReactNode;
  iconGradient: string; // e.g., "from-blue-500 to-purple-600"
  arrowColor: string;   // e.g., "text-blue-600"
  hoverBorder: string;  // e.g., "hover:border-blue-500"
  onClick: () => void;
  badge?: {
    count: number;
    label: string;
  };
  highlight?: boolean;  // For the ring effect when pending
  dataTour?: string;
}

function DashboardActionCard({ ... }: DashboardActionCardProps) {
  // Unified button rendering
}
```

---

## Benefits

- **DRY**: Remove ~60 lines of duplicated JSX
- **Consistency**: Single source of truth for button styling
- **Maintainability**: Style changes apply to all buttons at once
- **Testability**: One component to test instead of three inline buttons

---

## Files to Modify

- `src/components/Dashboard.tsx` - Replace inline buttons with component
- Create `src/components/dashboard/DashboardActionCard.tsx`

---

## Acceptance Criteria

- [ ] DashboardActionCard component created
- [ ] All three dashboard buttons use the component
- [ ] Visual appearance unchanged
- [ ] Hover effects and animations preserved
- [ ] Pending badge functionality preserved
- [ ] data-tour attributes preserved
- [ ] Tests added for the new component
