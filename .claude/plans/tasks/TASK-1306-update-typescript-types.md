# TASK-1306: Update TypeScript types for new architecture

**Sprint:** SPRINT-060
**Phase:** 4 - Type System Cleanup
**Branch:** `fix/task-1306-typescript-types`
**Estimated Tokens:** ~12K
**Dependencies:** TASK-1303, TASK-1304, TASK-1305, TASK-1305b (all queries updated)

---

## Objective

Update TypeScript types in `electron/types/models.ts` to reflect the new three-table architecture with proper `Email` interface and a **NEW, PROPER** `Communication` interface for the junction table.

---

## Context Checkpoint

**RE-READ BEFORE STARTING:**

**CRITICAL ARCHITECTURE NOTE:**

The current type system has:
```typescript
export type Communication = Message;  // Line 882 - Communication is ALIASED to Message!
export type NewCommunication = NewMessage;  // Line 887 - Same problem
```

This is **WRONG** for the new architecture because:
- `Communication` is NOT a message - it's a junction table record
- `Communication` should only have: `id`, `user_id`, `transaction_id`, `message_id`, `email_id`, `thread_id`, `link_source`, `link_confidence`, `linked_at`, `created_at`
- The `Message` interface has content fields that don't belong on a junction record

**WHAT THIS TASK MUST DO:**
1. Add new `Email` interface (content for emails)
2. Add new `NewEmail` interface
3. **Create a NEW `JunctionCommunication` interface** (the proper junction table type)
4. **Keep the existing `Communication = Message` alias** for backward compatibility during transition
5. Update `communicationDbService.ts` to use proper types where needed

---

## Pre-Implementation Check

Run these grep commands to verify current state:

```bash
# Verify Communication is aliased to Message
grep -n "export type Communication = Message" electron/types/models.ts
# Expected: Line 882

# Verify NewCommunication is aliased to NewMessage
grep -n "export type NewCommunication = NewMessage" electron/types/models.ts
# Expected: Line 887

# Check what createCommunication uses
grep -n "NewCommunication\|NewMessage" electron/services/db/communicationDbService.ts
# Expected: Shows which type the function uses

# Check Message interface structure (for reference)
grep -n "export interface Message" electron/types/models.ts
# Expected: Shows interface around line 300
```

---

## Files to Modify

### File 1: `electron/types/models.ts`

#### Step 1: Add Email interface

**LOCATION:** After the `Message` interface section, before the `Communication` type alias.

Find the section around line 880:
```typescript
// ============================================
// COMMUNICATION MODELS
// ============================================
```

Add BEFORE this section:
```typescript
// ============================================
// EMAIL MODELS (BACKLOG-506)
// ============================================

/**
 * Email record stored in the emails table.
 * This is the content store for emails - separate from the junction table.
 */
export interface Email {
  id: string;
  user_id: string;

  // Source identification
  external_id?: string;
  source?: "gmail" | "outlook";
  account_id?: string;

  // Direction
  direction?: "inbound" | "outbound";

  // Content
  subject?: string;
  body_plain?: string;
  body_html?: string;

  // Participants
  sender?: string;
  recipients?: string;
  cc?: string;
  bcc?: string;

  // Threading
  thread_id?: string;
  in_reply_to?: string;
  references_header?: string;

  // Timestamps
  sent_at?: Date | string;
  received_at?: Date | string;

  // Attachments
  has_attachments?: boolean;
  attachment_count?: number;

  // Deduplication
  message_id_header?: string;
  content_hash?: string;

  // Metadata
  labels?: string;
  created_at?: Date | string;
}

/**
 * Data required to create a new email
 */
export type NewEmail = Omit<Email, "id" | "created_at">;

// ============================================
// JUNCTION TABLE MODELS (BACKLOG-506)
// ============================================

/**
 * Communication junction record - links content (message or email) to a transaction.
 * This is the PURE junction table type with NO content columns.
 *
 * Use this type for:
 * - Creating new junction records
 * - Reading junction-only data
 *
 * For reading with content, use the result of getCommunicationsWithMessages()
 * which returns Message (with content populated from JOINs).
 */
export interface JunctionCommunication {
  id: string;
  user_id: string;
  transaction_id: string;

  // Content references (ONE should be set)
  message_id?: string;        // FK to messages table (for texts)
  email_id?: string;          // FK to emails table (for emails)
  thread_id?: string;         // For batch-linking all texts in a thread

  // Link metadata
  link_source?: "auto" | "manual" | "scan";
  link_confidence?: number;
  linked_at?: Date | string;

  created_at?: Date | string;
}

/**
 * Data required to create a new communication junction record.
 * BACKLOG-506: This is the proper type for createCommunication().
 */
export type NewJunctionCommunication = Omit<JunctionCommunication, "id" | "created_at" | "linked_at">;
```

#### Step 2: Update Communication type alias comment

**LOCATION:** Around line 882, the existing `Communication` type alias.

Find:
```typescript
export type Communication = Message;

/**
 * @deprecated Use NewMessage instead.
 */
export type NewCommunication = NewMessage;
```

