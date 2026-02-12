# BACKLOG-576: Responsive Icon-Only Buttons for Overview Tab

## Summary
Make section action buttons in Overview tab show icon-only on small screens, with text on larger screens.

## Buttons Affected
- **Edit Summary** (next to Summary heading)
- **Sync Communications** (next to Key Contacts heading)
- **Edit Contacts** (next to Key Contacts heading)

## Implementation
- Added `hidden sm:inline` to button text spans
- Adjusted padding: `p-1.5 sm:px-3 sm:py-1.5`
- Added `title` attribute for tooltip on hover

## Layout Behavior
**Small screens (< 640px):**
```
Summary                    [pencil icon]
Key Contacts     [sync icon] [pencil icon]
```

**Larger screens (≥ 640px):**
```
Summary                         [Edit Summary]
Key Contacts          [Sync] [Edit Contacts]
```

## Files Modified
- `src/components/transactionDetailsModule/components/TransactionDetailsTab.tsx`

## Status
Completed - Sprint 066
