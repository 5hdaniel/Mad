# Task TASK-1144: Gray Out Unimplemented Export Options

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

Update the ExportModal to visually disable unimplemented export format options (CSV, TXT+EML, JSON, Excel) and add a "Coming Soon" label to indicate they are planned but not yet available.

## Non-Goals

- Do NOT implement the actual export formats (CSV, JSON, etc.)
- Do NOT remove the options entirely (keep them visible for user awareness)
- Do NOT change the PDF or Audit Package options (they work)

## Deliverables

1. Update: `src/components/ExportModal.tsx` - Add disabled state and "Coming Soon" badge

## Acceptance Criteria

- [ ] CSV, TXT+EML, JSON, and Excel options are grayed out
- [ ] Each disabled option shows a "Coming Soon" label/badge
- [ ] Disabled options cannot be selected/clicked
- [ ] PDF and Audit Package options remain fully functional
- [ ] Styling is consistent with the existing UI design
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Current Code Location

In `src/components/ExportModal.tsx` lines 335-427, the export format buttons are defined:

```tsx
<div className="grid grid-cols-2 gap-3">
  <button onClick={() => setExportFormat("pdf")} ...>PDF Report</button>
  <button onClick={() => setExportFormat("excel")} ...>Excel (.xlsx)</button>
  <button onClick={() => setExportFormat("csv")} ...>CSV</button>
  <button onClick={() => setExportFormat("json")} ...>JSON</button>
  <button onClick={() => setExportFormat("txt_eml")} ...>TXT + EML Files</button>
  <button onClick={() => setExportFormat("folder")} ...>Audit Package</button>
</div>
```

### Implementation Pattern

```tsx
// Define which formats are currently implemented
const implementedFormats = ["pdf", "folder"];
const isFormatImplemented = (format: string) => implementedFormats.includes(format);

// In the format selection section:
<div className="grid grid-cols-2 gap-3">
  {/* PDF Report - Implemented */}
  <button
    onClick={() => setExportFormat("pdf")}
    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
      exportFormat === "pdf"
        ? "bg-purple-500 text-white shadow-md"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`}
  >
    <div className="font-semibold">PDF Report</div>
    <div className="text-xs opacity-80">Transaction report only</div>
  </button>

  {/* Excel - Coming Soon */}
  <button
    disabled
    className="px-4 py-3 rounded-lg font-medium transition-all text-left bg-gray-50 text-gray-400 cursor-not-allowed"
  >
    <div className="flex items-center justify-between">
      <span className="font-semibold">Excel (.xlsx)</span>
      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">Coming Soon</span>
    </div>
    <div className="text-xs opacity-60">Spreadsheet format</div>
  </button>

  {/* Similar for CSV, JSON, TXT+EML */}

  {/* Audit Package - Implemented */}
  <button
    onClick={() => setExportFormat("folder")}
    className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
      exportFormat === "folder"
        ? "bg-purple-500 text-white shadow-md"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`}
  >
    <div className="font-semibold">Audit Package</div>
    <div className="text-xs opacity-80">Folder with individual PDFs</div>
  </button>
</div>
```

### Refactored Approach (Cleaner)

```tsx
const formatOptions = [
  { id: "pdf", label: "PDF Report", description: "Transaction report only", implemented: true },
  { id: "folder", label: "Audit Package", description: "Folder with individual PDFs", implemented: true },
  { id: "excel", label: "Excel (.xlsx)", description: "Spreadsheet format", implemented: false },
  { id: "csv", label: "CSV", description: "Comma-separated values", implemented: false },
  { id: "json", label: "JSON", description: "Structured data", implemented: false },
  { id: "txt_eml", label: "TXT + EML Files", description: "Text files and email files", implemented: false },
];

// In render:
<div className="grid grid-cols-2 gap-3">
  {formatOptions.map((format) => (
    <button
      key={format.id}
      onClick={() => format.implemented && setExportFormat(format.id)}
      disabled={!format.implemented}
      className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
        !format.implemented
          ? "bg-gray-50 text-gray-400 cursor-not-allowed"
          : exportFormat === format.id
            ? "bg-purple-500 text-white shadow-md"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{format.label}</span>
        {!format.implemented && (
          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
            Coming Soon
          </span>
        )}
      </div>
      <div className="text-xs opacity-80">{format.description}</div>
    </button>
  ))}
</div>
```

### Styling for Disabled State

```css
/* Disabled button styling */
bg-gray-50        /* Light gray background */
text-gray-400     /* Muted text */
cursor-not-allowed /* Shows not-allowed cursor */

/* Coming Soon badge */
text-xs           /* Small text */
bg-gray-200       /* Slightly darker background */
text-gray-500     /* Medium gray text */
px-2 py-0.5       /* Small padding */
rounded           /* Rounded corners */
```

## Integration Notes

- Imports from: None new (Tailwind classes only)
- Used by: Export flow in TransactionDetails
- Related to: None

## Do / Don't

### Do:

- Keep the disabled options visible (users should know they're planned)
- Use consistent styling with the existing UI
- Make it clear the options are coming, not broken
- Test keyboard navigation (disabled buttons should be skipped)

### Don't:

- Remove the options entirely
- Change the behavior of PDF or Audit Package
- Add complex animations or effects
- Make it look like an error state

## When to Stop and Ask

- If the styling looks inconsistent with the rest of the modal
- If you're unsure about accessibility (keyboard/screen reader)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI-only change with no logic)
- If tests exist for ExportModal, ensure they don't break

### Coverage

- Coverage impact: Should not change

### Integration / Feature Tests

- Required scenarios:
  - Open export modal
  - Verify PDF and Audit Package can be selected
  - Verify CSV, Excel, JSON, TXT+EML cannot be selected
  - Verify "Coming Soon" badges are visible

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(export): gray out unimplemented export options with coming soon badge`
- **Labels**: `export`, `ui`
- **Depends on**: None (can be done independently)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~5K-10K (small UI change)

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file (ExportModal.tsx) | +3K |
| Logic complexity | Very low (just styling) | +1K |
| Code volume | ~20-40 lines | +2K |
| Test complexity | None | +0K |

**Confidence:** Very High (simple UI change)

**Risk factors:**
- None significant

**Similar past tasks:** Many UI polish tasks

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
- [ ] src/components/ExportModal.tsx

Features implemented:
- [ ] Disabled state for unimplemented formats
- [ ] Coming Soon badges
- [ ] Consistent styling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~8K | ~XK | +/-X% |
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
**Security Review:** N/A
**Test Coverage:** N/A (UI-only)

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
