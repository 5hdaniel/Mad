# TASK-1021: Clean Up Any Types in Handlers (Part 1)

**Backlog ID:** BACKLOG-115
**Sprint:** SPRINT-031
**Phase:** 2 (Parallel)
**Branch:** `refactor/task-1021-any-type-cleanup`
**Estimated Tokens:** ~40K

---

## Objective

Replace `any` types in the highest-impact electron handler files with proper TypeScript interfaces, focusing on `conversationHandlers.ts` (21 any types) and `outlookHandlers.ts`.

---

## Context

The codebase has 85 ESLint `any` type warnings. This task addresses files in the electron handlers layer.

**CORRECTED any type counts (verified by grep):**
- `electron/handlers/conversationHandlers.ts` - 6 `: any` occurrences
- `electron/handlers/outlookHandlers.ts` - 9 `: any` occurrences
- `electron/contact-handlers.ts` - 3 `: any` occurrences

**Total: 18 any types (not 26+ as originally estimated)**

Proper types improve:
- IDE autocomplete and navigation
- Compile-time error detection
- Code documentation

---

## Requirements

### Must Do:
1. Create proper interfaces for IPC message shapes
2. Replace `any` in `conversationHandlers.ts` (6 types)
3. Replace `any` in `outlookHandlers.ts` (9 types)
4. Replace `any` in `contact-handlers.ts` (3 types)
5. Ensure all handlers compile without errors
6. Update any related type definition files

### Must NOT Do:
- Change runtime behavior
- Modify business logic
- Create overly complex generic types
- Use `unknown` as a blanket replacement (it's better than `any` but not ideal)

---

## Acceptance Criteria

- [ ] `any` types in target files reduced by >80%
- [ ] New interfaces created for IPC message shapes
- [ ] All handlers compile without type errors
- [ ] All existing tests pass
- [ ] No runtime behavior changes

---

## Files to Modify

- `electron/handlers/conversationHandlers.ts` - Replace 6 any types
- `electron/handlers/outlookHandlers.ts` - Replace 9 any types
- `electron/contact-handlers.ts` - Replace 3 any types
- `electron/types/` - Create new interface files if needed

## Files to Read (for context)

- `electron/preload/` - Bridge files show expected shapes
- `src/types/` - Existing type definitions
- Existing handler files with good typing - patterns to follow

---

## Implementation Guide

### Step 1: Audit Current Any Types

Run to see current state:
```bash
grep -r "any" electron/handlers/conversationHandlers.ts | wc -l
grep -r ": any" electron/handlers/outlookHandlers.ts | wc -l
```

### Step 2: Create Interface File

```typescript
// electron/types/handlers.ts (or add to existing)

export interface ConversationMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  timestamp: Date;
  attachments?: Attachment[];
}

export interface ConversationThread {
  id: string;
  participants: string[];
  messages: ConversationMessage[];
  lastUpdated: Date;
}

// ... more interfaces as needed
```

### Step 3: Replace Any Types

```typescript
// BEFORE
async function handleGetConversations(event: any, options: any): Promise<any> {
  const data = await someApi.get(options);
  return data;
}

// AFTER
async function handleGetConversations(
  event: Electron.IpcMainInvokeEvent,
  options: ConversationQueryOptions
): Promise<ConversationThread[]> {
  const data = await someApi.get(options);
  return data;
}
```

### Step 4: Common Patterns

| Before | After |
|--------|-------|
| `event: any` | `event: Electron.IpcMainInvokeEvent` |
| `data: any` | Specific interface |
| `options: any` | `XxxOptions` interface |
| `result: any` | Specific return type |
| `error: any` | `error: Error \| unknown` |

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests (refactor only)
- **Existing tests to update:** May need type updates if tests use any

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] ESLint any warnings reduced

---

## PR Preparation

- **Title:** `refactor(types): replace any types in electron handlers`
- **Branch:** `refactor/task-1021-any-type-cleanup`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] Counted initial any types in target files

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: X any types in target files
- **After**: Y any types (Z% reduction)
- **New interfaces created**: [list]
- **Actual Tokens**: ~XK (Est: 40K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-01-10 | **Status:** APPROVED (with notes)

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** refactor/task-1021-any-type-cleanup

### Execution Classification
- **Parallel Safe:** Yes - Phase 2, different files from TASK-1020/1022
- **Depends On:** TASK-1019 (Phase 1 complete)
- **Blocks:** None

### Shared File Analysis
- Files modified: `electron/handlers/conversationHandlers.ts`, `electron/handlers/outlookHandlers.ts`, `electron/contact-handlers.ts`
- Conflicts with: None (different files from other Phase 2 tasks)

### Technical Considerations

**CORRECTED Scope:**
The original task estimated 21+ any types but actual count is 18. This reduces scope.

**Token Estimate Revision:**
Original: 40K tokens
Revised: 25-30K tokens (fewer any types than estimated)

**Specific Any Type Locations:**

**conversationHandlers.ts (6 occurrences):**
- Line 52-53: `dbAll` function params - use `unknown[]` or specific row type
- Line 83: `conversations` cast to `any[]` - create ConversationRow interface
- Line 99, 131, 146, 156: `contactInfo` typed as `any`
- Lines use `as any` for SQLite row results

**outlookHandlers.ts (9 occurrences):**
- Line 202: `contacts: any[]` parameter
- Line 249-253: `dbAll` function with `any` params/return
- Line 258: `results: any[]` array
- Lines 296-332: Various `any[]` for messages/chatIds
- Line 546: `progress: any` callback

**contact-handlers.ts (3 occurrences):**
- Line 34: `transactions?: Transaction[] | any[]` - refine type
- Line 144: `availableContacts: any[]` - create interface
- Line 423-436: `existingDbContacts` and `newContactsToCreate` use any

**Recommended Interface Approach:**

Create `electron/types/handlerTypes.ts`:
```typescript
export interface ConversationRow {
  chat_id: number;
  chat_identifier: string;
  display_name: string | null;
  contact_id: string | null;
  last_message_date: number;
  message_count: number;
}

export interface MessageRow {
  id: number;
  text: string | null;
  date: number;
  is_from_me: number;
  sender: string | null;
  cache_has_attachments: number;
  attributedBody: Buffer | null;
}
```

**SQLite Pattern:**
Many `any` types are from SQLite query results. Create typed wrapper:
```typescript
type SqliteAll<T> = (sql: string, params?: unknown) => Promise<T[]>;
```

---

## Guardrails

**STOP and ask PM if:**
- Some `any` types are intentional (document why)
- Creating interfaces requires understanding undocumented API shapes
- Type changes break tests in unexpected ways
- Scope exceeds the 3 target files
- You encounter blockers not covered in the task file
