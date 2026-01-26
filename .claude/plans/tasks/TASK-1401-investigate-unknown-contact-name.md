# Task TASK-1401: Investigate Unknown Contact Name Display

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent investigates, documents findings, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Investigate why some 1:1 text conversations display "unknown" as contact name when linking text threads to transactions. Document root causes and propose fixes for BACKLOG-513.

## Non-Goals

- Do NOT implement fixes in this task (that's Phase 2)
- Do NOT modify any production code
- Do NOT change the contacts database schema
- Do NOT fix unrelated contact display issues

## Deliverables

1. Update: `.claude/plans/tasks/TASK-1401-investigate-unknown-contact-name.md` (this file - Investigation Findings section)
2. New file: `.claude/plans/investigations/BACKLOG-513-unknown-contact-findings.md`

## Acceptance Criteria

- [ ] Phone number lookup flow traced end-to-end
- [ ] Normalization differences identified (if any)
- [ ] Root cause of "unknown" display clearly documented
- [ ] Proposed fixes documented with specific file/line changes
- [ ] No production code modified (investigation only)
- [ ] Findings PR created and merged

## Investigation Notes

### Key Questions to Answer

1. **Where does "unknown" come from?**
   - Is it a fallback value in the UI?
   - Is it stored in the database?
   - Is it returned from a lookup function?

2. **Phone Normalization**:
   - How are phone numbers stored in `contact_phones` table?
   - How are they stored in `messages.participants`?
   - Does `normalizePhoneForLookup()` match the stored format?

3. **Lookup Flow**:
   - `MessageThreadCard.tsx` -> contact name resolution
   - Does it use batch lookup or individual queries?
   - What happens when lookup returns no match?

4. **Edge Cases**:
   - International phone formats (+1, +44, etc.)
   - Phone numbers with extensions
   - Missing area codes

### Files to Investigate

| File | Focus |
|------|-------|
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Lines 120-200: Phone lookup and normalization |
| `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` | Lines 39-43, 270-310: Sender resolution |
| `electron/services/db/contactDbService.ts` | Phone lookup queries |
| `electron/services/iosContactsParser.ts` | `lookupByPhone()` method (lines 371-423) |
| `electron/services/contactsService.ts` | Line 468: "Unknown" fallback |

### Investigation Commands

```bash
# Find all "unknown" or "Unknown" usage in contact/message context
grep -rn "unknown\|Unknown" --include="*.ts" --include="*.tsx" src/components/transactionDetailsModule/

# Check phone normalization functions
grep -rn "normalizePhone\|normalizeForLookup" --include="*.ts" --include="*.tsx"

# Check contact lookup methods
grep -rn "lookupByPhone\|getContactByPhone\|findContact" --include="*.ts" electron/

# Check how participants are parsed
grep -rn "participants\|phone" --include="*.ts" electron/services/db/
```

### Reproduction Steps

To reproduce the issue:
1. Import contacts from iPhone/macOS
2. Import messages from macOS
3. Create a transaction
4. Link a text thread where the phone number has a known contact
5. Observe if contact name shows or "unknown" shows

## Integration Notes

- **Blocks**: TASK-1405 (Fix contact phone lookup)
- **Related**: Contact import flow, phone normalization utilities
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Trace the full lookup flow from UI to database
- Compare phone formats between contacts and messages tables
- Document exact code paths that lead to "unknown"
- Include example phone numbers that fail/succeed lookup

### Don't:

- Modify any production code
- Fix bugs (save for Phase 2)
- Change normalization logic (analysis only)
- Spend more than ~12K tokens on investigation

## When to Stop and Ask

- If the issue is in the contact import flow (different scope)
- If multiple normalization standards are found
- If database inconsistency requires migration to fix

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (investigation only)

### Coverage

- Coverage impact: None (no code changes)

### Integration / Feature Tests

- Required scenarios: None (investigation only)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no code changes expected)
- [ ] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `investigation`

**Estimated Tokens:** ~10K-12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to read | 4-5 files | +6K |
| Flow tracing | Multi-layer lookup | +4K |
| Documentation | Findings document | +2K |

**Confidence:** Medium

**Risk factors:**
- May involve multiple services
- Phone normalization is complex

---

## Investigation Findings (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Investigation Date: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Lookup Flow Analysis

**End-to-End Flow:**
1. UI Component: `MessageThreadCard.tsx`
2. → <next step>
3. → <next step>
4. → Database query in: `<file>`

**Where "unknown" is set:**
```typescript
// Paste the exact code that sets "unknown"
```

---

### Phone Normalization Analysis

**Contact Phones Storage Format:**
```
Example: <format in contact_phones table>
```

**Messages Participants Format:**
```
Example: <format in messages.participants>
```

**Normalization Function:**
```typescript
// Paste normalizePhoneForLookup or equivalent
```

**Mismatch Found:**
<Document specific format differences>

---

### Root Cause

**Primary Issue:**
<Clear explanation of why "unknown" appears>

**Secondary Issues (if any):**
<Additional contributing factors>

---

### Proposed Fix

**File Changes:**
| File | Line(s) | Change |
|------|---------|--------|
| `<file>` | `<lines>` | `<description>` |

**Code Example:**
```typescript
// Proposed fix code
```

---

### Recommended Phase 2 Task

Based on investigation:

**TASK-1405**: <specific scope and approach>

---

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Investigation Quality:** PASS / NEEDS MORE
**Root Cause Identified:** Yes / No / Partial

**Review Notes:**
<Key observations, concerns, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes
