# Sprint Plan: SPRINT-055b - Contact Management UX Overhaul

**Created**: 2026-01-23
**Updated**: 2026-01-23
**Status**: Planning
**Goal**: Implement single-screen contact selection/import/add flow
**Dependencies**: SPRINT-055a (bug fixes should be complete first)
**Split From**: SPRINT-055 (too large at ~145K tokens)

---

## Sprint Goal

This sprint addresses the user's "Contact Management UX" requirement:

> Current: Two-step flow (import, then add)
> Goal: Single-screen flow where users can select/import/add in one place

This is a significant UX overhaul that consolidates multiple contact-related flows into a unified single-screen experience.

**Rationale for Split**: SPRINT-055 was ~145K tokens. Bug fixes moved to SPRINT-055a. This sprint (055b) contains the larger UX overhaul work.

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] Verify SPRINT-055a is complete (bug fixes)
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Verify tests pass: `npm test`

---

## In Scope (2 Items)

### Phase 1: Unified Contact Selector (Sequential)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-463 | Single-Screen Contact Management Flow | ~45K | TASK-TBD |

### Phase 2: Role Assignment Integration (Sequential - After Phase 1)
| ID | Title | Est. Tokens | Task File |
|----|-------|-------------|-----------|
| BACKLOG-418 | Redesign Contact Selection UX (Select First, Assign Roles Second) | ~40K | TASK-TBD |

---

## User Requirements Reference

### Current UX (Problems)
```
Step 1: Open "Select Contacts" modal
Step 2: See only imported contacts
Step 3: Click "Import" button -> Navigate to Import screen
Step 4: Import contacts -> Navigate back
Step 5: Back at Select Contacts, find and select contact
Step 6: Click "Add New" -> Navigate to Add Contact form
Step 7: Create contact -> Navigate back
```
**Issues**: 6-7 navigation steps, confusing flow, easy to lose context

### Target UX (Solution)
```
Single Screen:
+---------------------------------------------------------+
| Select Contacts                      [+ Add New Contact]|
+---------------------------------------------------------+
| Search: [_________________________________]              |
|                                                         |
| YOUR CONTACTS                                           |
| [x] John Smith (john@email.com)           [IMPORTED]    |
| [ ] Sarah Johnson (+1-424-555-1234)       [MANUAL]      |
|                                                         |
| FROM ADDRESS BOOK (click to import)                     |
| [ ] Alice Brown (alice@example.com)       [+ Import]    |
| [ ] Bob Wilson (bob@work.com)             [+ Import]    |
|                                                         |
| Selected: 1 contact                          [Done]     |
+---------------------------------------------------------+
```

**Key Features**:
- See all contacts (imported + address book) in one view
- Click address book contact -> auto-import + select
- Click "Add New" -> inline form (no navigation)
- Search works across both sections

---

## Reprioritized Backlog

| Priority | ID | Title | Est. Tokens | Phase | Dependencies |
|----------|-----|-------|-------------|-------|--------------|
| 1 | BACKLOG-463 | Single-Screen Contact Flow | ~45K | 1 | SPRINT-055a |
| 2 | BACKLOG-418 | Select First, Roles Second | ~40K | 2 | BACKLOG-463 |

**Total Estimated Tokens**: ~85K

---

## Phase Plan

### Phase 1: Unified Contact Selector

**Goal**: Create single-screen contact selection with inline import/add

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Single-Screen Contact Management Flow | ~45K | Sequential |

**New Components**:
```
src/components/shared/
  UnifiedContactSelector.tsx      # Main component
  ContactListSection.tsx          # Imported contacts section
  AddressBookSection.tsx          # External contacts section
  InlineAddContactForm.tsx        # Add new contact form
  ContactSourceBadge.tsx          # [IMPORTED] [MANUAL] badges
```

**Key Implementation**:

1. **Unified List with Sections**:
```tsx
<UnifiedContactSelector
  selectedIds={selectedContactIds}
  onSelectionChange={handleSelectionChange}
>
  <ContactListSection title="Your Contacts" contacts={importedContacts} />
  <AddressBookSection title="From Address Book" contacts={externalContacts} />
</UnifiedContactSelector>
```

