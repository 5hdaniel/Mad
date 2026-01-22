# Task TASK-963: Split TransactionDetails.tsx into Tab Components

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

Split `TransactionDetails.tsx` (832 lines) into focused tab components and migrate direct `window.api` calls to service abstractions, reducing the main component to <400 lines.

## Non-Goals

- Do NOT add new functionality to the transaction details modal
- Do NOT change the tab structure or UX
- Do NOT modify the modal open/close behavior
- Do NOT refactor other transaction components

## Deliverables

1. **Tab Components:** Extract each tab to its own component
2. **Service Migration:** Replace `window.api` calls with service abstractions
3. **Main Component:** Reduce TransactionDetails.tsx to <400 lines

## Acceptance Criteria

- [ ] `TransactionInfoTab.tsx` extracted
- [ ] `CommunicationsTab.tsx` extracted
- [ ] `AttachmentsTab.tsx` extracted
- [ ] All direct `window.api` calls replaced with service methods
- [ ] `TransactionDetails.tsx` reduced to <400 lines
- [ ] Tab navigation still works correctly
- [ ] All functionality preserved (no behavior changes)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Step 1: Analyze Current Structure

First, understand the component structure:

```bash
# Count lines
wc -l src/components/transaction/components/TransactionDetails.tsx

# Find window.api calls
grep -n "window.api" src/components/transaction/components/TransactionDetails.tsx
```

Identify:
- How many tabs exist
- What `window.api` calls are made
- What state is shared between tabs
- How tab switching is implemented

### Step 2: Create Directory Structure

```
src/components/transaction/components/
+-- TransactionDetails.tsx         # Main component (<400 lines)
+-- tabs/
    +-- index.ts                   # Barrel export
    +-- TransactionInfoTab.tsx     # Basic info display
    +-- CommunicationsTab.tsx      # Emails/texts
    +-- AttachmentsTab.tsx         # File attachments
    +-- (ContactsTab.tsx if exists)
```

### Step 3: Define Tab Props Interface

```typescript
// tabs/types.ts (or at top of each tab file)
interface TabProps {
  transactionId: string;
  transaction: Transaction;
  onRefresh?: () => void;
}
```

### Step 4: Extract TransactionInfoTab

```typescript
// tabs/TransactionInfoTab.tsx
import { transactionService } from '@/services';

interface TransactionInfoTabProps {
  transactionId: string;
  transaction: Transaction;
}

export function TransactionInfoTab({ transactionId, transaction }: TransactionInfoTabProps) {
  // Move the "Info" tab content here
  // Replace window.api calls with service calls
  return (
    <div>
      {/* Transaction info display */}
    </div>
  );
}
```

### Step 5: Extract CommunicationsTab

```typescript
// tabs/CommunicationsTab.tsx
import { communicationService } from '@/services';

interface CommunicationsTabProps {
  transactionId: string;
}

export function CommunicationsTab({ transactionId }: CommunicationsTabProps) {
  // Move the "Communications" tab content here
  // Replace window.api.getEmailsForTransaction with service call
  return (
    <div>
      {/* Email/text list */}
    </div>
  );
}
```

### Step 6: Extract AttachmentsTab

```typescript
// tabs/AttachmentsTab.tsx
import { attachmentService } from '@/services';

interface AttachmentsTabProps {
  transactionId: string;
}

export function AttachmentsTab({ transactionId }: AttachmentsTabProps) {
  // Move the "Attachments" tab content here
  return (
    <div>
      {/* Attachment list */}
    </div>
  );
}
```

### Step 7: Replace window.api Calls

Before:
```typescript
// Direct IPC call (architecture violation)
const emails = await window.api.getEmailsForTransaction(txId);
```

After:
```typescript
// Using service abstraction
import { communicationService } from '@/services';
const emails = await communicationService.getEmailsForTransaction(txId);
```

If service methods don't exist, create them in the appropriate service file.

### Step 8: Update Main Component

```typescript
// TransactionDetails.tsx
import { TransactionInfoTab, CommunicationsTab, AttachmentsTab } from './tabs';

function TransactionDetails({ transactionId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState('info');
  const { transaction } = useTransaction(transactionId);

  return (
    <Modal onClose={onClose}>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'info' && (
        <TransactionInfoTab transactionId={transactionId} transaction={transaction} />
      )}
      {activeTab === 'communications' && (
        <CommunicationsTab transactionId={transactionId} />
      )}
      {activeTab === 'attachments' && (
        <AttachmentsTab transactionId={transactionId} />
      )}
    </Modal>
  );
}
```

