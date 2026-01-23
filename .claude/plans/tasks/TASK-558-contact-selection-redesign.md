# Task TASK-558: Contact Selection UX Redesign

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Redesign the contact selection UX to use a "Select First, Assign Roles Second" pattern that eliminates N+1 contact loading and provides a unified experience across all contact selection flows.

**This task consolidates:**
- BACKLOG-418: Select First, Assign Roles Second
- BACKLOG-385: Contact Email Missing Prompt
- BACKLOG-386: Unified Contact Selection UX

## Non-Goals

- Do NOT change the contact data model (database schema)
- Do NOT add new contact source types (import logic)
- Do NOT implement contact deduplication
- Do NOT modify the dashboard Contacts screen (only selection modals)
- Do NOT add contact export functionality

## Deliverables

1. New file: `src/components/shared/ContactSelector.tsx` - Multi-select contact list
2. New file: `src/components/shared/RoleAssigner.tsx` - Role assignment dropdowns
3. New file: `src/components/shared/ContactRoleFlow.tsx` - Combines both components
4. New file: `src/components/shared/EmailPromptModal.tsx` - Missing email prompt
5. Update: `src/components/audit/ContactAssignmentStep.tsx` - Use new flow
6. Update: `src/components/transaction/components/EditTransactionModal.tsx` - Use new flow
7. Update: `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Use new flow
8. Delete: `src/components/audit/RoleAssignment.tsx` - Replaced by RoleAssigner

## Acceptance Criteria

- [ ] Step 2 (Select Contacts) loads contacts exactly once
- [ ] Step 2 shows multi-select checklist with search/filter
- [ ] Step 3 (Assign Roles) uses dropdowns populated from Step 2 selections
- [ ] Step 3 makes NO API calls (pure UI)
- [ ] No UI freeze in Create Transaction flow
- [ ] Email prompt appears when contacts missing email addresses
- [ ] Source tags visible on contact cards ([IMPORTED], [EXTERNAL], [MANUAL])
- [ ] Create Transaction modal uses new flow
- [ ] Edit Transaction modal uses new flow
- [ ] Edit Contacts modal uses new flow
- [ ] Old duplicate components removed
- [ ] TypeScript compiles
- [ ] Existing tests updated/pass

## Implementation Notes

### Current Flow (BAD - N+1 Problem)

```
Step 2: Client & Agents
  Buyer           [Select Contact] <- loads contacts
  Seller          [Select Contact] <- loads contacts again
  Listing Agent   [Select Contact] <- loads contacts again
  Buying Agent    [Select Contact] <- loads contacts again
```

### New Flow (GOOD - Single Load)

```
Step 2: Select Contacts
  [x] John Smith (john@email.com)
  [x] Sarah Johnson (+1 424-555-1234)
  [x] Bob Wilson (bob@company.com)
  [ ] Alice Brown (alice@example.com)

Step 3: Assign Roles
  Buyer:         [John Smith    v]
  Seller:        [Sarah Johnson v]
  Listing Agent: [Bob Wilson    v]
```

### Component Architecture

```
ContactRoleFlow.tsx
├── ContactSelector.tsx (Step 2)
│   ├── Search input
│   ├── Filter toggles (Imported, External, Manual)
│   └── Contact list with checkboxes
│       └── ContactCard with source tag
│
├── EmailPromptModal.tsx (Between steps, if needed)
│   └── Inline email inputs for contacts missing email
│
└── RoleAssigner.tsx (Step 3)
    └── Dropdown per role
        └── Options = selected contacts from Step 2
```

### State Shape

```typescript
interface ContactFlowState {
  // Step 2: Selected contacts (full objects)
  selectedContacts: Contact[];

  // Step 3: Role assignments (contact ID per role)
  roleAssignments: {
    buyer?: string;
    seller?: string;
    listing_agent?: string;
    buying_agent?: string;
    escrow?: string;
    title?: string;
    lender?: string;
  };
}
```

### ContactSelector.tsx

```typescript
interface ContactSelectorProps {
  contacts: Contact[];           // All contacts (passed in, already loaded)
  selectedIds: string[];         // Currently selected contact IDs
  onSelectionChange: (ids: string[]) => void;
  filters?: {
    showImported?: boolean;
    showExternal?: boolean;
    showManual?: boolean;
    showMessage?: boolean;       // Default false (hide weird numbers)
  };
}

// Features:
// - Search by name/email/phone
// - Multi-select checkboxes
// - Source tag badges: [IMPORTED] [EXTERNAL] [MANUAL]
// - Filter toggles
```

### RoleAssigner.tsx

```typescript
interface RoleAssignerProps {
  availableContacts: Contact[];  // Contacts selected in Step 2
  assignments: Record<string, string | undefined>;
  onAssignmentsChange: (assignments: Record<string, string | undefined>) => void;
  roles: RoleDefinition[];       // Which roles to show
}

