# Task TASK-2046: Email Sync Custom Folders

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

Expand email sync to discover and fetch emails from all user mailbox folders (not just Inbox and Sent Mail), so that emails filed in archives, custom folders, subfolders, and labels are visible in Magic Audit.

## Non-Goals

- Do NOT add a folder selection/filter UI (future sprint)
- Do NOT modify attachment download logic (only email message sync)
- Do NOT change the email deduplication strategy
- Do NOT add folder metadata display in the UI (e.g., showing which folder an email came from)
- Do NOT sync Spam, Trash, or Drafts folders

## Deliverables

1. Update: `electron/services/gmailFetchService.ts` -- Add label discovery and multi-label fetch
2. Update: `electron/services/outlookFetchService.ts` -- Add mailFolder discovery and multi-folder fetch
3. Update: `electron/handlers/emailSyncHandlers.ts` -- Wire folder discovery into sync flow
4. Update: `electron/services/db/emailDbService.ts` -- Store folder/label metadata with emails (if not already)
5. New tests: `electron/services/__tests__/gmailFetchService.folder.test.ts` -- Gmail folder discovery tests
6. New tests: `electron/services/__tests__/outlookFetchService.folder.test.ts` -- Outlook folder discovery tests

## Acceptance Criteria

- [ ] Gmail sync discovers all user labels beyond INBOX and SENT via the Gmail Labels API
- [ ] Gmail sync fetches messages from discovered labels (excluding SPAM, TRASH, DRAFT, CATEGORY_* system labels)
- [ ] Outlook sync discovers all mail folders beyond Inbox and SentItems via the mailFolders API
- [ ] Outlook sync fetches messages from discovered folders (excluding JunkEmail, DeletedItems, Drafts)
- [ ] Existing email deduplication prevents duplicates when same email appears in multiple folders/labels
- [ ] Sync progress events include folder/label information
- [ ] No regression in existing Inbox/Sent sync behavior
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Gmail: Label Discovery

Gmail uses a flat label system. Use the Labels API to discover all labels:

```typescript
// Gmail Labels API
const labels = await gmail.users.labels.list({ userId: 'me' });

// Filter to relevant labels
const EXCLUDED_LABELS = ['SPAM', 'TRASH', 'DRAFT', 'UNREAD', 'STARRED', 'IMPORTANT'];
const EXCLUDED_PREFIXES = ['CATEGORY_'];

const syncableLabels = labels.data.labels?.filter(label => {
  if (!label.id) return false;
  if (EXCLUDED_LABELS.includes(label.id)) return false;
  if (EXCLUDED_PREFIXES.some(p => label.id!.startsWith(p))) return false;
  return true;
}) || [];
```

Then for each label, use the existing message list/fetch logic but with `labelIds` filter:

```typescript
// Fetch messages for a specific label
const messages = await gmail.users.messages.list({
  userId: 'me',
  labelIds: [labelId],
  maxResults: 500,
});
```

### Outlook: Folder Discovery

Outlook uses a hierarchical folder system. Use the mailFolders API:

```typescript
// Note: outlookFetchService already has a getFolders() method
const folders = await this.getFolders(); // /me/mailFolders

// Exclude system folders we don't want
const EXCLUDED_FOLDERS = ['junkemail', 'deleteditems', 'drafts', 'outbox', 'conflicts'];

const syncableFolders = folders.filter(folder => {
  const name = (folder.displayName || '').toLowerCase();
  return !EXCLUDED_FOLDERS.includes(name);
});

// For each folder, fetch messages
for (const folder of syncableFolders) {
  const messages = await this._graphRequest<GraphApiResponse<GraphMessage>>(
    `/me/mailFolders/${folder.id}/messages?$select=...&$top=100`
  );
}
```

**Important:** Outlook supports nested folders. Use `childFolders` endpoint to discover subfolders:

