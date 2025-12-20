# TASK-502: Outlook Junk Detection Enhancement

## Metrics Tracking (REQUIRED)

**BEFORE starting implementation, record:**
- Planning Start Time: ___

**AFTER completion, report:**
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Enhance Outlook fetch service to capture junk/spam classification, then add detection utility.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 1 (Spam Filtering)
- **Dependencies**: None (parallel with TASK-501)
- **Estimated Turns**: 20

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-502-outlook-junk-detection
```

**Note:** Integration branch `int/cost-optimization` must be created from `develop` first.

## Technical Specification

### Current State

Outlook fetch service (line 268-269 in `outlookFetchService.ts`):
```typescript
const selectFields =
  "$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,bodyPreview,conversationId";
```

**Missing:** `inferenceClassification` and `parentFolderId` for junk detection.

### Implementation

#### Part 1: Enhance Outlook Fetch

**File:** `electron/services/outlookFetchService.ts`

```typescript
// Update $select to include junk detection fields
const selectFields =
  "$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,bodyPreview,conversationId,inferenceClassification,parentFolderId";

// Update GraphMessage interface
interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  // ... existing fields ...
  inferenceClassification?: 'focused' | 'other';
  parentFolderId?: string;
}

// Update ParsedEmail to include new fields
interface ParsedEmail {
  // ... existing fields ...
  inferenceClassification?: string;
  parentFolderId?: string;
}
```

#### Part 2: Add Junk Detection Utility

**File:** `electron/services/llm/spamFilterService.ts` (ADD to existing)

```typescript
// Outlook junk folder IDs (well-known)
const OUTLOOK_JUNK_FOLDER_NAMES = ['junkemail', 'junk email', 'deleteditems', 'deleted items'];

export interface OutlookSpamCheckInput {
  inferenceClassification?: string;
  parentFolderId?: string;
  parentFolderName?: string;  // If resolved
}

/**
 * Check if an Outlook email should be filtered (is in junk/deleted folder)
 * NOTE: Only checks folder-based junk, NOT inferenceClassification (too aggressive)
 */
export function isOutlookJunk(input: OutlookSpamCheckInput): SpamFilterResult {
  // ONLY check folder - inferenceClassification is too aggressive for spam detection
  // (it marks newsletters and non-focused emails which may contain transactions)
  if (input.parentFolderName) {
    const folderLower = input.parentFolderName.toLowerCase();
    if (OUTLOOK_JUNK_FOLDER_NAMES.some(junk => folderLower.includes(junk))) {
      return {
        isSpam: true,
        reason: `Outlook folder: ${input.parentFolderName}`
      };
    }
  }

  return { isSpam: false };
}

/**
 * OPTIONAL: Check if Outlook email is not in focused inbox
 * Use this as an OPT-IN filter, not default spam detection
 * WARNING: This will filter newsletters and less important emails which MAY contain transactions
 */
export function isOutlookNonFocused(input: OutlookSpamCheckInput): SpamFilterResult {
  if (input.inferenceClassification === 'other') {
    return {
      isSpam: true,
      reason: 'Outlook inferenceClassification: other (not focused)'
    };
  }
  return { isSpam: false };
}
```

#### Part 3: Folder Name Resolution (Optional Enhancement)

**File:** `electron/services/outlookFetchService.ts`

```typescript
// Cache folder ID to name mapping
private folderNameCache: Map<string, string> = new Map();

async resolveFolderName(folderId: string): Promise<string | null> {
  if (this.folderNameCache.has(folderId)) {
    return this.folderNameCache.get(folderId)!;
  }

  try {
    const folder = await this._graphRequest<{ displayName: string }>(`/me/mailFolders/${folderId}`);
    this.folderNameCache.set(folderId, folder.displayName);
    return folder.displayName;
  } catch {
    return null;
  }
}
```

### Unit Tests

**File:** `electron/services/llm/__tests__/spamFilterService.test.ts` (ADD - matches service location)

```typescript
describe('isOutlookJunk', () => {
  it('should detect junk folder', () => {
    const result = isOutlookJunk({ parentFolderName: 'Junk Email' });
    expect(result.isSpam).toBe(true);
  });

  it('should detect deleted items folder', () => {
    const result = isOutlookJunk({ parentFolderName: 'Deleted Items' });
    expect(result.isSpam).toBe(true);
  });

  it('should pass inbox emails', () => {
    const result = isOutlookJunk({ parentFolderName: 'Inbox' });
    expect(result.isSpam).toBe(false);
  });

  it('should pass focused emails (not filtered by default)', () => {
    const result = isOutlookJunk({ inferenceClassification: 'focused' });
    expect(result.isSpam).toBe(false);
  });

  it('should NOT filter non-focused emails by default', () => {
    // inferenceClassification is too aggressive - use isOutlookNonFocused for opt-in
    const result = isOutlookJunk({ inferenceClassification: 'other' });
    expect(result.isSpam).toBe(false);
  });
});

