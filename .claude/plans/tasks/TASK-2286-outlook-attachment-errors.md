# Task TASK-2286: Outlook Attachment Error Handling Improvement

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Improve error handling in `OutlookFetchService.getAttachment` to gracefully handle "No attachment data found" errors. Add retry logic for transient failures, graceful skip for permanently unavailable attachments, and enriched Sentry context. Sentry ELECTRON-16 shows 40 events of this error, primarily from Madison.

## Non-Goals

- Do NOT refactor the entire OutlookFetchService
- Do NOT change the attachment storage format
- Do NOT modify the email sync flow

## Deliverables

1. Modified: `electron/services/outlookFetchService.ts` -- Add retry + graceful skip in `getAttachment`

## File Boundaries

### Files to modify (owned by this task):

- `electron/services/outlookFetchService.ts` -- Modify `getAttachment` method

### Files this task must NOT modify:

- `electron/services/databaseService.ts` -- Owned by TASK-2279, TASK-2285
- `src/` -- Renderer code
- `admin-portal/` -- Admin portal

## Acceptance Criteria

- [ ] Transient failures (timeout, network error) retry up to 2 times with exponential backoff
- [ ] Permanent failures ("No attachment data found") log to Sentry and skip the attachment
- [ ] Sentry context includes: attachment ID, message ID, content type, file size (if known), retry count
- [ ] Skipped attachments don't block email sync for other messages
- [ ] No PII in Sentry events (no file names, no email content)
- [ ] Error messages use `electron-log` not `console.log`
- [ ] All CI checks pass

## Implementation Notes

### Current Behavior

`getAttachment` throws when the Microsoft Graph API returns no attachment data. This error propagates and can disrupt the email sync.

### Desired Behavior

1. Classify the error: transient (timeout, network) vs permanent (404, no data)
2. For transient errors: retry up to 2 times with 1s/3s backoff
3. For permanent errors: log to Sentry with context and return null (skip)
4. Caller handles null return by skipping that attachment

### Key Pattern

