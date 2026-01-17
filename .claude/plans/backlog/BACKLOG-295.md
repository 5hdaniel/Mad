# BACKLOG-295: Transaction Details Header Responsive Layout

**Priority:** Medium
**Type:** UI Enhancement
**Category:** Responsive Design
**Created:** 2026-01-17
**Status:** Completed
**Sprint:** SPRINT-040
**Task:** TASK-1108
**PR:** #449

---

## Problem Statement

On narrow viewports, the Transaction Details panel header becomes cramped with overlapping UI elements. The current layout places the title/address and action buttons on the same row, which causes usability issues when horizontal space is limited.

---

## Current Behavior

The header uses a single-row `flex items-center justify-between` layout:

```
[Transaction Details] [Address] [Edit] [Reject] [Export] [X]
```

All elements are inline, leading to:
- Cramped buttons on narrow screens
- Potential text truncation or overlap
- Poor touch target spacing on smaller devices

---

## Desired Behavior

On narrow viewports, the header should stack vertically into two rows:

**Top Row:**
```
[Transaction Details Title] [Address] [X (close)]
```

**Bottom Row:**
```
[Edit] [Reject] [Export]
```

This provides:
- Better button spacing and touch targets
- Preserved title/address visibility
- Close button remains accessible in top-right

---

## Technical Analysis

### Affected Component

**File:** `src/components/transactionDetailsModule/components/TransactionHeader.tsx`

### Current Structure (lines 58-124)

```tsx
<div className={`flex-shrink-0 px-6 py-4 flex items-center justify-between rounded-t-xl ${getHeaderStyle()}`}>
  {/* Left side: Title + Address */}
  <div>
    <div className="flex items-center gap-2">
      <h3 className="text-xl font-bold text-white">{getHeaderTitle()}</h3>
      {/* Status badges */}
    </div>
    <p className={`text-sm ${getHeaderTextStyle()}`}>{transaction.property_address}</p>
  </div>

  {/* Right side: Action buttons + Close */}
  <div className="flex items-center gap-2">
    {/* Conditional action buttons (Edit/Reject/Export/etc) */}
    <button onClick={onClose}>X</button>
  </div>
</div>
```

### Proposed Solution

Use Tailwind responsive utilities to switch layouts:

1. Wrap the entire header in a responsive container:
   - Default (mobile): `flex-col` with stacked rows
   - Wide screens (`md:` or `lg:`): `flex-row items-center justify-between`

2. Restructure action buttons section:
   - Move close button to the title row (right side)
   - Action buttons in their own row on narrow viewports

3. Consider breakpoints:
   - `sm:` (640px) or `md:` (768px) as the transition point

### Alternative Approaches

1. **CSS-only with flex-wrap**: Use `flex-wrap` and let items naturally wrap
2. **Drawer/dropdown for actions**: Collapse actions into a menu on narrow viewports
3. **Fixed breakpoint stacking**: Explicit layout change at specific width (recommended)

---

## Acceptance Criteria

- [ ] Header layout stacks vertically on narrow viewports (< 768px recommended)
- [ ] Top row contains: title, status badge, address, and close button
- [ ] Bottom row contains: action buttons (Edit, Reject, Export, etc.)
- [ ] Layout returns to single-row on wider viewports
- [ ] Close button remains in top-right corner at all viewport sizes
- [ ] No visual regressions on desktop/wide screens
- [ ] Buttons maintain adequate touch target size (min 44x44px recommended)
- [ ] Works for all header states: active, pending review, rejected

---

## Estimated Effort

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Layout refactor | 2-3 | ~8K | 15m |
| Responsive utilities | 1-2 | ~4K | 10m |
| State variations testing | 1-2 | ~4K | 10m |
| Visual QA | 1 | ~2K | 5m |
| **Total** | **5-8** | **~18K** | **~40m** |

---

## Dependencies

- None (isolated UI component change)

---

## Testing Requirements

### Manual Testing
- Resize browser to verify breakpoint behavior
- Test all header states (active, pending review, rejected)
- Verify button functionality preserved after layout change
- Check on actual narrow devices if available

### Visual Testing
- Screenshot comparison at various viewport widths
- Verify no overlap or truncation at edge cases

---

## References

- Component: `src/components/transactionDetailsModule/components/TransactionHeader.tsx`
- Tailwind responsive docs: https://tailwindcss.com/docs/responsive-design
- Related: Transaction details panel styling

---

## Notes

Consider coordinating with other responsive improvements if planned (e.g., sidebar collapse, mobile navigation) to ensure consistent breakpoint usage across the application.
