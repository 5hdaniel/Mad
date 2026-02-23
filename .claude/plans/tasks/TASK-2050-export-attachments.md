# Task TASK-2050: Attachments Missing From Audit Export

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

Include email attachments in the audit export package (folder export), so auditors receive complete documentation including contracts, amendments, disclosures, and other files attached to emails within a transaction.

## Non-Goals

- Do NOT add iMessage/text message attachment export (different attachment storage, future task)
- Do NOT add attachment preview or inline rendering in the export
- Do NOT change the PDF export format (only folder export)
- Do NOT add attachment compression or deduplication within the export
- Do NOT modify how attachments are downloaded or cached (use existing emailAttachmentService)
- Do NOT add a UI for selecting which attachments to include

## Deliverables

1. Update: `electron/services/folderExportService.ts` -- Add attachment collection to export flow
2. Update: `electron/services/folderExport/emailExportHelpers.ts` -- Include attachment files alongside email data
3. Update: `electron/services/folderExport/attachmentHelpers.ts` -- Extend for email attachment file copying
4. Update: `electron/services/emailAttachmentService.ts` -- Ensure batch attachment retrieval method exists
5. Update tests: `electron/services/__tests__/folderExportService.test.ts` -- Verify attachments included in export
6. New tests: Test attachment collection and folder structure creation

## Acceptance Criteria

