# BACKLOG-471: Move Edit Button from Header to Summary Section

## Summary

Move the main "Edit" button from the transaction details header to be inline with the Summary section, similar to how "Edit Contacts" is positioned.

## Category

UX / UI

## Priority

P2 - Medium

## Description

### Current State

The Edit button is in the header area:
```html
<button class="px-4 py-2 rounded-lg font-semibold ... bg-white text-gray-600">
  <svg>...</svg>
  Edit
</button>
```

### Expected

Move Edit button to be inline with the Summary section header, similar to Edit Contacts:
```html
<button class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors">
  <svg>...</svg>
  Edit
</button>
```

This creates a consistent pattern where edit actions are next to the section they edit.

## Acceptance Criteria

- [ ] Edit button removed from transaction details header
- [ ] Edit button added inline with Summary section header
- [ ] Styling matches "Edit Contacts" button pattern
- [ ] Click behavior unchanged (opens Edit Transaction modal)

## Files to Modify

- `src/components/TransactionDetails.tsx` or similar
- Look for the Edit button in header and move to Summary section

## Estimated Effort

~3K tokens
