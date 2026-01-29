# Sprint Plan: SPRINT-066 - Contact Management UX Overhaul

**Created**: 2026-01-28
**Updated**: 2026-01-29
**Status**: COMPLETE
**Goal**: Implement unified contact management UX across all flows
**Dependencies**: PR #678 (TASK-1760 RoleAssigner redesign) - ready for merge
**Related**: SPRINT-055b (previous iteration, superseded by this plan)
**Sprint Branch**: `sprint-066-contact-ux-overhaul`

---

## Sprint Goal

Implement a comprehensive Contact Management UX overhaul based on user wireframe feedback. This sprint addresses three distinct flows:

1. **Flow 1: Edit Contacts** - Editing contacts on existing transactions
2. **Flow 2: New Audit** - Creating new transactions with contact selection
3. **Flow 3: Contacts Page** - Dashboard contact management with import capability

**Key UX Principles:**
- Source visibility: Always show [Imported] or [External] pills
- Auto-import: Selecting external contacts imports them automatically
- Component reuse: Maximize shared components across all flows

---

## Branching Strategy

This sprint uses a **sprint branch workflow**:

```
develop
  └── sprint-066-contact-ux-overhaul  (sprint branch)
        ├── feature/task-1761-sourcepill-component
        ├── feature/task-1762-contactrow-component
        ├── feature/task-1763-contactsearchlist-component
        ├── feature/task-1764-contactrolerow-component
        ├── feature/task-1765-editcontactsmodal-redesign
        ├── feature/task-1766-new-audit-contact-flow
        ├── feature/task-1767-contactcard-import-button
        └── feature/task-1768-contactpreview-modal
```

**Workflow:**
1. All task branches are created FROM `sprint-066-contact-ux-overhaul`
2. All task PRs merge INTO `sprint-066-contact-ux-overhaul`
3. At sprint completion, `sprint-066-contact-ux-overhaul` merges to `develop`

**For each task:**
```bash
git checkout sprint-066-contact-ux-overhaul
git pull origin sprint-066-contact-ux-overhaul
git checkout -b feature/task-XXXX-description
# ... do work ...
git push -u origin feature/task-XXXX-description
# Create PR targeting sprint-066-contact-ux-overhaul (NOT develop)
```

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] Verify PR #678 (TASK-1760) is merged to develop
- [ ] `git checkout sprint-066-contact-ux-overhaul && git pull origin sprint-066-contact-ux-overhaul`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Verify tests pass: `npm test`

---

## In Scope (8 Tasks across 4 Phases)

### Phase 1: Core Shared Components (Foundation)
| Task | Title | Est. Tokens | Depends On |
|------|-------|-------------|------------|
| TASK-1761 | SourcePill component | ~8K | PR #678 merged |
| TASK-1762 | ContactRow with SourcePill | ~12K | TASK-1761 |
| TASK-1763 | ContactSearchList component | ~18K | TASK-1762 |

### Phase 2: Edit Contacts Modal Redesign
| Task | Title | Est. Tokens | Depends On |
|------|-------|-------------|------------|
| TASK-1764 | ContactRoleRow component | ~10K | TASK-1762 |
| TASK-1765 | EditContactsModal 2-screen flow | ~25K | TASK-1763, TASK-1764 |

### Phase 3: New Audit Flow Update
| Task | Title | Est. Tokens | Depends On |
|------|-------|-------------|------------|
| TASK-1766 | New Audit contact flow (search-first) | ~20K | TASK-1765 |

### Phase 4: Contacts Page Redesign
| Task | Title | Est. Tokens | Depends On |
|------|-------|-------------|------------|
| TASK-1767 | ContactCard with source pill and import button | ~15K | TASK-1762 |
| TASK-1768 | ContactPreview modal with import/edit actions | ~18K | TASK-1767 |

---

## User Requirements Reference

### Flow 1: Edit Contacts (Existing Transaction)