interface RoleDefinition {
  key: string;                   // e.g., 'buyer'
  label: string;                 // e.g., 'Buyer'
  required?: boolean;
}

// Features:
// - Dropdown per role
// - Options populated from availableContacts
// - "-- Select --" option for optional roles
// - Same contact can be assigned to multiple roles
// - Visual indicator for unassigned required roles
```

### EmailPromptModal.tsx

```typescript
interface EmailPromptModalProps {
  contacts: Contact[];           // Contacts missing email
  onSave: (updates: { id: string; email: string }[]) => Promise<void>;
  onSkip: () => void;
}

// Shows:
// - List of contacts without emails
// - Inline email input for each
// - "Add Emails Now" and "Skip for Now" buttons
// - Email validation before save
```

### Integration Points

**Create Transaction (audit flow):**
```
Step 1: Property Details
Step 2: Select Contacts (ContactSelector)
  → Email prompt if needed
Step 3: Assign Roles (RoleAssigner)
Step 4: Confirmation
```

**Edit Transaction Modal:**
- Replace multiple "Select Contact" buttons with ContactRoleFlow

**Edit Contacts Modal:**
- Replace existing UI with ContactRoleFlow

### Files to Delete

After implementation, delete these replaced components:
- `src/components/audit/RoleAssignment.tsx` (if exists)
- Any other duplicate contact selection components

## Do / Don't

### Do:
- Load contacts ONCE at the start of the flow
- Pass contacts down as props (no duplicate fetching)
- Use controlled components for form state
- Add loading states for initial contact fetch
- Memoize filtered contact lists
- Support keyboard navigation in selector

### Don't:
- Make API calls in RoleAssigner
- Fetch contacts per role dropdown
- Duplicate the contact list data
- Add new contact creation in this flow (separate feature)
- Break existing data model

## When to Stop and Ask

- If contact loading is more complex than expected
- If existing audit flow requires major restructuring
- If role definitions vary significantly between contexts
- If source field doesn't exist on Contact type (needs data model change)
- If you encounter more than 3 duplicate implementations to consolidate

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `ContactSelector.test.tsx` - selection, filtering, search
  - `RoleAssigner.test.tsx` - assignment, dropdown behavior
  - `EmailPromptModal.test.tsx` - validation, save, skip
  - `ContactRoleFlow.test.tsx` - integration of steps

### Coverage

- Coverage impact: Target 40% on new components

### Integration / Feature Tests

- Required scenarios:
  - Create transaction with 3 contacts, 3 roles
  - Edit existing transaction contacts
  - Contact without email triggers prompt
  - Search filters contact list
  - Same contact assigned to multiple roles

### CI Requirements

- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Build succeeds

**PRs without tests for new components WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(contacts): redesign contact selection UX with select-first pattern`
- **Labels**: `feature`, `ux`, `contacts`
- **Depends on**: TASK-552 (schema complete)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~40K-50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new components | +20K |
| Files to modify | 3 existing modals | +12K |
| Code volume | ~500-700 lines | +8K |
| Test complexity | Medium (4 test files) | +10K |

**Confidence:** Medium

**Risk factors:**
- Unknown complexity of existing audit flow
- May discover additional integration points
- Email prompt adds scope

**Similar past tasks:** Large UI refactors in SPRINT-045

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] src/components/shared/ContactSelector.tsx
- [ ] src/components/shared/RoleAssigner.tsx
- [ ] src/components/shared/ContactRoleFlow.tsx
- [ ] src/components/shared/EmailPromptModal.tsx
- [ ] src/components/shared/__tests__/ContactSelector.test.tsx
- [ ] src/components/shared/__tests__/RoleAssigner.test.tsx
- [ ] src/components/shared/__tests__/EmailPromptModal.test.tsx
- [ ] src/components/shared/__tests__/ContactRoleFlow.test.tsx

Files modified:
- [ ] src/components/audit/ContactAssignmentStep.tsx
- [ ] src/components/transaction/components/EditTransactionModal.tsx
- [ ] src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx

Files deleted:
- [ ] (list any removed duplicates)

Features implemented:
- [ ] Single contact load (no N+1)
- [ ] Multi-select checklist with search
- [ ] Role assignment dropdowns
- [ ] Email missing prompt
- [ ] Source tags on contacts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Create Transaction flow works
- [ ] Edit Transaction flow works
- [ ] Edit Contacts flow works
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~45K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~45K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