2. **Auto-Import on Selection**:
```typescript
const handleExternalContactSelect = async (contact: ExternalContact) => {
  // 1. Import contact (async)
  const imported = await importContact(contact);

  // 2. Add to imported contacts list
  setImportedContacts(prev => [...prev, imported]);

  // 3. Remove from external list
  setExternalContacts(prev => prev.filter(c => c.id !== contact.id));

  // 4. Add to selection
  onSelectionChange([...selectedIds, imported.id]);
};
```

3. **Inline Add Contact**:
```tsx
const [showAddForm, setShowAddForm] = useState(false);

{showAddForm && (
  <InlineAddContactForm
    onSave={async (contact) => {
      const created = await createContact(contact);
      setImportedContacts(prev => [...prev, created]);
      onSelectionChange([...selectedIds, created.id]);
      setShowAddForm(false);
    }}
    onCancel={() => setShowAddForm(false)}
  />
)}
```

**Integration Points**:
- ContactSelectModal.tsx -> Use UnifiedContactSelector
- EditContactsModal.tsx -> Use UnifiedContactSelector
- Transaction creation flow -> Use UnifiedContactSelector

**Deliverables**:
- UnifiedContactSelector component
- Auto-import functionality
- Inline add contact form
- Search across both sections
- Source badges ([IMPORTED], [MANUAL], [EXTERNAL])

**Integration checkpoint**: New flow working in one location (e.g., EditContactsModal).

---

### Phase 2: Role Assignment Integration

**Goal**: Integrate with "Select First, Assign Roles Second" flow

| Task | Title | Est. | Execution |
|------|-------|------|-----------|
| TASK-TBD | Redesign Contact Selection UX | ~40K | After Phase 1 |

**Flow**:
```
Step 1: Select Contacts (Phase 1 component)
  - Use UnifiedContactSelector
  - Multi-select contacts
  - Result: List of selected contact IDs

Step 2: Assign Roles (Phase 2)
  - Show selected contacts
  - Dropdown per role
  - No API calls, pure UI
```

**New Component**:
```tsx
// RoleAssigner.tsx
<RoleAssigner
  selectedContacts={selectedContacts}
  onRoleAssignment={handleRoleAssignment}
  roles={['buyer', 'seller', 'listing_agent', 'buying_agent']}
/>
```

**Integration Points**:
- AuditTransactionModal -> Use new 2-step flow
- EditTransactionModal -> Use new 2-step flow

**Deliverables**:
- RoleAssigner component
- ContactRoleFlow wrapper (combines both steps)
- Remove 3 duplicate role assignment components
- Single contact load per transaction creation

**Integration checkpoint**: Full transaction creation uses new flow with 1 contact load.

---

## Merge Plan

- **Main branch**: `develop`
- **Feature branch format**: `feature/TASK-XXXX-description`

### Merge Order (Sequential)

```
Phase 1:
1. TASK-TBD -> develop (PR)

Phase 2:
2. TASK-TBD -> develop (PR, after Phase 1 merged)
```

---

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: SPRINT-055a
      type: sprint
      title: "Contact Bug Fixes"
      status: must_be_complete
    - id: TASK-463
      type: task
      phase: 1
      title: "Single-Screen Contact Management Flow"
      backlog: BACKLOG-463
    - id: TASK-418
      type: task
      phase: 2
      title: "Redesign Contact Selection UX"
      backlog: BACKLOG-418

  edges:
    - from: SPRINT-055a
      to: TASK-463
      type: depends_on
      reason: "Bug fixes should be complete before UX overhaul"
    - from: TASK-463
      to: TASK-418
      type: depends_on
      reason: "Role assignment uses UnifiedContactSelector from Phase 1"
