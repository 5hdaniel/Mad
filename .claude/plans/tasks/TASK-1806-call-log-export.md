# Task TASK-1806: Call Log Export Integration

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

Include call logs in transaction audit exports (PDF and folder/audit package), providing a complete communication audit trail.

## Non-Goals

- Do NOT implement call recording export (not available)
- Do NOT create standalone call export (only integrated with transaction export)
- Do NOT implement new export UI (use existing patterns)

## Deliverables

1. Update: `electron/services/pdfExportService.ts` - Add call log section
2. Update: `electron/services/folderExportService.ts` - Add call log CSV
3. Update: `src/types/export.ts` - Add call log export types if needed

## Acceptance Criteria

- [ ] PDF export includes "Call History" section with summary
- [ ] PDF shows call statistics per contact (total calls, duration)
- [ ] PDF lists calls chronologically with direction, duration, date
- [ ] Folder export includes `call-logs.csv` file
- [ ] CSV includes all call fields (contact, phone, direction, duration, timestamp)
- [ ] Calls filtered by transaction contacts (same as UI)
- [ ] Calls respect audit period date range
- [ ] Export works when no calls exist (empty section, not error)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### PDF Section Structure

Add to `electron/services/pdfExportService.ts`:

```typescript
/**
 * Generate call history section for PDF
 */
async function generateCallHistorySection(
  doc: PDFDocument,
  calls: CallLogWithContact[],
  yPosition: number
): Promise<number> {
  // Section header
  doc.setFontSize(14);
  doc.text('Call History', 20, yPosition);
  yPosition += 10;

  if (calls.length === 0) {
    doc.setFontSize(10);
    doc.text('No call history recorded for this transaction.', 20, yPosition);
    return yPosition + 15;
  }

  // Summary statistics
  const stats = calculateCallStats(calls);
  doc.setFontSize(10);
  doc.text(`Total Calls: ${stats.totalCalls}`, 20, yPosition);
  doc.text(`Total Duration: ${formatTotalDuration(stats.totalDuration)}`, 80, yPosition);
  yPosition += 8;
  doc.text(`Incoming: ${stats.incoming}  |  Outgoing: ${stats.outgoing}  |  Missed: ${stats.missed}`, 20, yPosition);
  yPosition += 15;

  // Call list table
  const tableData = calls.map(call => [
    formatDate(call.timestamp),
    call.contact_name || 'Unknown',
    call.phone_number,
    call.direction,
    call.direction === 'missed' ? 'Missed' : formatCallDuration(call.duration),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Date/Time', 'Contact', 'Phone', 'Direction', 'Duration']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
    margin: { left: 20, right: 20 },
  });

  return doc.lastAutoTable.finalY + 15;
}

/**
 * Calculate call statistics
 */
function calculateCallStats(calls: CallLogWithContact[]): {
  totalCalls: number;
  totalDuration: number;
  incoming: number;
  outgoing: number;
  missed: number;
} {
  return {
    totalCalls: calls.length,
    totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
    incoming: calls.filter(c => c.direction === 'incoming').length,
    outgoing: calls.filter(c => c.direction === 'outgoing').length,
    missed: calls.filter(c => c.direction === 'missed').length,
  };
}

/**
 * Format total duration in hours and minutes
 */
function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
```

### Folder Export CSV

Add to `electron/services/folderExportService.ts`:

```typescript
/**
 * Export call logs to CSV file
 */
async function exportCallLogsCsv(
  outputDir: string,
  calls: CallLogWithContact[]
): Promise<void> {
  const csvPath = path.join(outputDir, 'call-logs.csv');

  const headers = [
    'Date/Time',
    'Contact Name',
    'Phone Number',
    'Direction',
    'Duration (seconds)',
    'Duration (formatted)',
  ];

  const rows = calls.map(call => [
    call.timestamp,
    call.contact_name || '',
    call.phone_number,
    call.direction,
    call.duration?.toString() || '',
    call.direction === 'missed' ? 'Missed' : formatCallDuration(call.duration),
  ]);

  // Use existing CSV generation utility
  await writeCsv(csvPath, headers, rows);
}
```

### Integration with Export Flow

In the main export function, add call log handling:

```typescript
// In exportTransaction or similar:

// Fetch call logs for transaction
const calls = await callLogDbService.getCallLogsForTransaction(
  userId,
  transactionId,
  {
    startDate: auditStartDate,
    endDate: auditEndDate,
    sortOrder: 'asc',  // Chronological for export
  }
);

// For PDF export:
yPosition = await generateCallHistorySection(doc, calls, yPosition);

// For folder export:
await exportCallLogsCsv(outputDir, calls);
```

### Per-Contact Call Statistics

For the PDF "Contacts" section, add call stats per contact:

```typescript
// When generating contact section:
const contactCallStats = await callLogDbService.getCallStatsForContact(userId, contact.id);

// Display in contact card:
doc.text(`Calls: ${contactCallStats.totalCalls} (${formatTotalDuration(contactCallStats.totalDuration)})`, x, y);
```

## Integration Notes

- Imports from: `electron/services/db/callLogDbService.ts` (TASK-1804)
- Exports to: PDF and folder export files
- Used by: Transaction export functionality
- Depends on: TASK-1804 (query service)
- Pattern follows: Existing email/message export sections

## Do / Don't

### Do:

- Follow existing PDF section patterns
- Include summary statistics (auditors want quick overview)
- Sort calls chronologically for export (oldest first)
- Handle empty call list gracefully
- Respect audit period date filtering

### Don't:

- Don't break existing export functionality
- Don't add call export if no other exports exist for transaction
- Don't skip null handling for duration/contact_name
- Don't forget CSV header row

## When to Stop and Ask

- If PDF library (jspdf/autotable) patterns differ from expected
- If export service structure has changed
- If date filtering requirements are unclear

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - PDF call section generation test
  - CSV export test
  - Statistics calculation test
  - Empty call list handling
- Existing tests to update:
  - Export service tests - add call log assertions

### Coverage

- Coverage impact: Export functions should have test coverage

### Integration / Feature Tests

- Required scenarios:
  - PDF includes call section after emails/messages
  - Folder export includes call-logs.csv
  - Export with no calls shows "no calls" message
  - Date filtering applies to exported calls

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(export): add call log export to PDF and folder`
- **Labels**: `feature`, `export`
- **Depends on**: TASK-1804

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 3 files (pdf, folder, types) | +8K |
| Code volume | ~200 lines additions | +4K |
| Test complexity | Medium - export testing | +4K |

**Confidence:** High

**Risk factors:**
- PDF library quirks
- CSV encoding issues

**Similar past tasks:** Service tasks use x0.5 multiplier = ~15K

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
Files modified:
- [ ] electron/services/pdfExportService.ts
- [ ] electron/services/folderExportService.ts
- [ ] src/types/export.ts (if needed)

Features implemented:
- [ ] PDF call history section
- [ ] Call statistics summary
- [ ] CSV export file
- [ ] Per-contact call stats

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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~15K | ~XK | +/-X% |
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
