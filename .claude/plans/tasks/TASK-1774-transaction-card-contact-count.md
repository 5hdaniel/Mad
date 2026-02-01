# TASK-1774: Add Contact Count Display to Transaction Cards

**Backlog Item:** BACKLOG-570
**Sprint:** SPRINT-066 (Contact Management UX Overhaul)
**Status:** pending
**Estimated Tokens:** ~10K
**Priority:** P2

---

## Objective

Add a contact count indicator to transaction cards, matching the existing pattern for text and email thread counts.

## Context

Transaction cards currently show "X Text threads" and "X Email threads" with icons. Users want to see how many contacts are associated with each transaction at a glance, using the same visual style.

---

## Implementation Plan

### Phase 1: Backend - Add contact_count Field

**File:** `electron/types/models.ts`

Add to Transaction interface (around line 520, near other count fields):
```typescript
/** Count of contacts/participants linked to this transaction */
contact_count?: number;
```

**File:** `electron/services/transactionService.ts`

Update the transaction query to include contact count. Look for where transactions are loaded and add a subquery or JOIN to count participants.

Option A - Subquery in SELECT:
```sql
SELECT t.*,
  (SELECT COUNT(*) FROM transaction_participants tp WHERE tp.transaction_id = t.id) as contact_count
FROM transactions t
```

Option B - Compute after query using existing transaction_participants data.

### Phase 2: Frontend - TransactionCard Component

**File:** `src/components/transaction/components/TransactionCard.tsx`

1. Add ContactsIcon after EmailsIcon (around line 40):
```tsx
/** Users icon for contacts - matches TransactionTabs style */
const ContactsIcon = (): React.ReactElement => (
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
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);
```

2. Add optional onContactsClick prop to TransactionCardProps (around line 85):
```typescript
/** Handler for clicking the contacts count - opens contacts section */
onContactsClick?: (e: React.MouseEvent) => void;
```

3. Add contact count display after emails button (around line 223):
```tsx
<button
  onClick={onContactsClick}
  className="flex items-center gap-1 hover:text-blue-600 transition-colors"
  title="View contacts"
>
  <ContactsIcon />
  <span>{contactCount} {contactCount === 1 ? "Contact" : "Contacts"}</span>
</button>
```

4. Get contactCount from transaction:
```tsx
const contactCount = transaction.contact_count || 0;
```

### Phase 3: Frontend - TransactionListCard Component

**File:** `src/components/transaction/components/TransactionListCard.tsx`

Apply the same changes:
1. Add ContactsIcon SVG
2. Add onContactsClick prop to TransactionListCardProps
3. Add contacts display button after emails

---

## Acceptance Criteria

- [ ] Transaction type includes `contact_count?: number`
- [ ] Transaction queries populate contact_count from transaction_participants
- [ ] TransactionCard shows "X Contact(s)" with users icon
- [ ] TransactionListCard shows "X Contact(s)" with users icon
- [ ] Proper singular/plural handling (1 Contact, 2 Contacts)
- [ ] Click handler prop available (optional - can be undefined)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] All existing tests pass

---

## Testing Requirements

### Manual Testing
1. Load transaction list - verify contact counts appear
2. Check transactions with 0, 1, and multiple contacts
3. Verify singular/plural grammar
4. Verify hover state on button
5. Click contact count button (if handler provided)

### Unit Tests (Optional)
- Test ContactsIcon renders correctly
- Test singular/plural formatting

---

## Branch Information

**Branch From:** `sprint-066-contact-ux-overhaul` (current sprint branch)
**Branch Into:** `sprint-066-contact-ux-overhaul`
**Branch Name:** `feature/task-1774-contact-count-display`

---

## Notes

- This follows the exact pattern established by BACKLOG-396 for text_thread_count
- The icon uses the Heroicons "user-group" pattern for visual consistency
- Contact count comes from transaction_participants table (existing relationship)
- No new database tables or migrations required - just query changes