```
Screen 1: Assigned Contacts
+----------------------------------------------------------+
| Edit Transaction Contacts                            [X] |
+----------------------------------------------------------+
| Assigned Contacts                    [+ Add Contacts]    |
|                                                          |
| [Avatar] John Smith        [Role: Buyer v]               |
|          john@email.com    [Imported]                    |
|                                                          |
| [Avatar] Jane Doe          [Role: Seller Agent v]        |
|          jane@realty.com   [Imported]                    |
|                                                          |
|                                      [Cancel] [Save]     |
+----------------------------------------------------------+

Screen 2: Search & Add Contacts (via "Add Contacts" button)
+----------------------------------------------------------+
| Select Contacts to Add                              [X]  |
+----------------------------------------------------------+
| Search: [_____________________________]                  |
|                                                          |
| [x] Alice Brown (alice@example.com)       [Imported]     |
| [ ] Bob Wilson (bob@work.com)             [External] [+] |
| [ ] Carol Chen (carol@title.co)           [External] [+] |
|                                                          |
| Selected: 1                    [Cancel] [Add Selected]   |
+----------------------------------------------------------+
```

**Behavior:**
- Screen 1 shows contacts already assigned with role dropdowns
- "Add Contacts" opens Screen 2 (search/select modal)
- Screen 2 shows both imported and external contacts
- Clicking "Add Selected" auto-imports any external contacts
- Returns to Screen 1 with new contacts (unassigned role)

### Flow 2: New Audit (Creating Transaction)

```
Step 1: Search & Select (go straight here since no contacts yet)
+----------------------------------------------------------+
| Select Contacts for Transaction                     [X]  |
+----------------------------------------------------------+
| Search: [_____________________________]                  |
|                                                          |
| [x] John Smith (john@email.com)           [Imported]     |
| [x] Alice Brown (alice@example.com)       [External] [+] |
| [ ] Bob Wilson (bob@work.com)             [External] [+] |
|                                                          |
| Selected: 2                           [Cancel] [Next >]  |
+----------------------------------------------------------+

Step 2: Assign Roles
+----------------------------------------------------------+
| Assign Roles                                        [X]  |
+----------------------------------------------------------+
| [Avatar] John Smith           [Role: Buyer v]            |
|          john@email.com       [Imported]                 |
|                                                          |
| [Avatar] Alice Brown          [Role: Seller Agent v]     |
|          alice@example.com    [Imported] (just imported) |
|                                                          |
|                          [< Back] [Create Audit]         |
+----------------------------------------------------------+
```

**Behavior:**
- Goes directly to search/select screen (no contacts to show yet)
- External contacts auto-imported when "Next" clicked
- Step 2 uses ContactRoleRow for role assignment
- "Create Audit" completes transaction creation

### Flow 3: Contacts Page (Dashboard)

```
+----------------------------------------------------------+
| < Back to Dashboard                  Contacts            |
|                                      42 contacts total   |
+----------------------------------------------------------+
| Search: [_____________________________] [+ Create Contact]|
|                                                          |
| +------------------+  +------------------+               |
| | [Avatar] John S  |  | [Avatar] Jane D  |               |
| | john@email.com   |  | jane@realty.com  |               |
| | [Imported]       |  | [Imported]       |               |
| +------------------+  +------------------+               |
|                                                          |
| +------------------+  +------------------+               |
| | [Avatar] Bob W   |  | [Avatar] Carol C |               |
| | bob@work.com     |  | carol@title.co   |               |
| | [External] [+]   |  | [External] [+]   |               |
| +------------------+  +------------------+               |
+----------------------------------------------------------+

Contact Preview (click on card)
+----------------------------------------------------------+
| Contact Details                                     [X]  |
+----------------------------------------------------------+
| [Large Avatar]                                           |
|                                                          |
| John Smith                                               |
| john@email.com                                           |
| +1-424-555-1234                                          |
| ABC Realty                                               |
| Source: [Imported]                                       |
|                                                          |
| Transactions:                                            |
| - 123 Main St (Buyer)                                    |
| - 456 Oak Ave (Seller Agent)                             |
|                                                          |
|                                    [Edit Contact]        |
+----------------------------------------------------------+

External Contact Preview (click on external card)
+----------------------------------------------------------+
| Contact Details                                     [X]  |
+----------------------------------------------------------+
| [Large Avatar]                                           |
|                                                          |
| Bob Wilson                                               |
| bob@work.com                                             |
| +1-310-555-6789                                          |
| XYZ Corp                                                 |
| Source: [External]                                       |
|                                                          |
| Not yet imported to Magic Audit                          |
|                                                          |
|                              [Import to Software]        |
+----------------------------------------------------------+
```