Replace with:
```typescript
/**
 * @deprecated BACKLOG-506: Communication is aliased to Message for backward compatibility.
 *
 * This alias exists because getCommunicationsWithMessages() returns Message objects
 * with content populated from JOINs to messages/emails tables.
 *
 * For junction-only operations, use JunctionCommunication instead.
 * For creating new junction records, use NewJunctionCommunication.
 */
export type Communication = Message;

/**
 * @deprecated BACKLOG-506: Use NewJunctionCommunication for creating junction records.
 *
 * This alias is kept for backward compatibility during the transition.
 * Code that creates communications should be updated to use NewJunctionCommunication.
 */
export type NewCommunication = NewMessage;
```

---

### File 2: `electron/services/db/communicationDbService.ts`

#### Step 1: Update createCommunication to accept junction fields

**LOCATION:** The `createCommunication` function (around line 30).

**NOTE:** The function currently takes `NewCommunication` which is `NewMessage`. This is WRONG for the new architecture because it expects content fields.

**TEMPORARY FIX:** For now, keep the function signature but add a note. The function will be fully updated after TASK-1307 drops the legacy columns.

Find the function signature and add a note:
```typescript
/**
 * Create a new communication record.
 *
 * @deprecated BACKLOG-506 TEMPORARY: This function takes NewCommunication (which is NewMessage)
 * for backward compatibility. After TASK-1307, update this to use NewJunctionCommunication
 * and remove all content column handling.
 *
 * For new email linking (TASK-1302), the caller should:
 * 1. Create email in emails table via emailDbService.createEmail()
 * 2. Call this function with only junction fields (email_id, user_id, transaction_id, etc.)
 *
 * The extra content fields in NewCommunication will be ignored once TASK-1307 removes them.
 */
export async function createCommunication(
```

#### Step 2: Add email_id to the INSERT statement

**LOCATION:** Inside createCommunication, the SQL INSERT.

Find the SQL that starts:
```typescript
  const sql = `
    INSERT INTO communications (
      id, user_id, transaction_id, message_id,
```

Add `email_id` after `message_id`:
```typescript
  const sql = `
    INSERT INTO communications (
      id, user_id, transaction_id, message_id, email_id,
```

Also find the params array and add `email_id`:
```typescript
  const params = [
    id,
    communicationData.user_id,
    communicationData.transaction_id || null,
    communicationData.message_id || null,
    (communicationData as Record<string, unknown>).email_id || null,  // BACKLOG-506: Cast needed until types are fully updated
```

---

## Acceptance Criteria

- [ ] `Email` interface added to models.ts
- [ ] `NewEmail` type added to models.ts
- [ ] `JunctionCommunication` interface added to models.ts
- [ ] `NewJunctionCommunication` type added to models.ts
- [ ] `Communication` alias has deprecation note explaining BACKLOG-506 plan
- [ ] `createCommunication` function accepts `email_id` parameter
- [ ] `createCommunication` has deprecation note about temporary state
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] No import errors in consuming files

---

## Test Commands

```bash
# 1. Run type check
npm run type-check
# Expected: No errors

# 2. Run tests
npm test
# Expected: All tests pass

# 3. Verify Email type is exported
grep "export interface Email" electron/types/models.ts
# Expected: Shows Email interface

# 4. Verify JunctionCommunication is exported
grep "export interface JunctionCommunication" electron/types/models.ts
# Expected: Shows JunctionCommunication interface

# 5. Verify email_id is in createCommunication SQL
grep -A5 "INSERT INTO communications" electron/services/db/communicationDbService.ts | grep email_id
# Expected: Shows email_id in INSERT

# 6. Check for type errors in services
npm run type-check 2>&1 | grep -i "email\|communication"
# Expected: No errors
```

---

## Rollback Instructions

If something goes wrong:

```bash
# Revert code changes
git checkout electron/types/models.ts
git checkout electron/services/db/communicationDbService.ts
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: 2026-01-26*

### Results

- **Files Modified**:
  - `electron/types/models.ts` - Added Email, NewEmail, JunctionCommunication, NewJunctionCommunication types; updated deprecation notes
  - `electron/services/db/communicationDbService.ts` - Added deprecation note to createCommunication function
- **Interfaces Added**: Email, NewEmail, JunctionCommunication, NewJunctionCommunication
- **Type Aliases Updated**: Communication, NewCommunication, UpdateCommunication (with BACKLOG-506 deprecation notes)
- **createCommunication Updated**: Added deprecation note (email_id support was already added in TASK-1302b)
- **TypeScript Errors**: 0
- **Test Results**: All passing (1 pre-existing native module test failure unrelated to changes)
- **Actual Tokens**: ~15K
- **PR**: #610

---

## Guardrails

**STOP and ask PM if:**
- Type errors appear in consuming files
- Email interface conflicts with existing types
- JunctionCommunication interface conflicts with existing types
- createCommunication changes break existing code
- Need to modify files other than models.ts and communicationDbService.ts
