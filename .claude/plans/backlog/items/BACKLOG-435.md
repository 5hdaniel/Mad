# BACKLOG-435: Contact Card View Details & Edit Button

## Summary

Add a button to contact cards that opens a detail view showing all contact information, with an edit button allowing users to modify contact details.

## Category

Enhancement / UX

## Priority

P2 - Medium (Useful feature for contact management)

## Description

### Problem

Currently, contact cards show limited information and users cannot:
1. View all details of a contact in one place
2. Edit contact information directly from the card

Users need to be able to see complete contact details (all emails, phones, notes, etc.) and make corrections or updates when needed.

### Proposed Solution

#### 1. View Details Button on Contact Card
- Add a "View" or info icon button to each contact card
- Opens a modal or slide-out panel with full contact details
- Display all available information:
  - Name / Display name
  - All email addresses
  - All phone numbers
  - Role/relationship
  - Company/organization
  - Notes
  - Associated transactions
  - Communication history summary

#### 2. Edit Button in Detail View
- Add "Edit" button in the contact detail view
- Opens edit mode or edit form
- Allow editing:
  - Name fields
  - Add/remove/edit emails
  - Add/remove/edit phone numbers
  - Role/relationship
  - Notes
- Save/Cancel buttons
- Validation for email/phone formats

#### 3. UI Mockup

**Contact Card:**
```
┌─────────────────────────────────────────┐
│ [Avatar] John Smith                     │
│          john@email.com | +1234567890   │
│          Buyer (Client)          [👁] [✎]│
└─────────────────────────────────────────┘
```

**Detail Modal:**
```
┌─────────────────────────────────────────┐
│ Contact Details                    [✎]  │
├─────────────────────────────────────────┤
│ Name: John Smith                        │
│ Display: Johnny                         │
│                                         │
│ Emails:                                 │
│   • john@email.com (primary)            │
│   • jsmith@work.com                     │
│                                         │
│ Phones:                                 │
│   • +1 (234) 567-8900 (mobile)         │
│   • +1 (234) 567-8901 (work)           │
│                                         │
│ Role: Buyer (Client)                    │
│ Company: ABC Realty                     │
│                                         │
│ Notes:                                  │
│   Prefers text over email               │
│                                         │
│ Transactions: 3                         │
└─────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Contact cards have a "View Details" button/icon
- [ ] Clicking opens a modal/panel with full contact info
- [ ] All contact fields displayed (emails, phones, notes, etc.)
- [ ] Edit button available in detail view
- [ ] Edit mode allows modifying all editable fields
- [ ] Can add/remove multiple emails and phones
- [ ] Save persists changes to database
- [ ] Cancel discards changes
- [ ] Validation for email and phone formats
- [ ] Works in transaction detail view contact list
- [ ] Works in contacts management screen (if exists)

## Estimated Effort

~20K tokens

## Dependencies

None

## Related Items

- BACKLOG-432: Unified Contact Selection
- Contact card components
- Contact management