**Behavior:**
- Shows all contacts (imported + external) with source pills
- [+] button ONLY on external contacts (not on already imported)
- Click card to open preview modal
- Preview shows contact details + transactions they're on
- "Import to Software" on external, "Edit Contact" on imported

---

## Shared Components Specification

### 1. SourcePill Component

**Location:** `src/components/shared/SourcePill.tsx`

```tsx
interface SourcePillProps {
  source: 'imported' | 'external' | 'manual' | 'contacts_app' | 'sms';
  size?: 'sm' | 'md';
  className?: string;
}

// Mapping:
// 'imported' | 'manual' | 'contacts_app' -> green "Imported"
// 'external' -> blue "External"
// 'sms' -> gray "Message"
```

**Visual:**
- `[Imported]` - Green badge (bg-green-100 text-green-700)
- `[External]` - Blue badge (bg-blue-100 text-blue-700)
- `[Message]` - Gray badge (bg-gray-100 text-gray-600)

### 2. ContactRow Component

**Location:** `src/components/shared/ContactRow.tsx`

```tsx
interface ContactRowProps {
  contact: ExtendedContact;
  isSelected?: boolean;
  showCheckbox?: boolean;
  showImportButton?: boolean;  // Show [+] for external contacts
  onSelect?: () => void;
  onImport?: () => void;
  className?: string;
}
```

**Visual:**
```
[Checkbox?] [Avatar] [Name + Email] [SourcePill] [+Import?]
```

### 3. ContactSearchList Component

**Location:** `src/components/shared/ContactSearchList.tsx`

```tsx
interface ContactSearchListProps {
  contacts: ExtendedContact[];
  externalContacts?: ExternalContact[];  // Optional external contacts
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onImportContact?: (contact: ExternalContact) => Promise<ExtendedContact>;
  isLoading?: boolean;
  searchPlaceholder?: string;
  className?: string;
}
```

**Features:**
- Search input at top
- Combined list showing both imported and external
- Auto-import external contacts on selection (if callback provided)
- Uses ContactRow internally

### 4. ContactRoleRow Component

**Location:** `src/components/shared/ContactRoleRow.tsx`

```tsx
interface ContactRoleRowProps {
  contact: ExtendedContact;
  role: string;
  availableRoles: Array<{value: string, label: string}>;
  onRoleChange: (role: string) => void;
  className?: string;
}
```

**Visual:**
```
[Avatar] [Name + Email] [SourcePill] [Role Dropdown v]
```

### 5. ContactPreview Component

**Location:** `src/components/shared/ContactPreview.tsx`

```tsx
interface ContactPreviewProps {
  contact: ExtendedContact | ExternalContact;
  isExternal: boolean;
  transactions?: Array<{id: string, address: string, role: string}>;
  onEdit?: () => void;
  onImport?: () => void;
  onClose: () => void;
}
```

**Features:**
- Large avatar display
- All contact fields (name, email, phone, company)
- Source pill
- Transaction list (for imported contacts)
- "Edit Contact" button (imported) or "Import to Software" button (external)

### 6. ContactCard Component (Update Existing)

**Location:** `src/components/contact/components/ContactCard.tsx`

**Updates needed:**
- Add SourcePill component usage
- Add optional [+] import button for external contacts
- Support external contact type

---

## Phase Plan

### Phase 1: Core Shared Components

**Goal:** Build foundational components used across all flows

| Task | Title | Est. | Execution | Files |
|------|-------|------|-----------|-------|
| TASK-1761 | SourcePill component | ~8K | Sequential | New: `src/components/shared/SourcePill.tsx` |
| TASK-1762 | ContactRow with SourcePill | ~12K | After 1761 | New: `src/components/shared/ContactRow.tsx` |
| TASK-1763 | ContactSearchList component | ~18K | After 1762 | New: `src/components/shared/ContactSearchList.tsx` |

