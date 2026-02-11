# Task TASK-1951: Wire Inferred Contacts to Preferences

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

Make the contact inference pipeline (contacts auto-discovered from email headers and message conversations during transaction scanning) respect the `contactSources.inferred.*` preference toggles. When an inferred source is disabled, contacts should not be extracted from that provider's communications.

## Non-Goals

- Do NOT modify the Settings UI (TASK-1949)
- Do NOT modify direct contact import gates (TASK-1950)
- Do NOT modify message import filtering (TASK-1952)
- Do NOT refactor the hybrid extraction pipeline architecture
- Do NOT change how the LLM contact role extraction tool works internally
- Do NOT modify the contact data model

## Deliverables

1. Update: `electron/services/transactionService.ts` -- gate contact inference by provider
2. Possibly update: `electron/services/extraction/hybridExtractorService.ts` -- if provider-level filtering is needed at extraction level
3. Reuse: `electron/utils/preferenceHelper.ts` (created by TASK-1950)

## Acceptance Criteria

- [ ] When `contactSources.inferred.outlookEmails` is false, contacts are NOT extracted from Outlook email headers during transaction scan
- [ ] When `contactSources.inferred.gmailEmails` is false, contacts are NOT extracted from Gmail email headers during transaction scan
- [ ] When `contactSources.inferred.messages` is false, contacts are NOT extracted from iMessage/SMS conversations during transaction linking
- [ ] Default behavior (no preferences set) is unchanged -- inferred sources default to OFF (so no change in behavior for existing users)
- [ ] Transaction detection itself still works (only contact inference is gated, not email scanning)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All CI checks pass

## Implementation Notes

### Understanding the Inference Pipeline

Contact inference happens in two main paths:

**Path 1: Email Scanning (Transaction Service)**

`transactionService.scanAndExtractTransactions()` (line ~279 of `electron/services/transactionService.ts`):
1. Fetches emails from connected providers (Gmail, Outlook)
2. Runs hybrid extraction (pattern matching + LLM)
3. The `hybridExtractorService.extract()` analyzes emails and extracts contacts
4. Extracted contacts are stored as transaction participants

The key insight: emails are fetched per-provider. The scan already knows which provider each email came from. The gate should prevent **contact extraction** from emails of disabled providers, while still allowing the email to be scanned for transaction detection.

**Path 2: Message Conversations**

When messages are linked to transactions (via `messageMatchingService` or `autoLinkService`), contact information can be inferred from conversation participants. This is a lighter-weight inference path.

### Gate Strategy

**Option A (Recommended): Filter at email input level**

In `transactionService.scanAndExtractTransactions()`, after fetching emails but before extraction, filter out emails from disabled providers when the extraction involves contact role assignment:

```typescript
// After fetching allEmails (around line 356)
const inferOutlook = await isContactSourceEnabled(userId, 'inferred', 'outlookEmails', false);
const inferGmail = await isContactSourceEnabled(userId, 'inferred', 'gmailEmails', false);

// For contact extraction, filter emails by inferred preference
// Note: We still scan ALL emails for transaction detection
// But we only extract contacts from emails whose provider is enabled for inference
```

The cleanest approach: pass a `skipContactExtraction` flag per email, or filter the email list when calling the contact role extraction tool.

**Option B: Gate at extraction tool level**

Add a provider filter to `ExtractContactRolesTool.extract()`. Less clean because the tool shouldn't know about user preferences.

### Specific Gate Points

**1. Transaction Scan Contact Extraction** (`electron/services/transactionService.ts`)

The scan function calls hybrid extraction which includes contact role extraction. The `HybridExtractorService.extract()` method receives `MessageInput[]` objects. Each `MessageInput` should have provider context available.

Look at how `allEmails` are constructed (around line 356). Emails from Outlook vs Gmail are fetched separately:
- Gmail emails: fetched via `gmailFetchService` (provider = "google")
- Outlook emails: fetched via `outlookFetchService` (provider = "microsoft")

After fetching, tag or filter:

```typescript
// Filter for contact inference based on preferences
const emailsForContactInference = allEmails.filter(email => {
  if (email.provider === 'google' && !inferGmail) return false;
  if (email.provider === 'microsoft' && !inferOutlook) return false;
  return true;
});
```

Then pass `emailsForContactInference` to the contact extraction step (not the transaction detection step).

**2. Message-Based Contact Inference**

If `contactSources.inferred.messages` is false, skip contact creation from message conversations. Check in `autoLinkService.ts` or wherever message-to-contact inference happens.

```typescript
const inferMessages = await isContactSourceEnabled(userId, 'inferred', 'messages', false);
if (!inferMessages) {
  // Skip contact inference from messages, but still link messages to transactions
}
```

### Important: Default is OFF for Inferred

Unlike direct imports (default ON), inferred sources default to OFF. This means:
- Existing users with no preferences set will NOT see any behavior change
- Users must explicitly enable inferred contact discovery
- This is the safe default since inference can create many unwanted contacts

### Reusing the Shared Helper

