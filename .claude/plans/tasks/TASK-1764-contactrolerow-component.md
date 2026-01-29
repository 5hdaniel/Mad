# TASK-1764: ContactRoleRow Component

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 2 - Edit Contacts Modal Redesign
**Branch:** `feature/task-1764-contactrolerow-component`
**Estimated Tokens:** ~10K
**Depends On:** TASK-1762 (ContactRow patterns)

---

## Objective

Create a ContactRoleRow component that displays a contact with an associated role dropdown. This component is used in the "Assign Roles" step of both Edit Contacts and New Audit flows.

---

## Context

After PR #678 (TASK-1760) redesigned RoleAssigner to be contact-centric, we need a reusable row component that:
- Shows contact info (avatar, name, email)
- Shows source pill
- Provides role dropdown for assignment

This is similar to ContactRow but focused on role assignment rather than selection.

The existing RoleAssigner (from PR #678) uses inline ContactRoleRow logic. This task extracts it into a reusable shared component that can be used by:
- EditContactsModal (Screen 1 - assigned contacts)
- New Audit (Step 2 - role assignment)
- Potentially other flows

---

## Requirements

### Must Do:
1. Create `ContactRoleRow.tsx` component in `src/components/shared/`
2. Use SourcePill component from TASK-1761
3. Include role dropdown with configurable options
4. Display avatar, name, email similar to ContactRow
5. Call onRoleChange callback when role is selected
6. Handle "unassigned" state (empty role)
7. Write unit tests

### Must NOT Do:
- Do not implement role option filtering (parent provides options)
- Do not manage role state (controlled component)
- Do not include checkbox selection (that's ContactRow)

---

## Acceptance Criteria

- [ ] ContactRoleRow displays avatar, name, email, and source pill
- [ ] Role dropdown shows all provided options
- [ ] First option is "Select role..." placeholder
- [ ] Selecting a role triggers onRoleChange callback
- [ ] Current role is shown as selected in dropdown
- [ ] Component is keyboard accessible
- [ ] Unit tests pass for all scenarios

---

## Technical Specification

### Component Interface

```tsx
// src/components/shared/ContactRoleRow.tsx

import type { ExtendedContact } from '../../types/components';

export interface RoleOption {
  value: string;
  label: string;
}

export interface ContactRoleRowProps {
  /** Contact to display */
  contact: ExtendedContact;
  /** Currently assigned role (empty string = unassigned) */
  currentRole: string;
  /** Available role options */
  roleOptions: RoleOption[];
  /** Callback when role changes */
  onRoleChange: (role: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function ContactRoleRow(props: ContactRoleRowProps): React.ReactElement;
```

### Visual Layout

```
[Avatar] [Name + Email stack] [SourcePill] [Role Dropdown  v]
(32x32)  Name (bold)                       [Select role...]
         email@domain.com                  [Buyer]
                                           [Seller Agent]
                                           [etc...]
```

### Implementation Sketch

```tsx
import React from 'react';
import { SourcePill, type ContactSource } from './SourcePill';
import type { ExtendedContact } from '../../types/components';

export interface RoleOption {
  value: string;
  label: string;
}

export interface ContactRoleRowProps {
  contact: ExtendedContact;
  currentRole: string;
  roleOptions: RoleOption[];
  onRoleChange: (role: string) => void;
  className?: string;
}

export function ContactRoleRow({
  contact,
  currentRole,
  roleOptions,
  onRoleChange,
  className = '',
}: ContactRoleRowProps): React.ReactElement {
  const displayName = contact.display_name || contact.name || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();
  const email = contact.email || (contact.allEmails?.[0] ?? null);
  const source = (contact.source || 'imported') as ContactSource;

  return (
    <div
      className={`flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg ${className}`}
      data-testid={`contact-role-row-${contact.id}`}
    >
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

      {/* Role Dropdown */}
      <select
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none min-w-[160px]"
        value={currentRole}
        onChange={(e) => onRoleChange(e.target.value)}
        aria-label={`Role for ${displayName}`}
        data-testid={`role-select-${contact.id}`}
      >
        <option value="">Select role...</option>
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ContactRoleRow;
```

---

## Files to Modify

- **Create:** `src/components/shared/ContactRoleRow.tsx`
- **Create:** `src/components/shared/ContactRoleRow.test.tsx`

## Files to Read (for context)

- `src/components/shared/SourcePill.tsx` - Dependency (TASK-1761)
- `src/components/shared/RoleAssigner.tsx` - Current inline implementation (PR #678)
- `src/constants/contactRoles.ts` - Role definitions

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test file:** `src/components/shared/ContactRoleRow.test.tsx`

```tsx
describe('ContactRoleRow', () => {
  describe('rendering', () => {
    it('displays contact name and email', () => {});
    it('displays avatar with first initial', () => {});
    it('displays source pill', () => {});
    it('handles missing email gracefully', () => {});
  });

  describe('role dropdown', () => {
    it('shows "Select role..." as first option', () => {});
    it('shows all provided role options', () => {});
    it('shows current role as selected', () => {});
    it('shows empty selection when currentRole is empty', () => {});
  });

  describe('role change', () => {
    it('calls onRoleChange when role is selected', () => {});
    it('passes selected role value to callback', () => {});
    it('calls onRoleChange with empty string when placeholder selected', () => {});
  });

  describe('accessibility', () => {
    it('has aria-label on select element', () => {});
    it('has correct test IDs', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add ContactRoleRow component (TASK-1764)`
- **Branch:** `feature/task-1764-contactrolerow-component`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
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

- **Before**: Inline ContactRoleRow in RoleAssigner
- **After**: Reusable shared ContactRoleRow component
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~10K)
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
- You want to add role filtering logic (should be done by parent)
- You need to modify RoleAssigner to use this component (that's a separate concern)
- You encounter type issues with ExtendedContact