```typescript
async getAttachment(messageId: string, attachmentId: string): Promise<AttachmentData | null> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await this.graphClient.getAttachment(messageId, attachmentId);
      if (!response?.contentBytes) {
        Sentry.captureMessage('Outlook attachment: no data returned', {
          level: 'warning',
          tags: { component: 'outlook', operation: 'get_attachment' },
          extra: {
            messageId, // Graph API ID, not PII
            attachmentId,
            contentType: response?.contentType ?? 'unknown',
            attempt,
          },
        });
        return null; // Graceful skip
      }
      return response;
    } catch (error) {
      if (isTransientError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        log.warn(`[Outlook] Attachment fetch retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      Sentry.captureException(error, {
        tags: { component: 'outlook', operation: 'get_attachment' },
        extra: { messageId, attachmentId, attempt },
      });
      log.error(`[Outlook] Failed to fetch attachment after ${attempt + 1} attempts:`, error);
      return null; // Graceful skip on permanent failure
    }
  }
  return null;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      || (error.response?.status ?? 0) >= 500;
  }
  return false;
}
```

## Integration Notes

- **Independent of:** All other tasks in this sprint
- **Related to:** Outlook timeout issues (ELECTRON-1G, ELECTRON-1Q, ELECTRON-2S) -- separate Sentry issues, same service

## Do / Don't

### Do:
- Return null for skipped attachments (caller must handle)
- Use exponential backoff for retries
- Include Graph API IDs in Sentry context (not PII)
- Use `electron-log` for local logging

### Don't:
- Don't block email sync on a single attachment failure
- Don't retry permanent errors (404, no data)
- Don't include file names or email content in Sentry events
- Don't increase the existing 15s timeout

## When to Stop and Ask

- If the caller of `getAttachment` doesn't handle null returns
- If the retry logic needs to be shared with other Graph API calls

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Successful attachment fetch returns data
  - Missing data returns null and logs to Sentry
  - Transient error retries up to 2 times
  - Permanent error returns null without retry
  - Sentry context includes expected fields

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `fix(outlook): add retry logic and graceful skip for attachment fetch failures`
- **Labels**: `bug`, `outlook`, `error-handling`
- **Base branch**: `int/patch-j`
- **Sentry refs**: ELECTRON-16

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +5K |
| Code volume | ~60-80 lines (retry + classification + Sentry) | +5K |
| Tests | 5 test cases | +5K |

**Confidence:** High

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-03-19*

### Agent ID

```
Engineer Agent ID: agent-a308518d
```

### Checklist

```
Files modified:
- [x] electron/services/outlookFetchService.ts
- [x] electron/services/emailAttachmentService.ts (caller updated to handle null)
- [x] electron/services/__tests__/outlookFetchService.test.ts (7 test cases)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (79 outlookFetchService tests + 13 emailAttachmentService tests)
```

### Implementation Details

**Key decisions (informed by SR Engineer corrections):**

1. **Return type**: Changed from `Promise<Buffer>` to `Promise<Buffer | null>` (not `AttachmentData | null` as task template suggested)

2. **No additional retry logic**: `_graphRequest` already uses `withRetry` with 5 retries for rate limits, 5xx errors, and network errors via `isRetryableError`. Adding retry at `getAttachment` level would cause double-retries. The catch block only sees errors that exhausted all `_graphRequest` retries.

3. **Error classification without AxiosError**: Since `_graphRequest` already handles transient errors internally, `getAttachment` only needs to distinguish the "no data" permanent case (return null with warning) from the "exhausted retries" case (return null with error-level Sentry).

4. **Caller update**: Updated `downloadAttachment` in `emailAttachmentService.ts` to return `Buffer | null`, and the caller handles null by returning `{ status: "error", reason: "Attachment data unavailable" }` -- preventing crash on `generateContentHash(null)`.

5. **Sentry context**: Both breadcrumbs and events include messageId, attachmentId, contentType, size, errorType -- no PII (no filenames, no email content). Uses `logService` (not `console.log`) for local logging.

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | auto-captured |
| Duration | auto-captured |

**Variance:** PM Est ~15K vs Actual ~auto-captured

---

## SR Engineer Review Notes

**Review Date:** 2026-03-19 | **Status:** APPROVED WITH CORRECTIONS

### Branch Information (SR Engineer decides)
- **Branch From:** int/patch-j
- **Branch Into:** int/patch-j
- **Suggested Branch Name:** fix/task-2286-outlook-attachment-errors

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** Nothing
- **Blocks:** Nothing

### Shared File Analysis
- Files modified: `electron/services/outlookFetchService.ts` (1363 lines)
- Conflicts with: No other tasks

### Technical Corrections (CRITICAL)

**1. Return type is `Buffer`, not `AttachmentData | null`**

The actual `getAttachment` method signature (line 795-798):
```typescript
async getAttachment(
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
```

It returns `Promise<Buffer>`, not `Promise<AttachmentData | null>`. The task's suggested pattern uses the wrong return type. The engineer must:
- Change the return type to `Promise<Buffer | null>`
- Update all callers to handle `null` returns (search for `getAttachment` call sites)

**2. Error classification -- NOT AxiosError**

The task suggests `instanceof AxiosError` for transient error detection. However, the OutlookFetchService uses `this._graphRequest` which is a custom method, NOT axios. Check what error types `_graphRequest` throws -- it likely uses `fetch` or the Microsoft Graph SDK. The `isTransientError` function must be adapted to the actual error types.

Check for:
- HTTP status codes (5xx = transient, 404 = permanent)
- Network errors (ECONNRESET, ETIMEDOUT)
- Microsoft Graph API specific error codes

**3. Current error handling at lines 809-815**

The existing code:
```typescript
} catch (error) {
  logService.error("Failed to get attachment", "OutlookFetch", { error });
  Sentry.captureException(error, {
    tags: { service: "outlook-fetch", operation: "getAttachment" },
  });
  throw error;
}
```

The fix replaces the `throw error` with `return null` for non-transient failures, and adds retry for transient failures. The Sentry reporting is already there but needs enriched context (messageId, attachmentId, attempt count).

**4. Verify callers handle null**

Search for all callers of `getAttachment` to ensure they handle a `null` return. If any caller does `const buffer = await service.getAttachment(...)` and then immediately calls `buffer.toString()` without a null check, it will crash.

### Technical Considerations
- The `_graphRequest` private method may have its own retry logic. Check to avoid double-retrying.
- The `logService` is already imported and used. Continue using it (not `console.log` or bare `log`).
- The retry delays (1s, 2s) are reasonable for Graph API rate limits. Microsoft recommends checking `Retry-After` header -- consider using it if available.
- The "No attachment data found" case (line 808) is the permanent "empty response" case. This should NOT retry.

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** int/patch-j