- [ ] Email attachments are included in the folder export package under a clear directory structure
- [ ] Each email's attachments are grouped with their parent email (e.g., `emails/<email-id>/attachments/`)
- [ ] Attachment original filenames are preserved (with conflict handling for duplicates)
- [ ] Export handles missing/inaccessible attachments gracefully (skip with warning, don't fail)
- [ ] Export size warning is logged if total attachments exceed 50MB
- [ ] Attachment metadata (filename, size, content type) is included in the export manifest
- [ ] No regression in existing export functionality (emails, messages, contacts, notes)
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Current Export Architecture

The folder export service (`folderExportService.ts`) delegates to helpers in `folderExport/`:

- `emailExportHelpers.ts` -- Exports email threads as text/HTML files
- `textExportHelpers.ts` -- Exports text message threads
- `attachmentHelpers.ts` -- Currently handles text message attachments (iMessage photos/files)
- `summaryHelpers.ts` -- Generates summary/manifest files

The email attachment service (`emailAttachmentService.ts`) handles downloading attachments from Gmail/Outlook APIs and caching them locally.

### Export Directory Structure (Target)

```
export-package/
+-- manifest.json
+-- emails/
|   +-- thread-001/
|   |   +-- thread.html
|   |   +-- attachments/
|   |       +-- contract-amendment.pdf
|   |       +-- property-disclosure.docx
|   +-- thread-002/
|       +-- thread.html
|       +-- attachments/
|           +-- inspection-report.pdf
+-- messages/
|   +-- (existing text message exports)
+-- summary.txt
```

### Attachment Collection Flow

```typescript
/**
 * Collect and copy email attachments for a transaction's emails.
 *
 * For each email thread in the transaction:
 * 1. Look up attachments in the local database
 * 2. If attachment data is cached locally, copy from cache
 * 3. If not cached, attempt to download via emailAttachmentService
 * 4. Copy attachment files to the export directory
 * 5. Record in manifest
 */
async function exportEmailAttachments(
  transactionId: string,
  emailThreads: EmailThread[],
  exportDir: string,
): Promise<AttachmentExportResult> {
  const results: AttachmentExportResult = {
    exported: 0,
    skipped: 0,
    totalSizeBytes: 0,
    errors: [],
  };

  for (const thread of emailThreads) {
    const threadDir = path.join(exportDir, 'emails', sanitizeFilename(thread.id));
    const attachDir = path.join(threadDir, 'attachments');

    for (const email of thread.emails) {
      if (!email.attachments || email.attachments.length === 0) continue;

      // Ensure attachments directory exists
      fs.mkdirSync(attachDir, { recursive: true });

      for (const attachment of email.attachments) {
        try {
          const attachmentData = await emailAttachmentService.getAttachmentContent(
            email.externalId,
            attachment.id,
          );

          if (!attachmentData) {
            results.skipped++;
            results.errors.push(`Missing: ${attachment.filename} (email ${email.externalId})`);
            continue;
          }

          // Handle filename conflicts
          const safeName = resolveFilenameConflict(attachDir, attachment.filename);
          const destPath = path.join(attachDir, safeName);

          fs.writeFileSync(destPath, attachmentData);
          results.exported++;
          results.totalSizeBytes += attachmentData.length;
        } catch (error) {
          results.skipped++;
          results.errors.push(
            `Failed: ${attachment.filename} - ${error instanceof Error ? error.message : String(error)}`
          );
          // Continue with other attachments -- don't fail the entire export
        }
      }
    }
  }

  // Size warning
  if (results.totalSizeBytes > 50 * 1024 * 1024) {
    await logService.warn(
      `Export attachments total ${(results.totalSizeBytes / 1024 / 1024).toFixed(1)}MB -- may be large`,
      "FolderExport"
    );
  }

  return results;
}
```

### Filename Conflict Resolution

```typescript
/**
 * If a file with the same name already exists in the directory,
 * append a counter: report.pdf -> report (1).pdf -> report (2).pdf
 */
function resolveFilenameConflict(dir: string, filename: string): string {
  let candidate = sanitizeFilename(filename);
  let counter = 1;

  while (fs.existsSync(path.join(dir, candidate))) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    candidate = sanitizeFilename(`${base} (${counter})${ext}`);
    counter++;
  }

  return candidate;
}
```

### Manifest Update

Add attachment metadata to the export manifest:

```typescript
interface ExportManifest {
  // ... existing fields ...
  attachments: {
    totalCount: number;
    exportedCount: number;
    skippedCount: number;
    totalSizeBytes: number;
    items: Array<{
      emailId: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      exportPath: string;
    }>;
    errors: string[];
  };
}
```

### Key Files to Study

- `electron/services/folderExportService.ts` -- Main export orchestration
- `electron/services/folderExport/emailExportHelpers.ts` -- How email threads are currently exported
- `electron/services/folderExport/attachmentHelpers.ts` -- Existing attachment export (text messages)
- `electron/services/emailAttachmentService.ts` -- How attachments are fetched and cached
- `electron/services/__tests__/folderExportService.test.ts` -- Existing export tests
- `electron/services/__tests__/emailAttachmentService.test.ts` -- Existing attachment tests

### Important: sanitizeFilename

The project already has a `sanitizeFilename` utility (deduplicated in SPRINT-090, TASK-2031). Use it rather than creating a new one. Check `electron/utils/` or the import in `folderExportService.ts`.

## Integration Notes

- Imports from: `emailAttachmentService.ts` (attachment content retrieval)
- Modifies: `folderExportService.ts`, `folderExport/emailExportHelpers.ts`, `folderExport/attachmentHelpers.ts`
- No overlap with TASK-2046 (email sync), TASK-2047 (iMessage), TASK-2048 (migrations), or TASK-2049 (network disconnect)
- Related: BACKLOG-545 (this is the fix)
- Related: SPRINT-084 tasks (TASK-1775 through TASK-1783) which added email attachment download, display, and preview -- this task builds on that infrastructure

## Do / Don't

### Do:
- Reuse existing `emailAttachmentService` for fetching attachment content
- Reuse existing `sanitizeFilename` utility
- Stream large attachments to disk rather than buffering entirely in memory
- Skip inaccessible attachments with a warning (don't fail the whole export)
- Add attachment summary to the export manifest

### Don't:
- Re-download attachments that are already cached locally
- Include attachments from emails outside the transaction scope
- Modify the PDF export path (only folder export)
- Add iMessage attachment export (separate task)
- Block the export on a single attachment failure

## When to Stop and Ask

- If `emailAttachmentService.getAttachmentContent()` does not exist or has a different signature
- If the export directory structure conflicts with existing export consumers
- If attachments are stored in a format that requires transformation before export
- If the total attachment size for a typical transaction exceeds 500MB (streaming approach may be needed)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Export with 0 attachments produces valid package (no crash)
  - Export with 3 attachments from 2 email threads creates correct directory structure
  - Missing attachment is skipped with warning, other attachments still exported
  - Filename conflict resolution produces unique names
  - Size warning is logged when attachments exceed 50MB threshold
  - Manifest includes attachment metadata
- Existing tests to update:
  - `folderExportService.test.ts` -- may need to mock emailAttachmentService

### Coverage

- Coverage impact: Must not decrease overall coverage

### Integration / Feature Tests

- Required scenarios:
  - Full export of transaction with emails that have attachments
  - Export with mix of accessible and inaccessible attachments (graceful degradation)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(export): include email attachments in audit folder export`
- **Labels**: `bug`, `export`
- **Depends on**: None (Batch 2, independent of TASK-2049)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K-60K

**Token Cap:** 240K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0-1 new test files | +5K |
| Files to modify | 4-5 files (scope: medium-large) | +25K |
| Code volume | ~300-400 lines new/modified | +18K |
| Test complexity | Medium-High (file I/O mocking, attachment mocking) | +12K |

**Confidence:** Low

**Risk factors:**
- Unknown attachment caching state (may need to download from API during export)
- Large attachment memory handling may need streaming
- Multiple service integration points (emailAttachmentService, folderExportService, helpers)
- Export directory structure must be compatible with existing consumers

**Similar past tasks:** TASK-1777 (export email attachments, archived -- similar but different export path)

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
- [ ] (test files if needed)

Features implemented:
- [ ] Attachment collection from emailAttachmentService
- [ ] Directory structure: emails/<thread-id>/attachments/
- [ ] Filename conflict resolution
- [ ] Graceful skip for missing/inaccessible attachments
- [ ] Size warning logging
- [ ] Manifest metadata for attachments

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

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~50K | ~XK | +/-X% |
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
