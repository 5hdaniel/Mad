# TASK-1768: ContactPreview Modal

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 4 - Contacts Page Redesign
**Branch:** `feature/task-1768-contactpreview-modal`
**Estimated Tokens:** ~18K
**Depends On:** TASK-1767 (ContactCard)

---

## Objective

Create a ContactPreview modal/panel that displays full contact details when a contact card is clicked on the Contacts page. The preview shows:
- Full contact information (name, email, phone, company)
- Source indicator
- Transaction history (for imported contacts)
- Action button: "Edit Contact" for imported, "Import to Software" for external

---

## Context

The Contacts page redesign (Flow 3) requires a preview panel when users click on a contact card. This provides:
- Quick view of contact details without navigating away
- Transaction history showing which deals the contact is involved in
- Contextual actions based on contact source

The existing `ContactDetailsModal` has similar functionality but this creates a lighter-weight preview focused on quick information display.

---

## Requirements

### Must Do:
1. Create `ContactPreview.tsx` component in `src/components/shared/`
2. Display full contact details (avatar, name, email, phone, company, title)
3. Show source pill (Imported/External)
4. For imported contacts: show transaction list with roles
5. For external contacts: show "Not yet imported" message
6. "Edit Contact" button for imported contacts (calls onEdit)
7. "Import to Software" button for external contacts (calls onImport)
8. Close button and backdrop click to dismiss
9. Write unit tests

### Must NOT Do:
- Do not implement actual edit/import functionality (just call callbacks)
- Do not fetch transaction data (receive as props)
- Do not duplicate the full ContactDetailsModal (this is a preview, not full editor)

---

## Acceptance Criteria

- [ ] ContactPreview displays as modal/overlay
- [ ] Shows large avatar with contact initial
- [ ] Displays name, email(s), phone(s), company, title
- [ ] Shows SourcePill with correct variant
- [ ] For imported: shows transaction list (address + role)
- [ ] For external: shows "Not yet imported to Magic Audit"
- [ ] "Edit Contact" button appears for imported contacts
- [ ] "Import to Software" button appears for external contacts
- [ ] Clicking action button calls appropriate callback
- [ ] Close button dismisses the preview
- [ ] Clicking backdrop dismisses the preview
- [ ] Tests pass for all scenarios

---

## Technical Specification

### Component Interface

```tsx
// src/components/shared/ContactPreview.tsx

import type { ExtendedContact } from '../../types/components';

export interface ExternalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  source: 'external';
  allEmails?: string[];
  allPhones?: string[];
}

export interface ContactTransaction {
  id: string;
  property_address: string;
  role: string;
}

export interface ContactPreviewProps {
  /** Contact to display (imported or external) */
  contact: ExtendedContact | ExternalContact;
  /** Whether this is an external contact */
  isExternal: boolean;
  /** Transactions this contact is involved in (imported only) */
  transactions?: ContactTransaction[];
  /** Loading state for transactions */
  isLoadingTransactions?: boolean;
  /** Callback to edit the contact (imported only) */
  onEdit?: () => void;
  /** Callback to import the contact (external only) */
  onImport?: () => void;
  /** Callback to close the preview */
  onClose: () => void;
}

export function ContactPreview(props: ContactPreviewProps): React.ReactElement;
```

### Visual Layout

```
+----------------------------------------------------------+
|                                               [X] Close  |
+----------------------------------------------------------+
|                                                          |
|                    [Large Avatar]                        |
|                       (64x64)                            |
|                                                          |
|                     John Smith                           |
|                                                          |
|          john@email.com | +1-555-1234                    |
|                    ABC Realty                            |
|                   Sales Manager                          |
|                                                          |
|                     [Imported]                           |
|                                                          |
+----------------------------------------------------------+
| Transactions:                                            |
|                                                          |
| 123 Main St ............................ Buyer           |
| 456 Oak Ave ............................ Seller Agent   |
| 789 Elm Blvd ........................... Transaction Co |
|                                                          |
+----------------------------------------------------------+
|                                       [Edit Contact]     |
+----------------------------------------------------------+

OR for external:

+----------------------------------------------------------+
|                                               [X] Close  |
+----------------------------------------------------------+
|                                                          |
|                    [Large Avatar]                        |
|                       (64x64)                            |
|                                                          |
|                     Bob Wilson                           |
|                                                          |
|           bob@work.com | +1-310-555-6789                 |
|                     XYZ Corp                             |
|                                                          |
|                     [External]                           |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| Not yet imported to Magic Audit                          |
| Import this contact to assign them to transactions.      |
|                                                          |
+----------------------------------------------------------+
|                                    [Import to Software]  |
+----------------------------------------------------------+
```

### Implementation Sketch