```

---

## File Conflict Matrix

| File/Area | Tasks | Conflict Risk | Resolution |
|-----------|-------|---------------|------------|
| `src/components/shared/UnifiedContactSelector.tsx` | 463 | None | New file |
| `src/components/shared/RoleAssigner.tsx` | 418 | None | New file |
| `src/components/ContactSelectModal.tsx` | 463 | Medium | Replace with new component |
| `src/components/audit/ContactAssignmentStep.tsx` | 418 | Medium | Replace with new flow |
| `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` | 463, 418 | High | Phase 1 updates, Phase 2 may adjust |

**Note**: Phase 2 builds on Phase 1. Sequential execution prevents conflicts.

---

## Testing & Quality Plan

### Phase 1 Test Scenarios

1. **Unified List Display**:
   - [ ] Your Contacts section shows imported + manual
   - [ ] Address Book section shows external
   - [ ] Source badges displayed correctly

2. **Auto-Import on Selection**:
   - [ ] Selecting external contact triggers import
   - [ ] Contact moves to Your Contacts section
   - [ ] Selection retained after import

3. **Inline Add Contact**:
   - [ ] Form opens inline (no navigation)
   - [ ] New contact saved and selected
   - [ ] Form closes after save

4. **Search**:
   - [ ] Search filters both sections
   - [ ] Search by name, email, phone

### Phase 2 Test Scenarios

1. **Select First Flow**:
   - [ ] Step 1 shows UnifiedContactSelector
   - [ ] Multi-select works
   - [ ] Contacts loaded once

2. **Assign Roles Second**:
   - [ ] Step 2 shows only selected contacts
   - [ ] Dropdown per role
   - [ ] No API calls in Step 2

3. **Integration**:
   - [ ] Transaction creation uses new flow
   - [ ] Edit transaction uses new flow
   - [ ] No duplicate contact loading

### CI / CD Quality Gates

- [ ] Unit tests for new components
- [ ] Type checking (`npm run type-check`)
- [ ] Linting (`npm run lint`)
- [ ] Build step (`npm run build`)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large UX change causes user confusion | Medium | Medium | Add tooltips, maintain familiar patterns |
| Performance with large contact lists | Medium | Medium | Virtual scrolling, pagination |
| Address book permission issues | Low | Medium | Graceful fallback if unavailable |
| Existing flow regression | Medium | High | Comprehensive testing, phased rollout |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: Unified Selector | BACKLOG-463 | ~45K | Sequential |
| Phase 2: Role Assignment | BACKLOG-418 | ~40K | Sequential |
| **Total** | **2 tasks** | **~85K** | - |

**SR Review Overhead**: Add ~20K for reviews (large UX change)
**Contingency**: ~10K (12%)

**Sprint Total**: ~115K tokens

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-TBD | BACKLOG-463 | Blocked | - | - | - |
| 2 | TASK-TBD | BACKLOG-418 | Blocked | - | - | - |

**Blocker**: SPRINT-055a must be complete before starting.

---

## End-of-Sprint Validation Checklist

- [ ] All tasks merged to develop
- [ ] All CI checks passing

**Single-Screen Contact Flow (Phase 1):**
- [ ] Unified list shows imported + address book
- [ ] Auto-import works on selection
- [ ] Inline add contact works
- [ ] Search works across both sections
- [ ] Source badges displayed

**Role Assignment (Phase 2):**
- [ ] Step 1: Select contacts (UnifiedContactSelector)
- [ ] Step 2: Assign roles (dropdowns from selected)
- [ ] Single contact load per transaction
- [ ] 3 duplicate components removed
- [ ] All integration points updated

---

## Migration Notes

### Deprecated Components
After SPRINT-055b, the following should be deprecated/removed:
- Old ContactSelectModal (if not reusable)
- Old ImportContactsModal (navigation version)
- Duplicate role assignment components

### Backwards Compatibility
- Keep ImportContactsModal available for Dashboard bulk import (optional)
- Ensure saved transactions with existing contacts still work

---

## Related Documentation

- **SPRINT-055a**: Bug Fixes (first half of original SPRINT-055)
- **BACKLOG-386**: Unified Contact Selection UX (superseded by this work)
- **Engineer Workflow**: `.claude/docs/ENGINEER-WORKFLOW.md`
- **PR-SOP**: `.claude/docs/PR-SOP.md`
