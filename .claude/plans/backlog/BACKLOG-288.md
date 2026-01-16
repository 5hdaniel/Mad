# BACKLOG-288: Simplify Dashboard Button Labels

## Category
UI/UX

## Priority
Low

## Status
Pending

## Description

The dashboard buttons have verbose labels that could be simplified for a cleaner UI:

### Label Changes

| Current Label | New Label |
|---------------|-----------|
| Start New Audit | New Audit |
| Browse Transactions | All Audits |
| Manage Contacts | Contacts |

### Layout Changes

1. **Remove redundant action text**: Remove the `<span>View All</span>` and `<span>Start Audit</span>` text from button footers
2. **Keep arrow icon**: Retain the chevron arrow SVG icon (`<svg>...<path d="M9 5l7 7-7 7"></path></svg>`)
3. **Move arrow next to heading**: Place the arrow icon directly next to the h2 heading (e.g., "New Audit →") instead of in the footer

### Visual Result

Before:
```
┌─────────────────────┐
│ Start New Audit     │
│ description text    │
│ [Start Audit →]     │  ← remove this footer text, keep arrow
└─────────────────────┘
```

After:
```
┌─────────────────────┐
│ New Audit →         │  ← arrow next to heading
│ description text    │
└─────────────────────┘
```

## Rationale

- Shorter labels reduce visual clutter
- "Start" is redundant - clicking a button implies starting
- "Browse" and "Manage" are unnecessary verbs
- "Transactions" should be "Audits" for consistency with domain terminology
- Footer action text is redundant when the whole card is clickable
- Arrow icon provides clear affordance that the card is clickable

## Acceptance Criteria

- [ ] "Start New Audit" heading displays "New Audit"
- [ ] "Browse Transactions" heading displays "All Audits"
- [ ] "Manage Contacts" heading displays "Contacts"
- [ ] "View All" and "Start Audit" span text removed from footers
- [ ] Arrow SVG icon moved next to the h2 heading
- [ ] Button functionality remains unchanged
- [ ] Accessibility labels updated if different from display text

## Files Likely Involved

- `src/components/Dashboard.tsx` or similar dashboard component
- Any i18n/localization files if applicable

## Implementation Notes

- Simple text change, no logic changes needed
- Consider updating any tooltips or aria-labels as well

## Related

- Dashboard UI
- User experience improvements

## Created
2026-01-15

## Reported By
User (feedback)