describe('isOutlookNonFocused', () => {
  it('should detect inferenceClassification: other when opted-in', () => {
    const result = isOutlookNonFocused({ inferenceClassification: 'other' });
    expect(result.isSpam).toBe(true);
  });

  it('should detect junk folder', () => {
    const result = isOutlookJunk({ parentFolderName: 'Junk Email' });
    expect(result.isSpam).toBe(true);
  });

  it('should detect deleted items folder', () => {
    const result = isOutlookJunk({ parentFolderName: 'Deleted Items' });
    expect(result.isSpam).toBe(true);
  });

  it('should pass inbox emails', () => {
    const result = isOutlookJunk({ parentFolderName: 'Inbox' });
    expect(result.isSpam).toBe(false);
  });
});
```

## Acceptance Criteria

- [ ] `inferenceClassification` added to Outlook $select
- [ ] `parentFolderId` added to Outlook $select
- [ ] `isOutlookJunk()` function created and exported
- [ ] Detects junk/deleted folder emails
- [ ] Detects non-focused emails (optional filter)
- [ ] Unit tests pass with >90% coverage
- [ ] Existing Outlook fetch behavior unchanged
- [ ] No regression in email fetching

## Files to Create/Modify

| File | Action |
|------|--------|
| `electron/services/outlookFetchService.ts` | MODIFY (add fields to $select) |
| `electron/services/llm/spamFilterService.ts` | MODIFY (add Outlook detection) |
| `electron/services/llm/__tests__/spamFilterService.test.ts` | MODIFY (add Outlook tests) |

**Note:** Test file location matches service location per SR Engineer review.

## Guardrails

- DO NOT change Outlook OAuth flow
- DO NOT modify database schema
- DO NOT integrate with extraction pipeline yet (TASK-503)
- PRESERVE all existing fetch functionality

## Definition of Done

- [ ] Code complete and compiles
- [ ] Unit tests written and passing
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Manual test: Fetch Outlook emails, verify new fields populated
- [ ] PR created targeting `int/cost-optimization`
- [ ] Metrics recorded in this file

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [ ] Approved as-is
- [x] Approved with minor changes
- [ ] Needs revision

### Branch Information
- **Branch From:** `develop` (then rebase to `int/cost-optimization` after integration branch created)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-502-outlook-junk-detection`

### Execution Classification
- **Parallel Safe:** Yes - can run in parallel with TASK-501
- **Depends On:** None
- **Blocks:** TASK-503 (integration task)

### Technical Notes

1. **$select line reference verified:** Lines 268-269 in `outlookFetchService.ts` confirmed. Current select is:
   ```
   "$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,bodyPreview,conversationId"
   ```

2. **GraphMessage interface update required:** The existing `GraphMessage` interface (lines 30-43) needs the new fields added:
   ```typescript
   inferenceClassification?: 'focused' | 'other';
   parentFolderId?: string;
   ```

3. **ParsedEmail interface update:** The current `ParsedEmail` (lines 78-94) does NOT include these fields. Need to add them and update `_parseMessage()` to extract them.

4. **Part 3 (Folder Name Resolution) concern:** The task shows a `private folderNameCache` property, but `OutlookFetchService` is a class-based singleton. This is fine, but the `resolveFolderName` method is optional - the primary detection via `inferenceClassification` should be sufficient for MVP.

5. **inferenceClassification behavior note:** Microsoft Graph's `inferenceClassification: 'other'` means "not focused inbox" which includes newsletters, but is NOT equivalent to junk. The task conflates these. **Recommendation:** Make `inferenceClassification: 'other'` an OPTIONAL filter that users can enable, not default spam detection.

### Risk Notes

- **Medium risk:** Modifying `outlookFetchService.ts` affects live email fetching. Must ensure backwards compatibility.
- **API change risk:** Adding fields to `$select` is safe (Microsoft Graph returns them if available, ignores if unsupported).
- **False positive concern:** `inferenceClassification: 'other'` will filter important emails that aren't in Focused Inbox. This should be opt-in, not default.

### Dependencies

Confirmed: No dependencies. Can run parallel with TASK-501.

### Shared File Analysis
- Files modified: `outlookFetchService.ts` - no conflict with TASK-501 (separate service)
- Files modified: `spamFilterService.ts` - created by TASK-501, TASK-502 adds to it

**IMPORTANT:** If TASK-501 and TASK-502 run in parallel, TASK-502 should be aware that `spamFilterService.ts` will be created by TASK-501. Either:
- TASK-502 waits for TASK-501 to merge first, OR
- TASK-502 creates its own file and TASK-503 combines them

**Recommendation:** Keep parallel but have TASK-502 add Outlook functions assuming the Gmail file exists (TASK-501 likely finishes first given lower turn estimate).

### Recommended Changes

1. **Critical:** Change `inferenceClassification: 'other'` detection to be OPT-IN, not default spam detection. It should NOT mark all non-focused emails as junk.

   ```typescript
   export function isOutlookJunk(input: OutlookSpamCheckInput): SpamFilterResult {
     // ONLY check folder - inferenceClassification is too aggressive
     if (input.parentFolderName) {
       const folderLower = input.parentFolderName.toLowerCase();
       if (OUTLOOK_JUNK_FOLDER_NAMES.some(junk => folderLower.includes(junk))) {
         return {
           isSpam: true,
           reason: `Outlook folder: ${input.parentFolderName}`
         };
       }
     }
     return { isSpam: false };
   }

   // Separate optional function for focused inbox filtering
   export function isOutlookNonFocused(input: OutlookSpamCheckInput): SpamFilterResult {
     if (input.inferenceClassification === 'other') {
       return {
         isSpam: true,
         reason: 'Outlook inferenceClassification: other (not focused)'
       };
     }
     return { isSpam: false };
   }
   ```

2. **Minor:** Update `ParsedEmail` interface in `outlookFetchService.ts` to include the new fields.

3. **Minor:** Ensure test path matches TASK-501 pattern: `electron/services/llm/__tests__/spamFilterService.test.ts`
