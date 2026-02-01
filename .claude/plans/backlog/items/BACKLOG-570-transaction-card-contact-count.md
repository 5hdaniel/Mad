# BACKLOG-570: Add Contact Count to Transaction Cards

**Status:** in_progress
**Priority:** P2 (Enhancement)
**Type:** Feature
**Sprint:** SPRINT-066
**Created:** 2026-01-31
**Updated:** 2026-01-31

---

## Summary

Add a contact count display to transaction cards/rows, matching the existing style used for text and email thread counts.

## Current State

Transaction cards currently display:
- Text thread count with message icon (e.g., "2 Text threads")
- Email thread count with envelope icon (e.g., "0 Email threads")

```html
<div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
  <button>... Text threads ...</button>
  <button>... Email threads ...</button>
</div>
```

## Desired State

Add a third element for contacts:
- Contact count with person/users icon (e.g., "3 Contacts")

```html
<div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
  <button>... Text threads ...</button>
  <button>... Email threads ...</button>
  <button>... Contacts ...</button>  <!-- NEW -->
</div>
```

## Implementation Details

### Backend Changes

1. **Add `contact_count` field to Transaction type** (`electron/types/models.ts`)
   - Similar to existing `text_thread_count` and `email_count` fields
   - Stored field for consistent display

2. **Populate contact_count when loading transactions**
   - Count from `transaction_participants` table
   - Update in `transactionService.ts` or relevant query

3. **Add migration if needed** (or update existing queries to compute)

### Frontend Changes

1. **TransactionCard.tsx** (`src/components/transaction/components/TransactionCard.tsx`)
   - Add ContactsIcon SVG (person/users icon)
   - Add contacts count display button after emails
   - Add `onContactsClick` handler prop (optional)

2. **TransactionListCard.tsx** (`src/components/transaction/components/TransactionListCard.tsx`)
   - Same changes as TransactionCard.tsx

### Icon Design

Use a person/users icon consistent with the app's design system:
```tsx
const ContactsIcon = (): React.ReactElement => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);
```

## Acceptance Criteria

- [ ] Contact count appears on transaction cards next to email/text counts
- [ ] Uses consistent styling (same text-xs text-gray-500, same gap)
- [ ] Icon matches the visual style of MessagesIcon and EmailsIcon
- [ ] Singular/plural grammar handled correctly ("1 Contact" vs "3 Contacts")
- [ ] Click handler opens contacts modal or scrolls to contacts section (optional)
- [ ] Works on both TransactionCard and TransactionListCard components

## Files to Modify

| File | Changes |
|------|---------|
| `electron/types/models.ts` | Add `contact_count?: number` to Transaction interface |
| `electron/services/transactionService.ts` | Populate contact_count in queries |
| `src/components/transaction/components/TransactionCard.tsx` | Add icon + display |
| `src/components/transaction/components/TransactionListCard.tsx` | Add icon + display |

## Estimated Effort

~10K tokens (small UI enhancement with minor backend changes)

## Related

- BACKLOG-396: text_thread_count implementation (similar pattern)
- SPRINT-066: Contact Management UX Overhaul (current sprint)