**Phase 1 Deliverables:**
- SourcePill component with 3 variants
- ContactRow component with optional checkbox/import
- ContactSearchList with search + combined list
- Unit tests for all components

**Integration checkpoint:** Components render correctly in isolation (Storybook or test harness)

---

### Phase 2: Edit Contacts Modal Redesign

**Goal:** Implement the 2-screen Edit Contacts flow

| Task | Title | Est. | Execution | Files |
|------|-------|------|-----------|-------|
| TASK-1764 | ContactRoleRow component | ~10K | After Phase 1 | New: `src/components/shared/ContactRoleRow.tsx` |
| TASK-1765 | EditContactsModal 2-screen flow | ~25K | After 1764 | Modify: `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` |

**Phase 2 Deliverables:**
- ContactRoleRow component with role dropdown
- Redesigned EditContactsModal with:
  - Screen 1: Assigned contacts with roles
  - Screen 2: Search/add contacts modal
  - Auto-import on add

**Integration checkpoint:** Edit contacts on existing transaction works with new flow

---

### Phase 3: New Audit Flow Update

**Goal:** Update transaction creation to use search-first flow

| Task | Title | Est. | Execution | Files |
|------|-------|------|-----------|-------|
| TASK-1766 | New Audit contact flow | ~20K | After Phase 2 | Modify: `src/components/audit/ContactAssignmentStep.tsx`, audit modal |

