# BACKLOG-445: Remove Email from Transaction Buttons Not Working

## Summary

The buttons to remove an email from a transaction are not functioning. Both the inline icon button and the "Remove from Transaction" button fail silently when clicked.

## Category

Bug / UI

## Priority

P1 - High (Core functionality broken)

## Description

### Problem

Two buttons exist to remove emails from a transaction, and neither works:

**1. Inline Icon Button (on email card):**
```html
<button class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
        title="Remove this email from transaction">
  <svg><!-- X/ban icon --></svg>
</button>
```

**2. Menu/Modal Button:**
```html
<button class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium">
  <svg><!-- X/ban icon --></svg>
  Remove from Transaction
</button>
```

**Behavior:**
- Clicking either button does nothing
- No error in console (silent failure)
- No confirmation dialog
- Email remains in transaction

### Expected Behavior

1. Click "Remove from Transaction"
2. Confirmation dialog: "Remove this email from the transaction?"
3. On confirm: Email is unlinked from transaction
4. UI updates to reflect removal
5. Success toast: "Email removed from transaction"

### Possible Causes

1. Click handler not attached
2. Click handler attached but not calling API
3. API call failing silently
4. State not updating after successful removal

### Debug Steps

Check in DevTools console when clicking:
```javascript
// Is there a click handler?
// Check for errors in console
// Check Network tab for API calls
```

## Acceptance Criteria

- [ ] Inline remove button removes email from transaction
- [ ] "Remove from Transaction" button removes email
- [ ] Confirmation dialog shown before removal
- [ ] API call made to unlink email
- [ ] UI updates immediately after removal
- [ ] Success/error feedback shown to user
- [ ] Email can be re-added after removal

## Estimated Effort

~8K tokens

## Dependencies

None

## Related Items

- Email/message list component
- Transaction-message association
- Communications table
