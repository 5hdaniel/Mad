# Task TASK-2043: Audit Log Completeness -- Missing User Actions

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

Audit which user actions are tracked in the audit log and which are missing. Add audit logging for critical actions that are currently unlogged: exports, settings changes, contact modifications, message attachment operations, and login/logout events (if not already wired).

## Non-Goals

- Do NOT build an audit log viewer / reporting UI.
- Do NOT modify the audit log schema or database structure.
- Do NOT change the existing audit log sync mechanism to Supabase.
- Do NOT add audit logging for every single function call -- focus on user-initiated actions with security or compliance relevance.
- Do NOT modify auditService.ts beyond adding new `AuditAction` and `ResourceType` enum values if needed.

## Deliverables

1. Update: `electron/services/auditService.ts` -- add any missing `AuditAction` types (if needed)
2. Update: Handler files where user actions occur but audit logging is missing:
   - Export handlers (folder export, PDF export, enhanced export)
   - Settings handlers
   - Contact handlers (create, update, delete)
   - Message attachment handlers (attach, detach)
   - Session handlers (login/logout -- verify these are already wired)
3. Document: Which actions were already logged vs newly added (in Implementation Summary)

## Acceptance Criteria

- [ ] Audit of existing coverage completed -- documented which actions are already logged
- [ ] Export actions generate audit log entries (DATA_EXPORT)
- [ ] Settings changes generate audit log entries (SETTINGS_CHANGE)
- [ ] Contact create/update/delete generate audit log entries (CONTACT_CREATE, CONTACT_UPDATE, CONTACT_DELETE)
- [ ] Message attachment operations generate audit log entries (e.g., DATA_ACCESS or new action type)
- [ ] LOGIN and LOGOUT actions are confirmed as wired (already in sessionHandlers.ts -- verify)
- [ ] Audit log calls are wrapped in try-catch so failures do not break the main operation
- [ ] New audit entries include relevant metadata (resource IDs, action details)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Current Audit Log Infrastructure

**`electron/services/auditService.ts`** already defines:
```typescript
export type AuditAction =
  | "LOGIN" | "LOGOUT" | "LOGIN_FAILED"
  | "DATA_ACCESS" | "DATA_EXPORT" | "DATA_DELETE"
  | "TRANSACTION_CREATE" | "TRANSACTION_UPDATE" | "TRANSACTION_DELETE" | "TRANSACTION_SUBMIT"
  | "CONTACT_CREATE" | "CONTACT_UPDATE" | "CONTACT_DELETE"
  | "SETTINGS_CHANGE"
  | "MAILBOX_CONNECT" | "MAILBOX_DISCONNECT";

export type ResourceType =
  | "USER" | "SESSION" | "TRANSACTION" | "CONTACT"
  | "COMMUNICATION" | "EXPORT" | "SUBMISSION" | "MAILBOX" | "SETTINGS";
```

The types already exist for most actions. The question is whether these are actually CALLED in the handler code.

### Investigation Step (FIRST)

Before adding anything, audit what is already wired:

```bash
# Find all places auditService.log or auditService.create is called
grep -rn "auditService\." --include="*.ts" electron/handlers/ electron/services/ | grep -v test | grep -v __tests__
```

Document the results in your planning notes. Then identify the gaps.

### Pattern to Follow

```typescript
import auditService from '../services/auditService';

// In the handler, after the operation succeeds:
try {
  await auditService.log({
    userId,
    action: 'DATA_EXPORT',
    resourceType: 'EXPORT',
    resourceId: transactionId,
    success: true,
    metadata: {
      exportType: 'pdf',
      fileName: exportPath,
    },
  });
} catch (auditError) {
  // Never let audit logging failure break the main operation
  logService.warn('[Audit] Failed to log export action', 'ExportHandler', { auditError });
}
```

### Likely Missing Audit Points

Based on the existing AuditAction types and typical handler patterns:

| Action | Where to Add | AuditAction | ResourceType |
|--------|-------------|-------------|--------------|
| Folder export | `folderExportService.ts` or its handler | DATA_EXPORT | EXPORT |
| PDF export | `pdfExportService.ts` or its handler | DATA_EXPORT | EXPORT |
| Enhanced export | `enhancedExportService.ts` or handler | DATA_EXPORT | EXPORT |
| Settings change | Settings handler(s) | SETTINGS_CHANGE | SETTINGS |
| Contact create | Contact handler(s) | CONTACT_CREATE | CONTACT |
| Contact update | Contact handler(s) | CONTACT_UPDATE | CONTACT |
| Contact delete | Contact handler(s) | CONTACT_DELETE | CONTACT |
| Attach message to txn | Message/transaction handler | DATA_ACCESS | COMMUNICATION |
| Detach message from txn | Message/transaction handler | DATA_ACCESS | COMMUNICATION |

### New AuditAction Types (if needed)

If the existing types are insufficient, add new ones. Possible additions:
```typescript
| "MESSAGE_ATTACH"
| "MESSAGE_DETACH"
| "ATTACHMENT_DOWNLOAD"
```

Only add if `DATA_ACCESS` is not semantically appropriate for these operations.

## Integration Notes

- Imports from: `electron/services/auditService.ts`
- Exports to: N/A (adding calls, not APIs)
- Used by: N/A
- Depends on: None (Batch 1, parallel)

## Do / Don't

### Do:
- Start with an investigation of what is already wired
- Wrap ALL audit log calls in try-catch (audit failures must NEVER break main operations)
- Include meaningful metadata (resource IDs, operation details)
- Follow the existing pattern in sessionHandlers.ts for how auditService is called
- Document which actions were already logged vs newly added

### Don't:
- Let audit logging failures propagate and break user operations
- Add audit logging for internal/background operations (sync cycles, scheduled tasks)
- Modify the audit log table schema
- Add audit logging for read-only operations (viewing a transaction, loading the dashboard)
- Add audit calls to performance-critical loops

## When to Stop and Ask

- If the existing `auditService.log()` or `auditService.create()` method signature is different from expected
- If there is no clear handler for some operations (e.g., settings changes happen through IPC but there is no dedicated settings handler)
- If the audit log database table does not match the TypeScript types
- If >15 handler files need modification (scope may be larger than estimated)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that export operations create audit log entries (mock auditService)
  - Test that audit logging failure does not break the main operation
  - Test that new AuditAction types (if any) are valid
- Existing tests to update:
  - `electron/services/__tests__/auditService.test.ts` -- add tests for new action types if added

### Coverage

- Coverage impact: Must not decrease; new audit log calls in handlers should be covered by existing handler tests if auditService is mocked

### Integration / Feature Tests

- Required scenarios:
  - Perform an export, verify audit log entry created (manual test)
  - Change a setting, verify audit log entry created (manual test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(audit): add missing audit log entries for exports, settings, contacts, and attachments`
- **Labels**: `audit`, `security`, `rollout-readiness`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 8-12 handler/service files + auditService.ts | +20K |
| Code volume | ~5-10 lines per audit point, ~10-15 audit points | +10K |
| Test complexity | Medium (mock auditService, verify calls) | +10K |

**Confidence:** Medium

**Risk factors:**
- Number of missing audit points is uncertain until investigation
- Some operations may not have clean handler entry points
- Existing handler patterns may vary

**Similar past tasks:** Service-category tasks run at x0.5 multiplier.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/services/auditService.ts (if new action types needed)
- [ ] <handler files>

Features implemented:
- [ ] Investigation completed -- existing coverage documented
- [ ] Export audit logging added
- [ ] Settings change audit logging added
- [ ] Contact CRUD audit logging added
- [ ] Message attachment audit logging added
- [ ] LOGIN/LOGOUT verified as wired

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Include investigation results: which actions were already wired vs gaps found>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document decisions>

**Issues encountered:**
<Document issues>

**Reviewer notes:**
<Reviewer attention items>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

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
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
