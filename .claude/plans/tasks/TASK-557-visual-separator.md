# Task TASK-557: Add Visual Separator Between Status Domains

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Add a visual separator in the filter tabs between local transaction statuses and submission statuses for clearer UX.

## Non-Goals

- Do NOT change filter functionality
- Do NOT reorder filter tabs
- Do NOT add new filters

## Deliverables

1. Update: Filter component - Add visual divider between status groups

## Acceptance Criteria

- [ ] Visual separator between Local (All/Active/Closed) and Submission (Submitted/Under Review/etc.) groups
- [ ] Separator is subtle but noticeable
- [ ] Maintains existing filter functionality
- [ ] Responsive on different screen sizes
- [ ] `npm run type-check` passes

## Implementation Notes

### Desired Layout

```
[All] [Active] [Closed] | [Submitted] [Under Review] [Needs Changes] [Approved]
                        ^
                     separator
```

### Separator Options

1. **Vertical divider** - `|` or `<span>|</span>` with styling
2. **CSS border** - `border-left` on first submission tab
3. **Spacing gap** - Larger margin between groups

### Example CSS

```css
.filter-separator {
  display: inline-block;
  width: 1px;
  height: 20px;
  background-color: #e5e7eb; /* gray-200 */
  margin: 0 12px;
  vertical-align: middle;
}
```

Or with Tailwind:
```tsx
<span className="inline-block w-px h-5 bg-gray-200 mx-3 align-middle" />
```

## Integration Notes

- Depends on: TASK-556 (all filter tabs present)
- No conflicts (pure styling)

## Do / Don't

### Do:
- Use consistent styling with app design system
- Test responsive behavior
- Ensure separator doesn't break on narrow screens

### Don't:
- Change filter behavior
- Add semantic meaning to separator (it's purely visual)

## When to Stop and Ask

- If filter tabs are dynamically generated and separator placement is complex
- If design system has a specific divider component to use

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (visual change only)

### CI Requirements

- [ ] Type checking passes
- [ ] Lint passes

## PR Preparation

- **Title**: `style(filters): add visual separator between status domains`
- **Labels**: `ui`, `style`
- **Depends on**: TASK-556

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~4K-6K

**Token Cap:** 24K (4x upper estimate)

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Verification

- [ ] Separator visible
- [ ] Styling matches design
- [ ] Responsive

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
