# TASK-606: Contacts.tsx Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 4 - Component Refactors
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-604
**Parallel With:** TASK-605, TASK-607

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 4-5 → Actual: _ (variance: _%)
- Est Wall-Clock: 20-25 min → Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 12-16 | **4-5** | - |
| **Tokens** | ~60K | ~18K | - |
| **Time** | 2-2.5h | **20-25 min** | **20-25 min** |

**Category:** refactor
**Confidence:** High (based on TASK-602/603 actuals)

---

## Objective

Split `src/components/Contacts.tsx` (1,638 lines) into smaller, focused components and hooks, reducing to < 500 lines.

---

## Current State

`Contacts.tsx` contains:
- Contact list rendering
- Contact CRUD operations
- Contact import functionality
- Contact details panel
- Search and filtering
- Contact linking to transactions
- Multiple modal dialogs

---

## Requirements

### Must Do
1. Extract presentational components
2. Extract custom hooks for state management
3. Use service layer from TASK-604
4. Reduce Contacts.tsx to < 500 lines

### Must NOT Do
- Change user-facing behavior
- Break contact-transaction linking
- Modify database operations

---

## Proposed Extraction

### Components
| Component | Purpose | Lines (est.) |
|-----------|---------|--------------|
| `ContactCard.tsx` | Individual contact display | ~80 |
| `ContactDetailsPanel.tsx` | Contact detail view | ~150 |
| `ContactForm.tsx` | Add/edit contact form | ~120 |
| `ContactImportModal.tsx` | CSV/vCard import | ~100 |
| `ContactSearchBar.tsx` | Search/filter UI | ~50 |

### Hooks
| Hook | Purpose | Lines (est.) |
|------|---------|--------------|
| `useContactList.ts` | Contact fetching, CRUD | ~100 |
| `useContactSearch.ts` | Search/filter logic | ~60 |
| `useContactImport.ts` | Import handling | ~80 |
| `useContactSelection.ts` | Selection state | ~40 |

---

## Directory Structure

```
src/components/contact/
  index.ts
  components/
    index.ts
    ContactCard.tsx
    ContactDetailsPanel.tsx
    ContactForm.tsx
    ContactImportModal.tsx
    ContactSearchBar.tsx
  hooks/
    index.ts
    useContactList.ts
    useContactSearch.ts
    useContactImport.ts
    useContactSelection.ts
```

---

## Implementation Pattern

Follow transaction refactoring pattern from SPRINT-008:

```typescript
// src/components/contact/hooks/useContactList.ts
import { useState, useCallback, useEffect } from "react";
import { contactService } from "@/services/contactService";
import type { Contact } from "@/types";

export function useContactList(userId: string) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    const result = await contactService.getAll(userId);
    if (result.success) {
      setContacts(result.data || []);
    } else {
      setError(result.error || "Failed to fetch contacts");
    }
    setIsLoading(false);
  }, [userId]);

  // ... CRUD operations

  return { contacts, isLoading, error, fetchContacts, /* ... */ };
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/contact/index.ts` | Barrel export |
| `src/components/contact/components/index.ts` | Component exports |
| `src/components/contact/components/ContactCard.tsx` | Contact card |
| `src/components/contact/components/ContactDetailsPanel.tsx` | Details panel |
| `src/components/contact/components/ContactForm.tsx` | Add/edit form |
| `src/components/contact/components/ContactImportModal.tsx` | Import modal |
| `src/components/contact/components/ContactSearchBar.tsx` | Search bar |
| `src/components/contact/hooks/index.ts` | Hook exports |
| `src/components/contact/hooks/useContactList.ts` | List management |
| `src/components/contact/hooks/useContactSearch.ts` | Search logic |
| `src/components/contact/hooks/useContactImport.ts` | Import logic |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Contacts.tsx` | Reduce to < 500 lines, use extracted components/hooks |

---

## Testing Requirements

1. **Unit Tests**
   - Test useContactList hook
   - Test useContactSearch hook
   - Test useContactImport hook

2. **Existing Tests**
   - All contact tests pass
   - No behavior changes

3. **Manual Verification**
   - Contact list renders
   - CRUD operations work
   - Import works
   - Search/filter works

---

## Acceptance Criteria

- [ ] `Contacts.tsx` < 500 lines
- [ ] Uses service layer (no direct window.api calls)
- [ ] All components extracted
- [ ] All hooks extracted
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-606-contacts-split
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