### Important Details

- Keep tab switching state in the parent component
- Pass minimal props to tab components
- Each tab should fetch its own data using services
- Create service methods if they don't exist

## Integration Notes

- Imports from: `@/services/*` for API calls
- Exports to: Used by TransactionList and other transaction components
- Used by: Transaction list when viewing details
- Depends on: None (parallel safe with TASK-960, TASK-961)

## Do / Don't

### Do:
- Keep state management in parent component
- Use consistent prop patterns across tabs
- Create missing service methods if needed
- Test each tab independently

### Don't:
- Use `window.api` directly in extracted tabs
- Create circular dependencies
- Change the public API of TransactionDetails
- Break existing modal behavior

## When to Stop and Ask

- If you find >5 `window.api` calls without corresponding service methods
- If tab state management is complex and needs refactoring
- If you need to create more than 2 new service files
- If existing tests fail and the fix is non-obvious

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes, for each extracted tab component
- New tests to write:
  - Basic render test for each tab
  - Service call verification
- Existing tests to update: TransactionDetails tests if they exist

### Coverage

- Coverage impact: Should increase (new components with tests)

### Integration / Feature Tests

- Required scenarios:
  - Tab switching works correctly
  - Each tab displays correct data
  - Modal close still works

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking (no window.api in new tab files)
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs with direct window.api calls in tab components WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(ui): extract TransactionDetails tab components`
- **Labels**: `refactor`, `ui`, `architecture`
- **Depends on**: None

---

## SR Engineer Review Notes

**Review Date:** 2026-01-04 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `refactor/TASK-963-transaction-details-tabs`

### Execution Classification
- **Parallel Safe:** Yes (different files than TASK-960, TASK-961)
- **Depends On:** None
- **Blocks:** None

### Pre-Implementation Analysis

**Current state:**
- `TransactionDetails.tsx` is 832 lines (target: <400)
- Contains 4 `window.api` calls identified:
  - Line 74: `window.api.transactions.getDetails()`
  - Line 96: `window.api.transactions.unlinkCommunication()`
  - Line 129: `window.api.transactions.update()`
  - Line 143: `window.api.transactions.delete()`

**Architecture compliance:**
- These `window.api` calls should be migrated to service abstractions
- Check if `transactionService` or similar exists in renderer

### Shared File Analysis
- Files modified: `src/components/transaction/components/TransactionDetails.tsx`
- New files: `src/components/transaction/components/tabs/*.tsx`
- Conflicts with: None (isolated to transaction UI)

### Technical Considerations
- 4 `window.api` calls need service abstraction - low count, manageable
- Tab extraction is straightforward component refactoring
- Ensure tab state management stays in parent component
- New tab components should receive props, not use hooks that call window.api

### Architecture Enforcement
During PR review, I will verify:
- [ ] No `window.api` calls in new tab component files
- [ ] Tab components use service methods or receive data via props
- [ ] Main component reduced to <400 lines
- [ ] Tab switching logic remains in parent

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~20-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4-5 (tabs + barrel) | +12K |
| Files to modify | 1-2 (main + services) | +8K |
| Service methods | 0-2 new methods | +5K |

**Confidence:** Medium-High

**Risk factors:**
- Unknown number of window.api calls
- Service methods may not exist

**Similar past tasks:** TASK-514-519 (TransactionList refactor) avg -40% variance

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
- [ ] src/components/transaction/components/tabs/index.ts
- [ ] src/components/transaction/components/tabs/TransactionInfoTab.tsx
- [ ] src/components/transaction/components/tabs/CommunicationsTab.tsx
- [ ] src/components/transaction/components/tabs/AttachmentsTab.tsx

Files modified:
- [ ] src/components/transaction/components/TransactionDetails.tsx
- [ ] <service files if methods added>

window.api calls removed:
- [ ] Count: X calls removed
- [ ] Replaced with service methods

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] TransactionDetails.tsx < 400 lines
- [ ] Tab navigation works correctly
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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL (no window.api in tabs)
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