```tsx
import React from 'react';
import { SourcePill, type ContactSource } from './SourcePill';
import type { ExtendedContact } from '../../types/components';

// ... interfaces defined above

export function ContactPreview({
  contact,
  isExternal,
  transactions = [],
  isLoadingTransactions = false,
  onEdit,
  onImport,
  onClose,
}: ContactPreviewProps): React.ReactElement {
  const displayName = contact.display_name || contact.name || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();
  const source = (contact.source || 'imported') as ContactSource;

  // Collect emails and phones
  const emails = contact.allEmails?.length ? contact.allEmails : contact.email ? [contact.email] : [];
  const phones = contact.allPhones?.length ? contact.allPhones : contact.phone ? [contact.phone] : [];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="contact-preview-backdrop"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        data-testid="contact-preview-modal"
      >
        {/* Header with close button */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close preview"
            data-testid="contact-preview-close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contact Info Section */}
        <div className="px-6 pb-6 text-center">
          {/* Large Avatar */}
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            {initial}
          </div>

          {/* Name */}
          <h2 className="text-xl font-bold text-gray-900 mb-2">{displayName}</h2>

          {/* Contact Details */}
          <div className="text-gray-600 space-y-1 mb-4">
            {emails.length > 0 && (
              <p>{emails.join(' | ')}</p>
            )}
            {phones.length > 0 && (
              <p>{phones.join(' | ')}</p>
            )}
            {contact.company && (
              <p className="font-medium">{contact.company}</p>
            )}
            {contact.title && (
              <p className="text-sm">{contact.title}</p>
            )}
          </div>

          {/* Source Pill */}
          <SourcePill source={source} size="md" />
        </div>

        {/* Transactions Section (imported only) */}
        <div className="flex-1 overflow-y-auto border-t border-gray-200 px-6 py-4">
          {isExternal ? (
            <div className="text-center text-gray-500 py-4">
              <p className="font-medium mb-1">Not yet imported to Magic Audit</p>
              <p className="text-sm">Import this contact to assign them to transactions.</p>
            </div>
          ) : isLoadingTransactions ? (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <p>No transactions yet</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Transactions</h3>
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-900 truncate flex-1">{txn.property_address}</span>
                    <span className="text-gray-500 ml-2 flex-shrink-0">{txn.role}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer with Action Button */}
        <div className="border-t border-gray-200 p-4 flex justify-end">
          {isExternal ? (
            <button
              onClick={onImport}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md"
              data-testid="contact-preview-import"
            >
              Import to Software
            </button>
          ) : (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all shadow-md"
              data-testid="contact-preview-edit"
            >
              Edit Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactPreview;
```

### Integration with Contacts Page

```tsx
// In Contacts.tsx
const [previewContact, setPreviewContact] = useState<ExtendedContact | ExternalContact | null>(null);
const [previewTransactions, setPreviewTransactions] = useState<ContactTransaction[]>([]);
const [loadingTransactions, setLoadingTransactions] = useState(false);

const handleCardClick = async (contact: ExtendedContact | ExternalContact) => {
  setPreviewContact(contact);

  // Load transactions for imported contacts
  if (contact.source !== 'external') {
    setLoadingTransactions(true);
    try {
      const result = await window.api.contacts.getTransactions(contact.id);
      if (result.success) {
        setPreviewTransactions(result.transactions);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }
};

// Render
{previewContact && (
  <ContactPreview
    contact={previewContact}
    isExternal={previewContact.source === 'external'}
    transactions={previewTransactions}
    isLoadingTransactions={loadingTransactions}
    onEdit={() => handleEditContact(previewContact)}
    onImport={() => handleImportContact(previewContact)}
    onClose={() => setPreviewContact(null)}
  />
)}
```

---

## Files to Modify

- **Create:** `src/components/shared/ContactPreview.tsx`
- **Create:** `src/components/shared/ContactPreview.test.tsx`
- **Modify:** `src/components/Contacts.tsx` - Integrate ContactPreview

## Files to Read (for context)

- `src/components/shared/SourcePill.tsx` - Dependency (TASK-1761)
- `src/components/contact/components/ContactDetailsModal.tsx` - Similar component for reference
- `src/components/Contacts.tsx` - Parent component

---

## Testing Expectations

### Unit Tests

**Required:** Yes

```tsx
describe('ContactPreview', () => {
  describe('contact info display', () => {
    it('displays contact name', () => {});
    it('displays large avatar with initial', () => {});
    it('displays email(s)', () => {});
    it('displays phone(s)', () => {});
    it('displays company if present', () => {});
    it('displays title if present', () => {});
    it('displays source pill', () => {});
  });

  describe('imported contact', () => {
    it('shows transaction list', () => {});
    it('shows "No transactions" when list is empty', () => {});
    it('shows loading spinner when loading transactions', () => {});
    it('displays "Edit Contact" button', () => {});
    it('calls onEdit when button clicked', () => {});
    it('does not show import button', () => {});
  });

  describe('external contact', () => {
    it('shows "Not yet imported" message', () => {});
    it('does not show transaction list', () => {});
    it('displays "Import to Software" button', () => {});
    it('calls onImport when button clicked', () => {});
    it('does not show edit button', () => {});
  });

  describe('dismissal', () => {
    it('calls onClose when close button clicked', () => {});
    it('calls onClose when backdrop clicked', () => {});
    it('does not close when modal content clicked', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add ContactPreview modal (TASK-1768)`
- **Branch:** `feature/task-1768-contactpreview-modal`
- **Target:** `sprint-066-contact-ux-overhaul`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from sprint-066-contact-ux-overhaul
- [ ] Verified TASK-1767 is merged
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No contact preview on Contacts page
- **After**: ContactPreview modal with details, transactions, and actions
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~18K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- TASK-1767 is not merged yet
- The transactions API doesn't exist or has different shape
- You need to add navigation to transaction details (out of scope)
- The ContactDetailsModal should be deprecated in favor of this
