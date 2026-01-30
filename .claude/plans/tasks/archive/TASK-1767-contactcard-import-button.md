# TASK-1767: ContactCard with Source Pill and Import Button

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 4 - Contacts Page Redesign
**Branch:** `feature/task-1767-contactcard-import-button`
**Estimated Tokens:** ~15K
**Depends On:** TASK-1762 (ContactRow patterns)

---

## Objective

Update the ContactCard component used on the Contacts page to:
- Display source pill (Imported/External/Message)
- Show [+] import button for external contacts only
- Support external contact type

This enables the Contacts page to show a mixed list of imported and external contacts.

---

## Context

The current ContactCard component shows contact details in a card layout with a source badge. This task updates it to:
- Use the new SourcePill component for consistency
- Add an import button [+] for external contacts (contacts not yet in Magic Audit)
- Handle the ExternalContact type in addition to ExtendedContact

The Contacts page (Flow 3) will show all contacts from both:
- The Magic Audit database (imported)
- The macOS Address Book (external, not yet imported)

---

## Requirements

### Must Do:
1. Update ContactCard to use SourcePill component
2. Add optional [+] import button for external contacts
3. Support both ExtendedContact and ExternalContact types
4. Import button calls onImport callback (doesn't import directly)
5. Import button only shows for external contacts
6. Maintain existing card click behavior (opens details)
7. Update unit tests

### Must NOT Do:
- Do not implement actual import logic (just call callback)
- Do not change the card layout significantly (preserve existing design)
- Do not add selection/checkbox (that's for list view)

---

## Acceptance Criteria

- [ ] ContactCard displays SourcePill instead of old source badge
- [ ] Import button [+] appears for external contacts
- [ ] Import button does NOT appear for imported contacts
- [ ] Clicking import button calls onImport callback
- [ ] Clicking import button does NOT trigger card click
- [ ] Card click still works for opening details
- [ ] Card works with both ExtendedContact and ExternalContact types
- [ ] Tests pass for all scenarios

---

## Technical Specification

### Updated Component Interface

```tsx
// src/components/contact/components/ContactCard.tsx

import type { ExtendedContact } from '../types';

export interface ExternalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source: 'external';
}

export interface ContactCardProps {
  /** Contact data (imported or external) */
  contact: ExtendedContact | ExternalContact;
  /** Callback when card is clicked */
  onClick: (contact: ExtendedContact | ExternalContact) => void;
  /** Callback when import button is clicked (external only) */
  onImport?: (contact: ExternalContact) => void;
}
```

### Visual Layout

```
+------------------+
| [Avatar] Name    |
|          [Pill]  |
|                  |
| email@domain.com |
| +1-555-1234      |
| Company Name     |
|                  |
| [External] [+]   |  <- Source pill + import button for external
+------------------+

OR for imported:

+------------------+
| [Avatar] Name    |
|          [Pill]  |
|                  |
| email@domain.com |
| +1-555-1234      |
| Company Name     |
|                  |
| [Imported]       |  <- Source pill only, no import button
+------------------+
```

### Implementation Sketch

```tsx
import React from 'react';
import { SourcePill, type ContactSource } from '../../shared/SourcePill';

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

export interface ContactCardProps {
  contact: ExtendedContact | ExternalContact;
  onClick: (contact: ExtendedContact | ExternalContact) => void;
  onImport?: (contact: ExternalContact) => void;
}

function ContactCard({ contact, onClick, onImport }: ContactCardProps) {
  const source = (contact.source || 'imported') as ContactSource;
  const isExternal = source === 'external';
  const displayName = contact.display_name || contact.name || 'Unknown';

  const handleImportClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (isExternal && onImport) {
      onImport(contact as ExternalContact);
    }
  };

  return (
    <div
      onClick={() => onClick(contact)}
      className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-purple-400 hover:shadow-xl transition-all flex flex-col h-full cursor-pointer"
      data-testid={`contact-card-${contact.id}`}
    >
      {/* Contact Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{displayName}</h3>
            <SourcePill source={source} size="sm" />
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="space-y-2 mb-4 text-sm flex-1">
        {/* Email(s) */}
        {renderEmails(contact)}

        {/* Phone(s) */}
        {renderPhones(contact)}

        {/* Company */}
        {contact.company && (
          <div className="flex items-center gap-2 text-gray-600">
            <BuildingIcon />
            <span className="truncate">{contact.company}</span>
          </div>
        )}

        {/* Title */}
        {contact.title && (
          <div className="flex items-center gap-2 text-gray-600">
            <BriefcaseIcon />
            <span className="truncate">{contact.title}</span>
          </div>
        )}
      </div>

      {/* Footer with import button for external contacts */}
      {isExternal && onImport && (
        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleImportClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            data-testid={`import-button-${contact.id}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Import
          </button>
        </div>
      )}
    </div>
  );
}