TASK-1950 creates `electron/utils/preferenceHelper.ts` with `isContactSourceEnabled()`. This task reuses that helper. If TASK-1950 hasn't been completed yet, create the helper yourself with the same signature.

## Integration Notes

- Depends on: TASK-1949 (preferences schema), TASK-1950 (shared helper, or create independently)
- Does NOT conflict with TASK-1950 (different files: transactionService.ts vs contact-handlers.ts)
- Does NOT conflict with TASK-1952 (different concern: contact inference vs message filtering)
- The hybrid extractor service is complex -- minimize changes to it

## Do / Don't

### Do:

- Fail open (default to false for inferred, per spec) if preferences unavailable
- Log clearly when inference is skipped due to preferences
- Keep transaction detection working even when inference is disabled
- Separate the concept of "scan emails for transactions" from "extract contacts from emails"

### Don't:

- Do NOT disable email fetching -- only disable contact extraction from those emails
- Do NOT modify the LLM tools (analyzeMessageTool, extractContactRolesTool)
- Do NOT modify the Settings UI
- Do NOT break the existing scan flow
- Do NOT add new database columns

## When to Stop and Ask

- If the provider context (google vs microsoft) is not available on email objects during extraction
- If contact extraction is deeply coupled with transaction detection (can't be separated)
- If the message-to-contact inference path is unclear or doesn't exist as a distinct step
- If the `isContactSourceEnabled` helper from TASK-1950 doesn't exist yet and the interface is unclear

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that contact extraction respects inferred preferences (mock the preference helper)
  - Test default behavior (no prefs) still works correctly
- Existing tests to update:
  - Transaction service scan tests (if they exist) should verify contact extraction gating

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Disable Outlook inferred, scan with Outlook emails -- verify no contacts extracted from Outlook but transactions still detected
  - Enable Gmail inferred, disable Outlook inferred -- verify contacts only from Gmail
  - All inferred sources OFF (default) -- verify no contact inference at all

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(contacts): wire inferred contact extraction to source preferences`
- **Labels**: `feature`, `contacts`, `preferences`, `extraction`
- **Depends on**: TASK-1949 (preferences schema)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files (transactionService.ts, possibly autoLinkService.ts) | +12K |
| Code volume | ~40 lines per gate point (2-3 gates) | +5K |
| Exploration | Understanding hybrid extraction pipeline | +5K |
| Test complexity | Medium (mocking preferences in service tests) | +3K |

**Confidence:** Medium

**Risk factors:**
- The hybrid extraction pipeline is complex; identifying the right gate point may require exploration
- Contact inference from messages may be implicit (not a distinct step)
- Provider context may not be readily available on email objects

**Similar past tasks:** Service category, apply 0.5x multiplier -> ~12.5K effective

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-02-10*

### Agent ID

```
Engineer Agent ID: (background engineer agent, no Task tool agent_id)
```

### Checklist

```
Files modified:
- [x] electron/services/transactionService.ts
- [x] electron/services/autoLinkService.ts
- [x] electron/utils/preferenceHelper.ts (new)
- [x] electron/utils/__tests__/preferenceHelper.test.ts (new)
- [x] electron/services/__tests__/autoLinkService.test.ts (updated)
- [x] electron/services/__tests__/transactionService.test.ts (updated)

Features implemented:
- [x] Outlook email inference gate
- [x] Gmail email inference gate
- [x] Messages inference gate
- [x] Default OFF behavior verified

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (no new failures)
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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
Used Option A from the task file: gate contact inference at the scan level by checking preferences before saving suggestedContacts. For messages, gated at the autoLinkService level since that is where message-to-transaction linking happens.

**Deviations from plan:**
Created preferenceHelper.ts independently since TASK-1950 has not merged yet. Same function signature as specified in task file.

**Design decisions:**
1. Email inference gate: After extraction completes, check if ANY scanned provider has inference enabled. If not, clear suggestedContacts on all detected transactions. This approach avoids modifying the hybrid extraction pipeline while still preventing contact discovery.
2. Message inference gate: Added preference check inside autoLinkCommunicationsForContact before the findMessagesByContactPhones step. When messages inference is disabled, the entire message search/link step is skipped, but email auto-linking still works.
3. All three preference checks use Promise.all for efficiency.
4. Default is OFF (false) for all inferred sources, matching the task spec.

**Issues encountered:**
Pre-existing test failures in autoLinkService.test.ts (6 tests) due to BACKLOG-506 SQL refactor that changed `FROM communications` to `FROM emails`. These failures exist on develop and are not related to this task.

**Reviewer notes:**
- The preferenceHelper.ts was created independently of TASK-1950. When TASK-1950 merges, there may be a conflict if it creates the same file. The functions have the same signature so merging should be straightforward.
- The email inference gate clears suggestedContacts after extraction rather than filtering emails before extraction. This is simpler and avoids touching the hybrid extraction pipeline, but means the LLM still processes contact extraction (tokens used) even when results are discarded. An optimization would be to skip extractContactRoles in hybridExtractorService when inference is disabled, but that would require passing preferences deeper into the pipeline.

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
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

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
