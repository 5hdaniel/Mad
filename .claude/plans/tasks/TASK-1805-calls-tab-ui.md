# Task TASK-1805: Calls Tab UI Component

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Create a new "Calls" tab in transaction details to display phone call history for contacts assigned to the transaction, following the same patterns as TransactionMessagesTab.

## Non-Goals

- Do NOT implement call log import (TASK-1801, TASK-1803)
- Do NOT implement export (TASK-1806)
- Do NOT implement call recording playback (not available)
- Do NOT implement timeline integration (future work)

## Deliverables

1. New file: `src/components/transactionDetailsModule/components/TransactionCallsTab.tsx`
2. New file: `src/components/transactionDetailsModule/components/CallCard.tsx`
3. New file: `src/components/transactionDetailsModule/components/__tests__/TransactionCallsTab.test.tsx`
4. Update: `src/components/transactionDetailsModule/components/index.ts` - Export new components
5. Update: `src/components/transactionDetailsModule/components/TransactionTabs.tsx` - Add Calls tab
6. Update: `src/components/TransactionDetails.tsx` - Wire up Calls tab data

## Acceptance Criteria

- [ ] "Calls" tab appears alongside Messages, Emails, etc.
- [ ] Tab shows call count badge
- [ ] Calls list filtered by transaction contacts
- [ ] Each call shows: direction icon, contact name/number, duration, date/time
- [ ] Filter by direction (All, Incoming, Outgoing, Missed)
- [ ] Sort by date (newest first by default)
- [ ] Audit period filter support (same as Messages tab)
- [ ] Empty state when no calls exist
- [ ] Loading state during data fetch
- [ ] Error state for fetch failures
- [ ] Responsive layout (consistent with Messages tab)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Component Structure

Follow the pattern of TransactionMessagesTab.tsx:

```typescript
// src/components/transactionDetailsModule/components/TransactionCallsTab.tsx

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { CallLogWithContact, CallDirection } from '../../../../electron/types/callLog';
import { CallCard } from './CallCard';
import { parseDateSafe } from '../../../utils/dateFormatters';

interface TransactionCallsTabProps {
  /** Call logs linked to transaction contacts */
  calls: CallLogWithContact[];
  /** Whether calls are being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** User ID for API calls */
  userId?: string;
  /** Transaction ID */
  transactionId?: string;
  /** Audit period start date for filtering */
  auditStartDate?: Date | string | null;
  /** Audit period end date for filtering */
  auditEndDate?: Date | string | null;
}

/**
 * Direction filter options
 */
type DirectionFilter = 'all' | 'incoming' | 'outgoing' | 'missed';

export function TransactionCallsTab({
  calls,
  loading,
  error,
  userId,
  transactionId,
  auditStartDate,
  auditEndDate,
}: TransactionCallsTabProps): JSX.Element {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [showAuditPeriodOnly, setShowAuditPeriodOnly] = useState(false);

  // Filter calls by direction and audit period
  const filteredCalls = useMemo(() => {
    let result = calls;

    // Apply direction filter
    if (directionFilter !== 'all') {
      result = result.filter(c => c.direction === directionFilter);
    }

    // Apply audit period filter
    if (showAuditPeriodOnly && (auditStartDate || auditEndDate)) {
      result = result.filter(c => isCallInAuditPeriod(c, auditStartDate, auditEndDate));
    }

    return result;
  }, [calls, directionFilter, showAuditPeriodOnly, auditStartDate, auditEndDate]);

  // Loading state
  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading calls...</div>;
  }

  // Error state
  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  // Empty state
  if (calls.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <PhoneIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No call history</p>
        <p className="text-sm">
          Call logs will appear here once imported from your device.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        {/* Direction filter */}
        <div className="flex gap-2">
          {(['all', 'incoming', 'outgoing', 'missed'] as DirectionFilter[]).map(dir => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              className={`px-3 py-1 rounded-full text-sm ${
                directionFilter === dir
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {dir === 'all' ? 'All' : dir.charAt(0).toUpperCase() + dir.slice(1)}
            </button>
          ))}
        </div>

        {/* Audit period toggle */}
        {(auditStartDate || auditEndDate) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAuditPeriodOnly}
              onChange={e => setShowAuditPeriodOnly(e.target.checked)}
              className="rounded"
            />
            <span>Audit period only</span>
          </label>
        )}

        {/* Count */}
        <span className="ml-auto text-sm text-gray-500">
          {filteredCalls.length} {filteredCalls.length === 1 ? 'call' : 'calls'}
        </span>
      </div>

      {/* Call list */}
      <div className="space-y-2">
        {filteredCalls.map(call => (
          <CallCard key={call.id} call={call} />
        ))}
      </div>

      {/* Filtered empty state */}
      {filteredCalls.length === 0 && calls.length > 0 && (
        <div className="p-4 text-center text-gray-500">
          No calls match the current filters.
        </div>
      )}
    </div>
  );
}
```

### CallCard Component

```typescript
// src/components/transactionDetailsModule/components/CallCard.tsx

import React from 'react';
import type { CallLogWithContact } from '../../../../electron/types/callLog';
import { formatCallDuration } from '../../../utils/formatters';
import { formatDateRelative } from '../../../utils/dateFormatters';

