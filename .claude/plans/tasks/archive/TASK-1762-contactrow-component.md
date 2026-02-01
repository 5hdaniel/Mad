# TASK-1762: ContactRow Component with SourcePill

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 1 - Core Shared Components
**Branch:** `feature/task-1762-contactrow-component`
**Estimated Tokens:** ~12K
**Depends On:** TASK-1761 (SourcePill)

---

## Objective

Create a reusable ContactRow component that displays a single contact in a horizontal row format with optional checkbox selection, source pill, and import button. This component is the building block for contact lists across all flows.

---

## Context

After TASK-1761 creates the SourcePill component, this task creates the ContactRow that combines:
- Contact avatar (initial in colored circle)
- Contact name and email
- Source pill (using SourcePill component)
- Optional checkbox for multi-select
- Optional import button [+] for external contacts

This pattern is used in:
- ContactSearchList (search/select modal)
- Contacts page list
- Edit contacts assigned list

---

## Requirements

### Must Do:
1. Create `ContactRow.tsx` component in `src/components/shared/`
2. Use SourcePill component from TASK-1761
3. Support optional checkbox for selection
4. Support optional [+] import button for external contacts
5. Display avatar, name, email in consistent layout
6. Handle click events for selection toggle
7. Write unit tests covering all states

### Must NOT Do:
- Do not implement import logic (just call callback)
- Do not manage selection state (controlled component)
- Do not add role dropdown (that's ContactRoleRow in TASK-1764)

---

## Acceptance Criteria

- [ ] ContactRow displays avatar, name, email, and source pill
- [ ] Checkbox appears when `showCheckbox` is true
- [ ] Import button appears when `showImportButton` is true AND contact is external
- [ ] Click on row (non-button area) triggers `onSelect` callback
- [ ] Click on import button triggers `onImport` callback (not `onSelect`)
- [ ] Selected state shows visual highlight (purple background)
- [ ] Component is keyboard accessible (tab, enter/space)
- [ ] Unit tests pass for all prop combinations

---

## Technical Specification

### Component Interface

```tsx
// src/components/shared/ContactRow.tsx

import type { ExtendedContact } from '../../types/components';

export interface ContactRowProps {
  /** Contact data to display */
  contact: ExtendedContact;
  /** Whether this row is currently selected */
  isSelected?: boolean;
  /** Show checkbox on the left */
  showCheckbox?: boolean;
  /** Show [+] import button for external contacts */
  showImportButton?: boolean;
  /** Callback when row is clicked/selected */
  onSelect?: () => void;
  /** Callback when import button is clicked */
  onImport?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function ContactRow(props: ContactRowProps): React.ReactElement;
```

### Visual Layout

```
[Checkbox?] [Avatar] [Name/Email stack] [SourcePill] [+Import?]
            (32x32)  Name (bold)
                     email@domain.com (gray, smaller)
```

### Determining Source

```typescript
// Contact source mapping
function getContactSource(contact: ExtendedContact): ContactSource {
  // If contact has source field, use it
  if (contact.source) {
    return contact.source as ContactSource;
  }
  // Default to 'imported' for contacts in database
  return 'imported';
}

// External contacts can be identified by:
// - source === 'external'
// - Or a flag like is_external: true
```

### Implementation Sketch

```tsx
import React from 'react';
import { SourcePill, type ContactSource } from './SourcePill';
import type { ExtendedContact } from '../../types/components';

export interface ContactRowProps {
  contact: ExtendedContact;
  isSelected?: boolean;
  showCheckbox?: boolean;
  showImportButton?: boolean;
  onSelect?: () => void;
  onImport?: () => void;
  className?: string;
}

export function ContactRow({
  contact,
  isSelected = false,
  showCheckbox = false,
  showImportButton = false,
  onSelect,
  onImport,
  className = '',
}: ContactRowProps): React.ReactElement {
  const displayName = contact.display_name || contact.name || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();
  const email = contact.email || (contact.allEmails?.[0] ?? null);

  // Determine source
  const source = (contact.source || 'imported') as ContactSource;
  const isExternal = source === 'external';

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking import button
    if ((e.target as HTMLElement).closest('[data-import-button]')) {
      return;
    }
    onSelect?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  const handleImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImport?.();
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-3 p-3 cursor-pointer transition-all border-b border-gray-100 ${
        isSelected ? 'bg-purple-50' : 'bg-white hover:bg-gray-50'
      } ${className}`}
      data-testid={`contact-row-${contact.id}`}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected
              ? 'bg-purple-500 border-purple-500'
              : 'border-gray-300 bg-white'
          }`}
          aria-hidden="true"
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}

      {/* Avatar */}
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {initial}
      </div>

      {/* Contact Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm truncate">{displayName}</div>
        {email && <div className="text-xs text-gray-500 truncate">{email}</div>}
      </div>

      {/* Source Pill */}
      <SourcePill source={source} size="sm" />

      {/* Import Button (external only) */}
      {showImportButton && isExternal && (
        <button
          data-import-button
          onClick={handleImportClick}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
          aria-label={`Import ${displayName}`}
          data-testid={`import-button-${contact.id}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ContactRow;
```

---

## Files to Modify

- **Create:** `src/components/shared/ContactRow.tsx`
- **Create:** `src/components/shared/ContactRow.test.tsx`

## Files to Read (for context)

- `src/components/shared/SourcePill.tsx` - Dependency (TASK-1761)
- `src/components/shared/ContactSelector.tsx` - Similar patterns (ContactListItem)
- `src/types/components.ts` - ExtendedContact type

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test file:** `src/components/shared/ContactRow.test.tsx`

```tsx
describe('ContactRow', () => {
  describe('rendering', () => {
    it('displays contact name and email', () => {});
    it('displays avatar with first initial', () => {});
    it('displays source pill based on contact.source', () => {});
    it('handles missing email gracefully', () => {});
    it('uses display_name over name if available', () => {});
  });

  describe('checkbox', () => {
    it('shows checkbox when showCheckbox is true', () => {});
    it('hides checkbox when showCheckbox is false', () => {});
    it('checkbox is checked when isSelected is true', () => {});
  });

  describe('import button', () => {
    it('shows import button for external contacts when showImportButton is true', () => {});
    it('hides import button for imported contacts even when showImportButton is true', () => {});
    it('calls onImport when import button clicked', () => {});
    it('does not call onSelect when import button clicked', () => {});
  });

  describe('selection', () => {
    it('calls onSelect when row is clicked', () => {});
    it('calls onSelect on Enter key', () => {});
    it('calls onSelect on Space key', () => {});
    it('shows selected styling when isSelected is true', () => {});
  });

  describe('accessibility', () => {
    it('has role="option"', () => {});
    it('has aria-selected attribute', () => {});
    it('is focusable with tabIndex', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add ContactRow component (TASK-1762)`
- **Branch:** `feature/task-1762-contactrow-component`
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
- [ ] Verified TASK-1761 is merged
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

- **Before**: No shared contact row component
- **After**: Reusable ContactRow with checkbox, source pill, import button
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~12K)
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
- TASK-1761 (SourcePill) is not merged yet
- You need to modify the ExtendedContact type
- You want to add state management (this should be a controlled component)
- You encounter issues with external contact identification