// Helper functions for rendering multiple emails/phones
function renderEmails(contact: ExtendedContact | ExternalContact) {
  const emails = contact.allEmails?.length ? contact.allEmails : contact.email ? [contact.email] : [];
  return emails.map((email, idx) => (
    <div key={`email-${idx}`} className="flex items-center gap-2 text-gray-600">
      <EmailIcon />
      <span className="truncate">{email}</span>
    </div>
  ));
}

function renderPhones(contact: ExtendedContact | ExternalContact) {
  const phones = contact.allPhones?.length ? contact.allPhones : contact.phone ? [contact.phone] : [];
  return phones.map((phone, idx) => (
    <div key={`phone-${idx}`} className="flex items-center gap-2 text-gray-600">
      <PhoneIcon />
      <span>{phone}</span>
    </div>
  ));
}

export default ContactCard;
```

---

## Files to Modify

- **Modify:** `src/components/contact/components/ContactCard.tsx` - Add SourcePill, import button
- **Modify:** `src/components/contact/components/ContactCard.test.tsx` - Update tests (if exists)

## Files to Read (for context)

- `src/components/shared/SourcePill.tsx` - Dependency (TASK-1761)
- `src/components/contact/types.ts` - ExtendedContact type, getSourceBadge (being replaced)
- `src/components/Contacts.tsx` - Parent component using ContactCard

---

## Testing Expectations

### Unit Tests

**Required:** Yes

```tsx
describe('ContactCard', () => {
  describe('source pill', () => {
    it('shows [Imported] pill for imported contacts', () => {});
    it('shows [External] pill for external contacts', () => {});
    it('shows [Message] pill for sms source contacts', () => {});
  });

  describe('import button', () => {
    it('shows import button for external contacts when onImport provided', () => {});
    it('hides import button for imported contacts', () => {});
    it('hides import button when onImport not provided', () => {});
    it('calls onImport when import button clicked', () => {});
    it('does not call onClick when import button clicked', () => {});
  });

  describe('card click', () => {
    it('calls onClick when card is clicked', () => {});
    it('passes contact to onClick callback', () => {});
  });

  describe('contact display', () => {
    it('displays contact name', () => {});
    it('displays avatar with initial', () => {});
    it('displays email(s)', () => {});
    it('displays phone(s)', () => {});
    it('displays company if present', () => {});
    it('handles missing optional fields gracefully', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add source pill and import button to ContactCard (TASK-1767)`
- **Branch:** `feature/task-1767-contactcard-import-button`
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
- [ ] Verified TASK-1762 is merged (uses similar patterns)
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

- **Before**: ContactCard with old source badge, no import button
- **After**: ContactCard with SourcePill and import button for external
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~15K)
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
- The SourcePill component (TASK-1761) is not available
- You need to significantly change the card layout
- The ExternalContact type doesn't match what's expected
- You encounter issues with the existing getSourceBadge function being removed