interface CallCardProps {
  call: CallLogWithContact;
}

export function CallCard({ call }: CallCardProps): JSX.Element {
  const directionIcon = {
    incoming: <ArrowDownIcon className="w-4 h-4 text-green-500" />,
    outgoing: <ArrowUpIcon className="w-4 h-4 text-blue-500" />,
    missed: <PhoneMissedIcon className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-white border rounded-lg hover:bg-gray-50">
      {/* Direction icon */}
      <div className="flex-shrink-0">
        {directionIcon[call.direction]}
      </div>

      {/* Contact info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {call.contact_name || call.phone_number}
        </p>
        {call.contact_name && (
          <p className="text-sm text-gray-500 truncate">
            {call.phone_number}
          </p>
        )}
      </div>

      {/* Duration */}
      <div className="text-sm text-gray-600">
        {call.direction === 'missed' ? (
          <span className="text-red-500">Missed</span>
        ) : (
          formatCallDuration(call.duration)
        )}
      </div>

      {/* Timestamp */}
      <div className="text-sm text-gray-500 text-right">
        {formatDateRelative(call.timestamp)}
      </div>
    </div>
  );
}
```

### Adding to TransactionTabs

In `TransactionTabs.tsx`, add the Calls tab:

```typescript
// Add to tabs array
const tabs = [
  { id: 'details', label: 'Details' },
  { id: 'contacts', label: 'Contacts', count: contactsCount },
  { id: 'emails', label: 'Emails', count: emailsCount },
  { id: 'messages', label: 'Messages', count: messagesCount },
  { id: 'calls', label: 'Calls', count: callsCount },  // New tab
  { id: 'attachments', label: 'Attachments', count: attachmentsCount },
];
```

### Wiring in TransactionDetails

```typescript
// In TransactionDetails.tsx, add call loading:

const [calls, setCalls] = useState<CallLogWithContact[]>([]);
const [callsLoading, setCallsLoading] = useState(false);
const [callsError, setCallsError] = useState<string | null>(null);

// Load calls when transaction changes
useEffect(() => {
  if (userId && transactionId) {
    setCallsLoading(true);
    window.api.callLogs
      .getForTransaction(userId, transactionId)
      .then(result => {
        setCalls(result);
        setCallsError(null);
      })
      .catch(error => {
        setCallsError(error.message);
      })
      .finally(() => {
        setCallsLoading(false);
      });
  }
}, [userId, transactionId]);

// In render, add case for calls tab:
case 'calls':
  return (
    <TransactionCallsTab
      calls={calls}
      loading={callsLoading}
      error={callsError}
      userId={userId}
      transactionId={transactionId}
      auditStartDate={transaction.start_date}
      auditEndDate={transaction.end_date}
    />
  );
```

## Integration Notes

- Imports from: `electron/types/callLog.ts` (TASK-1800), query API (TASK-1804)
- Exports to: Used by TransactionDetails.tsx
- Used by: End users viewing transaction details
- Depends on: TASK-1804 (query service must exist)
- Pattern follows: `TransactionMessagesTab.tsx`, `TransactionEmailsTab.tsx`

## Do / Don't

### Do:

- Follow TransactionMessagesTab patterns exactly
- Use consistent styling with other tabs
- Include proper loading, error, and empty states
- Support audit period filtering
- Include call count in tab badge

### Don't:

- Don't add features not in Messages tab (keep parity)
- Don't forget responsive design
- Don't hardcode colors (use theme classes)
- Don't skip accessibility attributes

## When to Stop and Ask

- If TransactionTabs component structure differs from expected
- If date filtering patterns are unclear
- If styling approach has changed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `TransactionCallsTab.test.tsx`
  - Test filter functionality
  - Test empty state rendering
  - Test loading state
  - Test error state
  - `CallCard.test.tsx`
  - Test direction icons
  - Test duration formatting
- Existing tests to update:
  - TransactionDetails tests - add calls tab

### Coverage

- Coverage impact: New components should have >60% coverage

### Integration / Feature Tests

- Required scenarios:
  - Calls tab appears in transaction details
  - Filter buttons work correctly
  - Audit period filter works
  - Empty state shows when no calls

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(ui): add Calls tab to transaction details`
- **Labels**: `feature`, `ui`
- **Depends on**: TASK-1804

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new files (tab, card, tests) | +12K |
| Files to modify | 3 files (index, tabs, details) | +6K |
| Code volume | ~500 lines components + tests | +5K |
| Test complexity | Medium - component testing | +5K |

**Confidence:** Medium

**Risk factors:**
- UI component patterns may have evolved
- Styling consistency needs careful attention

**Similar past tasks:** UI tasks use x1.0 multiplier = ~25K

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
- [ ] TransactionCallsTab.tsx
- [ ] CallCard.tsx
- [ ] TransactionCallsTab.test.tsx

Files modified:
- [ ] components/index.ts
- [ ] TransactionTabs.tsx
- [ ] TransactionDetails.tsx

Features implemented:
- [ ] Calls tab with list view
- [ ] Direction filter
- [ ] Audit period filter
- [ ] Empty/loading/error states
- [ ] Tab badge count

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