**Phase 3 Deliverables:**
- New Audit goes directly to search/select
- External contacts auto-imported on "Next"
- Role assignment uses ContactRoleRow
- Existing RoleAssigner (PR #678) integrated

**Integration checkpoint:** Create new transaction with external contacts works end-to-end

---

### Phase 4: Contacts Page Redesign

**Goal:** Redesign Contacts page with external contact support

| Task | Title | Est. | Execution | Files |
|------|-------|------|-----------|-------|
| TASK-1767 | ContactCard with import button | ~15K | After Phase 1 | Modify: `src/components/contact/components/ContactCard.tsx` |
| TASK-1768 | ContactPreview modal | ~18K | After 1767 | New: `src/components/shared/ContactPreview.tsx`, Modify: `src/components/Contacts.tsx` |

**Phase 4 Deliverables:**
- ContactCard shows source pill + [+] import button
- ContactPreview modal with full details
- Import/Edit actions based on source
- Transaction list on imported contacts

**Integration checkpoint:** Contacts page shows mixed list, preview works, import works

---

## Dependency Graph

```
PR #678 (TASK-1760) ─────────────────────────────────────────┐
                                                             │
                                                             v
TASK-1761 (SourcePill) ──────────────────────────────────────┤
         │                                                   │
         v                                                   │
TASK-1762 (ContactRow) ──────┬───────────────────────────────┤
         │                   │                               │
         v                   v                               │
TASK-1763 (SearchList)  TASK-1764 (RoleRow)  TASK-1767 (Card)│
         │                   │                    │          │
         v                   v                    v          │
    ┌────┴────┐         TASK-1765              TASK-1768     │
    │         │      (EditContacts)          (Preview)       │
    │         │              │                               │
    │         v              v                               │
    │    TASK-1766                                           │
    │   (New Audit)                                          │
    │                                                        │
    └── All tasks depend on PR #678 being merged ────────────┘
```

### YAML Dependency Graph

```yaml
dependency_graph:
  nodes:
    - id: PR-678
      type: pr
      title: "RoleAssigner contact-centric redesign"
      status: ready_to_merge

    - id: TASK-1761
      type: task
      phase: 1
      title: "SourcePill component"
      parallel_safe: true

    - id: TASK-1762
      type: task
      phase: 1
      title: "ContactRow with SourcePill"
      parallel_safe: false

    - id: TASK-1763
      type: task
      phase: 1
      title: "ContactSearchList component"
      parallel_safe: false

    - id: TASK-1764
      type: task
      phase: 2
      title: "ContactRoleRow component"
      parallel_safe: true  # Can run parallel with TASK-1763

    - id: TASK-1765
      type: task
      phase: 2
      title: "EditContactsModal redesign"
      parallel_safe: false

    - id: TASK-1766
      type: task
      phase: 3
      title: "New Audit contact flow"
      parallel_safe: false

    - id: TASK-1767
      type: task
      phase: 4
      title: "ContactCard with import"
      parallel_safe: true  # Can run parallel with Phase 2-3

    - id: TASK-1768
      type: task
      phase: 4
      title: "ContactPreview modal"
      parallel_safe: false

  edges:
    - from: PR-678
      to: TASK-1761
      type: depends_on
      reason: "RoleAssigner must be merged first"

    - from: TASK-1761
      to: TASK-1762
      type: depends_on
      reason: "ContactRow uses SourcePill"

    - from: TASK-1762
      to: TASK-1763
      type: depends_on
      reason: "ContactSearchList uses ContactRow"

    - from: TASK-1762
      to: TASK-1764
      type: depends_on
      reason: "ContactRoleRow uses ContactRow patterns"

    - from: TASK-1763
      to: TASK-1765
      type: depends_on
      reason: "EditContactsModal uses ContactSearchList"

    - from: TASK-1764
      to: TASK-1765
      type: depends_on
      reason: "EditContactsModal uses ContactRoleRow"

    - from: TASK-1765
      to: TASK-1766
      type: depends_on
      reason: "New Audit reuses EditContacts patterns"

    - from: TASK-1762
      to: TASK-1767
      type: depends_on
      reason: "ContactCard uses similar patterns to ContactRow"

    - from: TASK-1767
      to: TASK-1768
      type: depends_on
      reason: "ContactPreview launched from ContactCard"

  parallel_batches:
    batch_1:
      - TASK-1761
    batch_2:
      - TASK-1762
    batch_3:
      - TASK-1763
      - TASK-1764  # Can run in parallel
      - TASK-1767  # Can run in parallel
    batch_4:
      - TASK-1765
      - TASK-1768  # Can run in parallel
    batch_5:
      - TASK-1766
```

---

## File Conflict Matrix

| File/Area | Tasks | Conflict Risk | Resolution |
|-----------|-------|---------------|------------|
| `src/components/shared/SourcePill.tsx` | 1761 | None | New file |
| `src/components/shared/ContactRow.tsx` | 1762 | None | New file |
| `src/components/shared/ContactSearchList.tsx` | 1763 | None | New file |
| `src/components/shared/ContactRoleRow.tsx` | 1764 | None | New file |
| `src/components/shared/ContactPreview.tsx` | 1768 | None | New file |
| `EditContactsModal.tsx` | 1765 | Medium | Major refactor |
| `ContactAssignmentStep.tsx` | 1766 | Medium | Major refactor |
| `ContactCard.tsx` | 1767 | Low | Add props |
| `Contacts.tsx` | 1768 | Low | Add preview modal |
| `src/components/shared/RoleAssigner.tsx` | PR #678 | Must merge first | Already done |

**Mitigation:** Sequential execution within phases. Parallel only for isolated new files.

---

## Merge Plan

- **Main branch**: `develop`
- **Feature branch format**: `feature/task-XXXX-description`

### Merge Order

```
Phase 0 (Pre-Sprint):
PR #678 -> develop (merge TASK-1760 first)

Phase 1 (Sequential):
1. TASK-1761 -> develop
2. TASK-1762 -> develop
3. TASK-1763 -> develop (can parallel with TASK-1764)

Phase 2:
4. TASK-1764 -> develop (can parallel with TASK-1763)
5. TASK-1765 -> develop

Phase 3:
6. TASK-1766 -> develop

Phase 4 (Can overlap with Phase 2-3):
7. TASK-1767 -> develop (after TASK-1762)
8. TASK-1768 -> develop (after TASK-1767)
```

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Tests |
|------|------------|-------------------|--------------|
| TASK-1761 | SourcePill renders 3 variants | - | Visual check |
| TASK-1762 | ContactRow states (selected, checkbox, import) | - | Visual check |
| TASK-1763 | Search filtering, selection, import callback | - | Search + select |
| TASK-1764 | Role dropdown, change handler | - | Visual check |
| TASK-1765 | 2-screen navigation, save flow | EditContacts flow | Full edit workflow |
| TASK-1766 | New audit steps | Create audit flow | Full create workflow |
| TASK-1767 | Card renders with pill + button | - | Visual check |
| TASK-1768 | Preview shows details, actions work | - | Click card -> preview |

### CI/CD Quality Gates

All PRs must pass:
- [ ] `npm test` - All tests pass
- [ ] `npm run type-check` - No TypeScript errors
- [ ] `npm run lint` - No lint errors
- [ ] `npm run build` - Build succeeds

### End-to-End Validation

After all tasks complete:
- [ ] Flow 1: Edit contacts on existing transaction
- [ ] Flow 2: Create new audit with external contacts
- [ ] Flow 3: Contacts page browse, preview, import

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| External contact API not available | Low | High | Use existing macOS Contacts bridge |
| Large contact lists performance | Medium | Medium | Virtual scrolling in ContactSearchList |
| PR #678 merge conflicts | Low | Medium | Merge first before starting |
| EditContactsModal refactor scope creep | Medium | Medium | Strict task boundaries |
| Test coverage gaps | Medium | Low | Require tests in each task |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | SR Overhead | Phase Total |
|-------|-------|-------------|-------------|-------------|
| Phase 1 | 3 tasks | ~38K | ~20K | ~58K |
| Phase 2 | 2 tasks | ~35K | ~15K | ~50K |
| Phase 3 | 1 task | ~20K | ~10K | ~30K |
| Phase 4 | 2 tasks | ~33K | ~15K | ~48K |
| **Total** | **8 tasks** | **~126K** | **~60K** | **~186K** |

**Contingency (15%)**: ~28K

**Sprint Total**: ~214K tokens

---

## Task Execution Status

| Phase | Task | Status | Engineer | PR | Actual Tokens |
|-------|------|--------|----------|-----|---------------|
| 0 | PR #678 (TASK-1760) | MERGED | - | #678 | - |
| 1 | TASK-1761 | MERGED | - | #679 | - |
| 1 | TASK-1762 | MERGED | - | #681 | - |
| 1 | TASK-1763 | MERGED | - | #682 | - |
| 2 | TASK-1764 | MERGED | - | #683 | - |
| 2 | TASK-1765 | MERGED | - | #684 | - |
| 3 | TASK-1766 | MERGED | - | #685 | - |
| 4 | TASK-1767 | MERGED | - | #686 | - |
| 4 | TASK-1768 | MERGED | - | #687 | - |

---

## End-of-Sprint Validation Checklist

### Component Checklist
- [ ] SourcePill renders all 3 variants correctly
- [ ] ContactRow shows checkbox/import button conditionally
- [ ] ContactSearchList filters and selects correctly
- [ ] ContactRoleRow dropdown works
- [ ] ContactPreview shows all contact details

### Flow 1: Edit Contacts
- [ ] Screen 1 shows assigned contacts with role dropdowns
- [ ] "Add Contacts" opens search modal
- [ ] External contacts show [+] import indicator
- [ ] "Add Selected" imports external contacts
- [ ] Role changes persist on save

### Flow 2: New Audit
- [ ] Goes directly to search/select screen
- [ ] Can select imported and external contacts
- [ ] External contacts auto-imported on "Next"
- [ ] Role assignment step works
- [ ] "Create Audit" completes successfully

### Flow 3: Contacts Page
- [ ] Shows all contacts with source pills
- [ ] [+] only on external contacts
- [ ] Click card opens preview
- [ ] Preview shows transaction history (imported)
- [ ] "Import to Software" works (external)
- [ ] "Edit Contact" works (imported)

### CI/CD
- [ ] All tests pass
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Build succeeds

---

## Related Documentation

- **SPRINT-055b**: Previous Contact UX Overhaul plan (superseded)
- **PR #678**: TASK-1760 RoleAssigner redesign (prerequisite)
- **Engineer Workflow**: `.claude/docs/ENGINEER-WORKFLOW.md`
- **PR-SOP**: `.claude/docs/PR-SOP.md`

---

## Notes for SR Engineer Review

Before task assignment, SR Engineer should review:
1. Shared component interfaces (ensure consistency)
2. External contact data model (does it exist? API available?)
3. Parallel execution safety for batch_3 and batch_4
4. EditContactsModal current state vs proposed changes

---

## SR Engineer Review Notes

**Review Date:** 2026-01-28 | **Status:** APPROVED WITH BLOCKER

### Blocker: PR #678 CI Failure

**CRITICAL:** PR #678 (TASK-1760 RoleAssigner redesign) has **failing CI** and MUST be fixed before this sprint can begin.

**Failure Details:**
- `integration.test.ts` fails with: "useAuth must be used within an AuthProvider"
- Affected tests: `LoadingOrchestrator` tests that render components using `useAuth` hook
- This is a **test setup issue**, not a RoleAssigner problem
- The test file needs `AuthProvider` wrapper in its test setup

**Resolution Required:**
1. Fix `integration.test.ts` to wrap test components in `AuthProvider`
2. Re-run CI to verify all tests pass
3. Merge PR #678 to develop

**Estimated fix effort:** ~5-10 minutes (straightforward test setup fix)

---

### Sprint Plan Assessment

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Phase structure | GOOD | Logical progression from foundation to integration |
| Dependencies | CORRECT | Well-mapped, no circular dependencies |
| Estimates | REASONABLE | 8K-25K per task is appropriate for component work |
| Task clarity | EXCELLENT | Task files are detailed with implementation sketches |
| Risk assessment | ADEQUATE | Key risks identified |

---

### Technical Review by Task

#### TASK-1761 (SourcePill) - APPROVED
- **Branch From:** develop (after PR #678 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1761-sourcepill-component`
- **Parallel Safe:** Yes (new file, no conflicts)
- **Technical Notes:** Clean, simple component. Implementation sketch provided is complete.

#### TASK-1762 (ContactRow) - APPROVED
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1762-contactrow-component`
- **Parallel Safe:** No (depends on TASK-1761)
- **Depends On:** TASK-1761
- **Technical Notes:** Uses SourcePill. Well-specified props interface.

#### TASK-1763 (ContactSearchList) - APPROVED
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1763-contactsearchlist-component`
- **Parallel Safe:** Can run parallel with TASK-1764
- **Depends On:** TASK-1762
- **Technical Notes:** Complex component but well-specified. Consider virtual scrolling for large lists (flagged as risk).

#### TASK-1764 (ContactRoleRow) - APPROVED
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1764-contactrolerow-component`
- **Parallel Safe:** Yes (can run parallel with TASK-1763)
- **Depends On:** TASK-1762
- **Technical Notes:** Similar patterns to ContactRow but with role dropdown. Could potentially extract shared avatar/info rendering.

#### TASK-1765 (EditContactsModal) - APPROVED WITH CAUTION
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1765-editcontactsmodal-redesign`
- **Parallel Safe:** No (major refactor of existing file)
- **Depends On:** TASK-1763, TASK-1764
- **Risk Level:** MEDIUM
- **Technical Notes:**
  - Major refactor of `EditContactsModal.tsx` (14.9KB current size)
  - Existing tests must be updated (not just added)
  - External contact import API assumed - verify exists
  - Save logic must maintain backward compatibility

#### TASK-1766 (New Audit Contact Flow) - APPROVED
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1766-new-audit-contact-flow`
- **Parallel Safe:** No (depends on TASK-1765 patterns)
- **Depends On:** TASK-1765
- **Technical Notes:** Reuses patterns from TASK-1765. Verify ContactAssignmentStep.tsx exists.

#### TASK-1767 (ContactCard) - APPROVED
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1767-contactcard-import-button`
- **Parallel Safe:** Yes (can run parallel with Phase 2-3)
- **Depends On:** TASK-1762 (patterns only, not direct import)
- **Technical Notes:** Existing `ContactCard.tsx` (6.4KB) - modification, not replacement.

#### TASK-1768 (ContactPreview) - APPROVED
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1768-contactpreview-modal`
- **Parallel Safe:** Can run parallel with TASK-1765
- **Depends On:** TASK-1767
- **Technical Notes:** New modal component. Integration into `Contacts.tsx` required.

---

### Shared File Analysis

| File | Tasks | Conflict Risk | Notes |
|------|-------|---------------|-------|
| `src/components/shared/` (new files) | 1761-1764, 1768 | LOW | New files, no conflicts |
| `EditContactsModal.tsx` | 1765 | MEDIUM | Major refactor, one task only |
| `ContactAssignmentStep.tsx` | 1766 | MEDIUM | Major refactor, one task only |
| `ContactCard.tsx` | 1767 | LOW | Modification, isolated |
| `Contacts.tsx` | 1768 | LOW | Add preview integration |

---

### Execution Order Recommendation

**Batch 0 (Pre-Sprint - BLOCKER):**
- Fix PR #678 CI failure (test setup fix)
- Merge PR #678 to develop

**Batch 1 (Sequential - Foundation):**
1. TASK-1761 (SourcePill) - **Start here after PR #678 merges**
2. TASK-1762 (ContactRow)

**Batch 2 (Parallel - Building Blocks):**
- TASK-1763 (ContactSearchList) - Can start after 1762
- TASK-1764 (ContactRoleRow) - Can start after 1762 (parallel with 1763)
- TASK-1767 (ContactCard) - Can start after 1762 (parallel with 1763/1764)

**Batch 3 (Parallel - Integration):**
- TASK-1765 (EditContactsModal) - After 1763 AND 1764
- TASK-1768 (ContactPreview) - After 1767 (parallel with 1765)

**Batch 4 (Sequential - Final):**
- TASK-1766 (New Audit) - After 1765

**Visual Timeline:**
```
PR #678 fix ──> TASK-1761 ──> TASK-1762 ──┬──> TASK-1763 ──┬──> TASK-1765 ──> TASK-1766
                                          │                │
                                          ├──> TASK-1764 ──┘
                                          │
                                          └──> TASK-1767 ──> TASK-1768
```

---

### Technical Concerns

1. **ExternalContact Type**: The `ExternalContact` interface is defined inline in each task file. Recommend creating a shared type in `src/types/contacts.ts` during TASK-1761 to avoid duplication.

2. **External Contact API**: Task files assume `window.api.contacts.importExternal()` exists. Verify this API is available or needs to be created.

3. **Import API for Transactions**: TASK-1768 assumes `window.api.contacts.getTransactions()` exists. Verify availability.

4. **Virtual Scrolling**: For large contact lists (>1000), ContactSearchList may need virtual scrolling. Consider adding as future enhancement if performance issues arise.

5. **Deprecation Plan**: After sprint, old `ContactSelector.tsx` should be deprecated. Add cleanup task to backlog.

---

### Recommendations

1. **Fix PR #678 First**: This is blocking. Assign immediately.

2. **Create Shared Types Early**: Add `ExternalContact` to shared types during TASK-1761 to avoid duplication across task files.

3. **Phase 4 Can Start Early**: TASK-1767 (ContactCard) can start as soon as TASK-1762 merges, running in parallel with Phase 2 work.

4. **Add Cleanup Task**: Create backlog item for post-sprint cleanup of deprecated components.

---

### Sprint Readiness Checklist

- [ ] **BLOCKER:** PR #678 CI failure fixed and merged
- [ ] Verify `window.api.contacts.importExternal()` exists or create API
- [ ] Verify `window.api.contacts.getTransactions()` exists or create API
- [ ] All engineers have reviewed task files
- [ ] Environment setup verified (`npm install`, `npm rebuild`, etc.)

---

**SR Engineer Sign-off:** Pending PR #678 fix

---

## Appendix: Existing Component Reuse

### Components to Reuse
- `ContactSelector.tsx` - Base patterns (but replacing with ContactSearchList)
- `RoleAssigner.tsx` (PR #678) - Contact-centric role assignment
- `ContactCard.tsx` - Extending, not replacing
- `ContactDetailsModal.tsx` - May inform ContactPreview design

### Components to Deprecate (After Sprint)
- Old `ContactSelector.tsx` - Replaced by `ContactSearchList.tsx`
- Potentially `ContactSelectModal.tsx` - If no longer used
