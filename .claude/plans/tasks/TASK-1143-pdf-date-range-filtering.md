# Task TASK-1143: PDF Export Date Range Filtering

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

Ensure PDF exports filter/truncate messages based on the transaction's representation start date and closing date. Only communications within the transaction's date range should be included in the exported PDF.

## Non-Goals

- Do NOT modify how dates are stored in the database
- Do NOT change the message linking behavior (filtering is export-time only)
- Do NOT add new UI for date selection (dates come from transaction record)
- Do NOT modify the Audit Package folder export (only PDF export)

## Deliverables

1. Update: `electron/services/pdfExportService.ts` - Add date filtering before PDF generation
2. Verify: `electron/services/enhancedExportService.ts` - Ensure date filtering is applied to PDF format

## Acceptance Criteria

- [ ] PDF exports exclude messages before `representation_start_date`
- [ ] PDF exports exclude messages after `closing_date`
- [ ] If no start date: include all messages up to closing date
- [ ] If no closing date: include all messages from start date onwards
- [ ] If neither date set: include all linked messages (current behavior)
- [ ] Export summary shows filtered message count vs total linked (optional but nice)
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Current Date Filtering

`enhancedExportService.ts` already has date filtering (lines 119-138):

```typescript
/**
 * Filter communications by date range
 * @private
 */
private _filterCommunicationsByDate(
  communications: Communication[],
  startDate?: string,
  endDate?: string,
): Communication[] {
  if (!startDate && !endDate) {
    return communications;
  }

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  return communications.filter((comm) => {
    const commDate = new Date(comm.sent_at as string);
    if (start && commDate < start) return false;
    if (end && commDate > end) return false;
    return true;
  });
}
```

### Issue: Not Applied to PDF Export Path

The `exportTransaction()` method in `enhancedExportService.ts` accepts `representationStartDate` and `closingDate` in options but the PDF path goes directly to `pdfExportService.generateTransactionPDF()` which doesn't use these filters.

Check `_exportPDF()` method (lines 278-294):
```typescript
private async _exportPDF(
  transaction: Transaction,
  communications: Communication[],
): Promise<string> {
  // ... calls pdfExportService.generateTransactionPDF()
  // But does the filtering happen BEFORE this call?
}
```

### Fix Approach

Ensure date filtering happens BEFORE calling any export format:

```typescript
async exportTransaction(
  transaction: Transaction,
  communications: Communication[],
  options: ExportOptions = {},
): Promise<string> {
  const {
    contentType = "both",
    exportFormat = "pdf",
    representationStartDate,
    closingDate,
  } = options;

  // 1. Filter by date range FIRST
  let filteredComms = this._filterCommunicationsByDate(
    communications,
    representationStartDate,  // Use these if provided in options
    closingDate,
  );

  // OR use transaction dates if not in options
  if (!representationStartDate && !closingDate) {
    filteredComms = this._filterCommunicationsByDate(
      communications,
      transaction.representation_start_date as string,
      transaction.closing_date as string,
    );
  }

  // 2. Then filter by address relevance
  filteredComms = this._filterByAddressRelevance(
    filteredComms,
    transaction.property_address,
  );

  // 3. Then filter by content type
  filteredComms = this._filterByContentType(filteredComms, contentType);

  // Log filtered count for debugging
  logService.info(
    `[Enhanced Export] Filtered to ${filteredComms.length} of ${communications.length} communications`,
    "EnhancedExport",
  );

  // ... rest of export
}
```

### Verify ExportModal Passes Dates

Check `src/components/ExportModal.tsx` - the dates are updated but verify they're passed to the export:

```typescript
// In handleExport():
result = await window.api.transactions.exportEnhanced(
  transaction.id,
  { exportFormat },  // Are dates included here?
);
```

If dates aren't passed, add them:
```typescript
result = await window.api.transactions.exportEnhanced(
  transaction.id,
  {
    exportFormat,
    representationStartDate,
    closingDate,
  },
);
```

### Transaction Handler Check

In `electron/transaction-handlers.ts`, check if the enhanced export handler uses the dates:

```typescript
ipcMain.handle("transactions:export-enhanced", async (event, transactionId, options) => {
  // Does it pass options.representationStartDate and options.closingDate?
});
```

## Integration Notes

- Imports from: Transaction model (for dates)
- Used by: `transactions:export-enhanced` IPC handler
- Related to: ExportModal.tsx (UI passes dates)
- Depends on: TASK-1141 and TASK-1142 should be merged first (to avoid conflicts on enhancedExportService)

## Do / Don't

### Do:

- Use the transaction's dates if not explicitly provided in options
- Handle null/undefined dates gracefully
- Log filtered count for debugging
- Test edge cases (no start, no end, neither)

### Don't:

- Modify message linking behavior (filtering is export-time only)
- Add date picker UI (use transaction dates)
- Break other export formats (CSV, JSON, etc.)
- Remove the address relevance filtering

## When to Stop and Ask

- If date filtering breaks other export formats
- If the filtering order seems wrong (date vs address vs content type)
- If the ExportModal doesn't have access to the transaction dates

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test date filtering with start date only
  - Test date filtering with end date only
  - Test date filtering with both dates
  - Test date filtering with neither date (current behavior)
  - Test filtering order (date -> address -> content type)

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Export PDF with transaction dates set
  - Verify messages outside date range are excluded
  - Verify messages within date range are included

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(export): apply date range filtering to PDF exports`
- **Labels**: `export`, `fix`
- **Depends on**: TASK-1141, TASK-1142 (to avoid conflicts)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~12K-18K (apply service multiplier 0.5 = ~10K base)

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files (enhancedExportService, possibly handler) | +5K |
| Logic complexity | Low (filtering already exists) | +3K |
| Code volume | ~30-50 lines | +2K |
| Test complexity | Low | +5K |

**Confidence:** High (straightforward fix)

**Risk factors:**
- Filtering order may need investigation
- ExportModal may need minor updates

**Similar past tasks:** Date filtering is already implemented, just needs verification

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
- [ ] None

Files modified:
- [ ] electron/services/enhancedExportService.ts
- [ ] electron/transaction-handlers.ts (if needed)
- [ ] src/components/ExportModal.tsx (if needed)

Features implemented:
- [ ] Date filtering applied to PDF exports
- [ ] Edge cases handled
- [ ] Logging added

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

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
