# TASK-2001: Fix window.api Bridge Type Declarations

**Backlog:** BACKLOG-717
**Sprint:** SPRINT-085
**Status:** Pending
**Priority:** High
**Category:** types
**Estimated Tokens:** ~30K (types x1.0 multiplier)
**Token Cap:** ~120K (4x)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Goal

Add missing method signatures to `transactionBridge.ts` and `contactBridge.ts` type declarations so that all `window.api.transactions.*` and `window.api.contacts.*` calls in component code are fully typed. Remove all 9+ production `as any`/`as unknown` casts from component files that exist solely because the bridge types are incomplete.

## Non-Goals

- Do NOT add new IPC handlers or preload bridge methods -- only add type declarations for EXISTING working methods
- Do NOT change any runtime behavior in the bridge files
- Do NOT refactor the bridge architecture (e.g., switching from individual methods to a generic invoke pattern)
- Do NOT touch `as any` casts in test files (those are acceptable for mocking)
- Do NOT fix `as any` casts unrelated to bridge types (e.g., onboarding state casts, device limit casts)

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/preload/transactionBridge.ts` | Add missing method signatures with proper types |
| `electron/preload/contactBridge.ts` | Add missing method signatures with proper types |
| `src/types/window.d.ts` | Update `WindowApi` interface to match bridge exports |
| `src/components/transactionDetailsModule/components/modals/AttachEmailsModal.tsx` | Remove `as any` casts (lines ~240, ~373) |
| `src/components/transactionDetailsModule/components/modals/EmailThreadViewModal.tsx` | Remove `as any` casts (lines ~468, ~516) |
| `src/components/transactionDetailsModule/components/modals/EmailViewModal.tsx` | Remove `as any` casts (lines ~184, ~210) |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Remove `as any` casts (lines ~179, ~246) |
| `src/components/transactionDetailsModule/components/modals/AttachmentPreviewModal.tsx` | Remove `(window as any).api` casts (lines ~107, ~138, ~168) |

### Methods Missing from transactionBridge.ts

These methods exist at runtime (IPC handlers are registered) but lack type declarations in the bridge:

| Method | IPC Channel | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `getOverview` | `transactions:get-overview` | `(userId: string, transactionId: string)` | `Promise<{ success: boolean; overview?: TransactionOverview; error?: string }>` |
| `getUnlinkedEmails` | `transactions:get-unlinked-emails` | `(userId: string, transactionId: string, options?: { query?: string; after?: string; before?: string; maxResults?: number })` | `Promise<{ success: boolean; threads?: EmailThread[]; error?: string }>` |
| `linkEmails` | `transactions:link-emails` | `(userId: string, transactionId: string, emailIds: string[])` | `Promise<{ success: boolean; linked?: number; error?: string }>` |
| `linkMessages` | `transactions:link-messages` | `(messageIds: string[], transactionId: string)` | `Promise<{ success: boolean; error?: string }>` |
| `unlinkMessages` | `transactions:unlink-messages` | `(messageIds: string[], transactionId: string)` | `Promise<{ success: boolean; error?: string }>` |
| `getMessageContacts` | `transactions:get-message-contacts` | `(transactionId: string)` | `Promise<{ success: boolean; contacts?: MessageContact[]; error?: string }>` |
| `getMessagesByContact` | `transactions:get-messages-by-contact` | `(transactionId: string, contactIdentifier: string)` | `Promise<{ success: boolean; messages?: Message[]; error?: string }>` |
| `getEmailAttachments` | `emails:get-attachments` | `(emailId: string)` | `Promise<{ success: boolean; attachments?: EmailAttachment[]; error?: string }>` |
| `openAttachment` | `attachments:open` | `(attachmentId: string, emailId: string)` | `Promise<{ success: boolean; error?: string }>` |
| `exportFolderStructure` | `transactions:export-folder` | `(userId: string, transactionId: string, outputPath: string, options: ExportFolderOptions)` | `Promise<{ success: boolean; path?: string; error?: string }>` |

### Methods Missing from contactBridge.ts

| Method | IPC Channel | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `getNamesByPhones` | `contacts:get-names-by-phones` | `(phones: string[])` | `Promise<{ success: boolean; names?: Record<string, string>; error?: string }>` |

## Implementation Notes

### Step 1: Add methods to bridge files

For each missing method, add it to the bridge object. Follow the existing pattern in the file:

```typescript
// In transactionBridge.ts -- follow existing pattern
getUnlinkedEmails: (userId: string, transactionId: string, options?: {
  query?: string;
  after?: string;
  before?: string;
  maxResults?: number;
}) => ipcRenderer.invoke("transactions:get-unlinked-emails", userId, transactionId, options),
```

### Step 2: Verify parameter types match handler signatures

For each method, check the actual handler in `transaction-handlers.ts` (or after TASK-1999, the split handler file) to confirm parameter order and types match exactly. The bridge is a pass-through -- parameter order must match the `ipcMain.handle()` callback.

### Step 3: Update window.d.ts

The `WindowApi` interface in `src/types/window.d.ts` must include the new methods so that `window.api.transactions.getUnlinkedEmails(...)` type-checks in components.

### Step 4: Remove as any casts from components

Replace each `as any` cast with a properly typed call:

```typescript
// BEFORE
const result = await (window.api.transactions as any).getUnlinkedEmails(userId, txId);