```typescript
// Discover child folders recursively
async function discoverAllFolders(parentId?: string): Promise<Folder[]> {
  const endpoint = parentId
    ? `/me/mailFolders/${parentId}/childFolders`
    : '/me/mailFolders';
  const result = await this._graphRequest(endpoint);
  // Recurse into each folder's children
}
```

### Key Considerations

- **Rate limiting**: Both Gmail and Outlook have API rate limits. Use existing rate limiting infrastructure (`rateLimiters` in `electron/utils/rateLimit.ts`).
- **Deduplication**: The same email can appear under multiple Gmail labels. Rely on `emailDeduplicationService.ts` and `getEmailByExternalId` checks to prevent duplicates.
- **Incremental sync**: Ensure the existing incremental sync logic (sync from last sync date) applies to all folders, not just Inbox/Sent.
- **Existing getFolders()**: `outlookFetchService.ts` already has a `getFolders()` method (line ~759). Build on it rather than creating a new one.

## Integration Notes

- Imports from: `gmailFetchService.ts`, `outlookFetchService.ts`
- Used by: `emailSyncHandlers.ts` (the sync flow entry point)
- Related: `emailDeduplicationService.ts` (prevents duplicates across folders)
- No dependencies on other SPRINT-093 tasks (Batch 1, parallel-safe)

## Do / Don't

### Do:
- Build on the existing `getFolders()` method in outlookFetchService
- Reuse existing email parsing and storage logic for messages from new folders
- Log which folders/labels are being synced for debugging
- Handle API errors per-folder gracefully (skip folder, continue with others)

### Don't:
- Create a new service file -- extend existing fetch services
- Sync Spam, Trash, Drafts, or Outlook Outbox
- Change the email data model (store folder info in existing fields or add minimal metadata)
- Block sync completion on any single folder failure

## When to Stop and Ask

- If Gmail Labels API requires additional OAuth scopes beyond what's already configured
- If Outlook childFolders endpoint requires different permissions
- If the existing deduplication logic cannot handle cross-folder duplicates
- If adding folder discovery significantly changes the sync flow architecture

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Gmail label discovery: filters system labels, returns user labels
  - Gmail multi-label fetch: fetches from each discovered label
  - Outlook folder discovery: filters excluded folders, discovers child folders
  - Outlook multi-folder fetch: fetches from each discovered folder
  - Error handling: single folder failure does not break sync
- Existing tests to update:
  - `gmailFetchService.test.ts` -- ensure existing tests still pass with expanded sync
  - `outlookFetchService.test.ts` -- ensure existing tests still pass

### Coverage

- Coverage impact: Must not decrease overall coverage

### Integration / Feature Tests

- Required scenarios:
  - Full sync with mocked Gmail API returning messages across 3+ labels
  - Full sync with mocked Outlook API returning messages across 3+ folders including nested

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(email): expand sync to discover and fetch all mailbox folders`
- **Labels**: `feature`, `email-sync`
- **Depends on**: None (Batch 1, parallel)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~30K-50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new test files | +8K |
| Files to modify | 3-4 files (scope: medium) | +20K |
| Code volume | ~200-300 lines new/modified | +15K |
| Test complexity | Medium (API mocking) | +10K |

**Confidence:** Medium

**Risk factors:**
- Gmail label types may have edge cases (nested labels, special characters)
- Outlook folder hierarchy recursion depth unknown
- Rate limiting behavior with many folders

**Similar past tasks:** TASK-1173 (email sync provider fetch, archived)

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
- [ ] electron/services/__tests__/gmailFetchService.folder.test.ts
- [ ] electron/services/__tests__/outlookFetchService.folder.test.ts

Features implemented:
- [ ] Gmail label discovery and multi-label fetch
- [ ] Outlook folder discovery (including child folders) and multi-folder fetch
- [ ] Folder-aware sync in emailSyncHandlers
- [ ] Error isolation per folder

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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~40K | ~XK | +/-X% |
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
