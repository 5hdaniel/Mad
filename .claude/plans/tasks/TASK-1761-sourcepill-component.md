# TASK-1761: SourcePill Component

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 1 - Core Shared Components
**Branch:** `feature/task-1761-sourcepill-component`
**Estimated Tokens:** ~8K

---

## Objective

Create a reusable SourcePill component that displays a colored badge indicating the source of a contact (Imported, External, or Message). This is a foundational component used across all contact management flows.

---

## Context

The Contact Management UX overhaul requires consistent visual indication of contact sources across multiple flows:
- Edit Contacts Modal
- New Audit contact selection
- Contacts Page

Current contact sources in the system:
- `contacts_app` - Imported from macOS Contacts
- `manual` - Manually created in Magic Audit
- `sms` - Derived from SMS messages
- External contacts (not yet in Magic Audit)

---

## Requirements

### Must Do:
1. Create `SourcePill.tsx` component in `src/components/shared/`
2. Support 3 visual variants:
   - **Imported** (green): for `contacts_app`, `manual`, `imported` sources
   - **External** (blue): for external contacts not yet imported
   - **Message** (gray): for `sms` source contacts
3. Support 2 sizes: `sm` (default) and `md`
4. Export named component and TypeScript interface
5. Write unit tests covering all variants and sizes

### Must NOT Do:
- Do not add click handlers (this is display-only)
- Do not fetch or modify contact data
- Do not add animations or transitions

---

## Acceptance Criteria

- [ ] SourcePill renders correctly for 'imported' source (green badge)
- [ ] SourcePill renders correctly for 'external' source (blue badge)
- [ ] SourcePill renders correctly for 'sms' source (gray badge)
- [ ] SourcePill maps 'contacts_app' and 'manual' to 'imported' variant
- [ ] Size prop changes badge size (sm/md)
- [ ] Component exports TypeScript interface
- [ ] Unit tests pass for all variants

---

## Technical Specification

### Component Interface

```tsx
// src/components/shared/SourcePill.tsx

export type ContactSource = 'imported' | 'external' | 'manual' | 'contacts_app' | 'sms';

export interface SourcePillProps {
  /** The contact source - mapped to visual variant */
  source: ContactSource;
  /** Size of the pill */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export function SourcePill({ source, size = 'sm', className }: SourcePillProps): React.ReactElement;
```

### Source to Variant Mapping

```typescript
function getVariant(source: ContactSource): 'imported' | 'external' | 'message' {
  switch (source) {
    case 'imported':
    case 'manual':
    case 'contacts_app':
      return 'imported';
    case 'external':
      return 'external';
    case 'sms':
      return 'message';
    default:
      return 'imported';
  }
}
```

### Visual Styles

| Variant | Background | Text | Label |
|---------|------------|------|-------|
| imported | bg-green-100 | text-green-700 | "Imported" |
| external | bg-blue-100 | text-blue-700 | "External" |
| message | bg-gray-100 | text-gray-600 | "Message" |

| Size | Padding | Font Size |
|------|---------|-----------|
| sm | px-2 py-0.5 | text-xs |
| md | px-2.5 py-1 | text-sm |

### Implementation

```tsx
import React from 'react';

export type ContactSource = 'imported' | 'external' | 'manual' | 'contacts_app' | 'sms';

export interface SourcePillProps {
  source: ContactSource;
  size?: 'sm' | 'md';
  className?: string;
}

type Variant = 'imported' | 'external' | 'message';

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; label: string }> = {
  imported: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Imported',
  },
  external: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    label: 'External',
  },
  message: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: 'Message',
  },
};

const SIZE_STYLES: Record<'sm' | 'md', string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

function getVariant(source: ContactSource): Variant {
  switch (source) {
    case 'imported':
    case 'manual':
    case 'contacts_app':
      return 'imported';
    case 'external':
      return 'external';
    case 'sms':
      return 'message';
    default:
      return 'imported';
  }
}

export function SourcePill({
  source,
  size = 'sm',
  className = '',
}: SourcePillProps): React.ReactElement {
  const variant = getVariant(source);
  const styles = VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${styles.bg} ${styles.text} ${sizeStyles} ${className}`}
      data-testid={`source-pill-${variant}`}
    >
      {styles.label}
    </span>
  );
}

export default SourcePill;
```

---

## Files to Modify

- **Create:** `src/components/shared/SourcePill.tsx`
- **Create:** `src/components/shared/SourcePill.test.tsx`

## Files to Read (for context)

- `src/components/contact/components/ContactCard.tsx` - Current source badge implementation
- `src/components/contact/types.ts` - getSourceBadge function

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test file:** `src/components/shared/SourcePill.test.tsx`

```tsx
describe('SourcePill', () => {
  it('renders "Imported" for source="imported"', () => {});
  it('renders "Imported" for source="manual"', () => {});
  it('renders "Imported" for source="contacts_app"', () => {});
  it('renders "External" for source="external"', () => {});
  it('renders "Message" for source="sms"', () => {});
  it('applies sm size by default', () => {});
  it('applies md size when specified', () => {});
  it('applies custom className', () => {});
  it('has correct test IDs for each variant', () => {});
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): add SourcePill component (TASK-1761)`
- **Branch:** `feature/task-1761-sourcepill-component`
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

- **Before**: No shared source pill component
- **After**: Reusable SourcePill component with 3 variants
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~8K)
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
- You need to add new source types not listed
- You want to add click/interaction handlers
- The existing `getSourceBadge` function has different logic you think should be preserved