// AFTER
const result = await window.api.transactions.getUnlinkedEmails(userId, txId);
```

### Step 5: Handle AttachmentPreviewModal specially

This file uses `(window as any).api?.transactions` which is a double cast. Replace with:

```typescript
// BEFORE
const api = (window as any).api?.transactions;

// AFTER
const api = window.api?.transactions;
```

This requires `window.api` to be typed in `window.d.ts` (which it should already be).

## Scope Scan

**Production `as any` casts related to bridge types (from grep):**

| File | Line(s) | Cast | Reason |
|------|---------|------|--------|
| `AttachEmailsModal.tsx` | 240, 373 | `window.api.transactions as any` | Missing `getUnlinkedEmails`, `linkEmails` |
| `EmailThreadViewModal.tsx` | 468, 516 | `window.api?.transactions as any` | Missing attachment methods |
| `EmailViewModal.tsx` | 184, 210 | `window.api.transactions as any` | Missing `getEmailAttachments`, `openAttachment` |
| `TransactionMessagesTab.tsx` | 179 | `window.api.contacts as any` | Missing `getNamesByPhones` |
| `TransactionMessagesTab.tsx` | 246 | `window.api.transactions as any` | Missing `unlinkMessages` |
| `AttachmentPreviewModal.tsx` | 107, 138, 168 | `(window as any).api?.transactions` | Missing attachment methods |

**Total: 10 casts across 5 files** (test file casts excluded)

## Acceptance Criteria

- [ ] All 10 missing methods added to `transactionBridge.ts` with correct parameter and return types
- [ ] 1 missing method added to `contactBridge.ts` with correct parameter and return types
- [ ] `window.d.ts` updated to include all new method signatures
- [ ] All 10 production `as any` casts listed above are removed from component code
- [ ] Zero new `as any` casts introduced
- [ ] `npm run type-check` passes (this is the primary validation)
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No behavioral changes at runtime

## Do / Don't Guidelines

### DO:
- Verify each bridge method's parameter order against the actual IPC handler
- Use specific return types (not `Promise<any>`)
- Add JSDoc comments to new bridge methods matching the existing style in the file
- Remove `as any` casts only for the bridge-related ones listed above

### DON'T:
- Invent parameter types -- look at the actual handler to determine them
- Remove `as any` casts in test files
- Remove `as any` casts unrelated to bridge types (e.g., onboarding, license)
- Change any runtime behavior

## Stop-and-Ask Triggers

- If a bridge method's parameter order doesn't match the IPC handler, STOP and verify which is correct
- If removing a cast reveals a deeper type incompatibility (not just a missing declaration), flag it
- If `window.d.ts` structure is significantly different from expected, ask before restructuring

## Testing Expectations

- No new unit tests required -- type-check is the validation
- All existing tests must pass unchanged
- `npm run type-check` is the primary gate

## PR Preparation

**Title:** `refactor: add missing bridge type declarations, remove 10 production as-any casts`
**Labels:** types, refactor
**Base:** develop

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | engineer-task-2001 |
| **Branch** | refactor/task-2001-bridge-type-declarations |
| **PR** | TBD |
| **Files Changed** | 7 (electron/types/ipc.ts, src/window.d.ts, 5 component files) |
| **Tests Added** | 0 (type-check is the validation gate) |
| **Issues/Blockers** | Discovery: `WindowApi` in `electron/types/ipc.ts` is the authoritative type for `window.api`, not `MainAPI` in `src/window.d.ts`. Both declare `window.api` in `declare global` blocks so TS merges them. Had to add methods to both files. |

### What was done
1. Added 30+ missing method signatures to `WindowApi` in `electron/types/ipc.ts` (transactions: getOverview, getCommunications, getWithContacts, exportPDF, getUnlinkedMessages, getUnlinkedEmails, getMessageContacts, getMessagesByContact, linkMessages, unlinkMessages, linkEmails, autoLinkTexts, resyncAutoLink, syncAndFetchEmails, exportFolder, getEarliestCommunicationDate, reanalyze, getEmailAttachments, backfillAttachments, openAttachment, getAttachmentData, getAttachmentBuffer, getAttachmentCounts; contacts: getNamesByPhones, searchContacts, onExternalSyncComplete)
2. Updated `src/window.d.ts` `MainAPI` interface with matching method signatures for consistency
3. Removed all 10 production `as any`/`as unknown` casts from 5 component files
4. Fixed `unlinkMessages` signature to accept optional `transactionId` parameter
5. Fixed `getCommunications` signature to accept `channelFilter` parameter

### Deviations
- More methods added than the original 10+1 listed in the task, because adding proper types exposed additional missing methods (e.g., getAttachmentData, getAttachmentBuffer used in AttachmentPreviewModal)
