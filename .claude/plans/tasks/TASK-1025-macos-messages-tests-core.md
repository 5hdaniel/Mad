# TASK-1025: Add Tests for macOSMessagesImportService - Core

**Backlog ID:** BACKLOG-203
**Sprint:** SPRINT-032
**Phase:** Phase 2 - macOS Messages Test Coverage
**Branch:** `test/task-1025-macos-messages-core`
**Estimated Tokens:** ~25K
**Token Cap:** 100K

---

## Objective

Add comprehensive unit tests for the core message import functionality in `macOSMessagesImportService.ts`, covering message parsing, contact matching, and error handling.

---

## Context

The `macOSMessagesImportService` is a critical service for importing iMessage conversations on macOS. It parses the chat.db SQLite database and imports messages, attachments, and contact associations. Currently, only attachment tests exist (`macOSMessagesImportService.attachments.test.ts`).

### Reference Documentation

- `.claude/docs/shared/imessage-attributedbody-parsing.md` - Parsing documentation

---

## Requirements

### Must Do:
1. Create `macOSMessagesImportService.core.test.ts`
2. Test message extraction from chat.db mock
3. Test attributed body parsing (styled text)
4. Test contact matching by phone/email
5. Test phone number normalization
6. Test error handling for database access issues
7. Test handling of malformed message data

### Must NOT Do:
- Duplicate tests already in attachments test file
- Make changes to service implementation (test only)
- Use real chat.db file in tests (use mocks)

---

## Acceptance Criteria

- [ ] New test file created: `macOSMessagesImportService.core.test.ts`
- [ ] Message parsing tests cover happy path
- [ ] Message parsing tests cover edge cases (empty, malformed)
- [ ] Contact matching tests cover various phone formats
- [ ] Phone normalization tests cover international formats
- [ ] Error handling tests verify graceful failures
- [ ] Test coverage >60% for targeted functions
- [ ] All existing tests continue to pass

---

## Files to Create

- `electron/services/__tests__/macOSMessagesImportService.core.test.ts`

## Files to Read (for context)

- `electron/services/macOSMessagesImportService.ts` - Service implementation
- `electron/services/__tests__/macOSMessagesImportService.attachments.test.ts` - Existing tests (patterns)
- `.claude/docs/shared/imessage-attributedbody-parsing.md` - Parsing documentation

---

## Testing Approach

### Mock Strategy

```typescript
// Mock SQLite database
const mockDatabase = {
  prepare: jest.fn().mockReturnValue({
    all: jest.fn(),
    get: jest.fn(),
  }),
};

// Mock file system for chat.db access
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
```

### Test Categories

1. **Message Extraction**
   - Basic message retrieval
   - Empty database handling
   - Large result set handling

2. **Attributed Body Parsing**
   - Plain text messages
   - Styled text (bold, italic)
   - Special characters
   - Empty/null attributed body

3. **Contact Matching**
   - Match by phone number
   - Match by email
   - Unknown contact handling
   - Multiple matches

4. **Phone Normalization**
   - US format: (555) 123-4567
   - International: +1-555-123-4567
   - Raw digits: 5551234567
   - Short codes

5. **Error Handling**
   - Database not found
   - Permission denied
   - Corrupted data
   - Query timeout

---

## Testing Expectations

### Unit Tests
- **Required:** Yes (primary deliverable)
- **New tests to write:** ~15-20 test cases
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `test(messages): add core unit tests for macOSMessagesImportService`
- **Branch:** `test/task-1025-macos-messages-core`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Implementation:
- [ ] Test file created
- [ ] Message parsing tests written
- [ ] Contact matching tests written
- [ ] Error handling tests written
- [ ] All tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] Coverage report included
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Coverage Report

| Function | Coverage |
|----------|----------|
| parseMessages | X% |
| matchContact | X% |
| normalizePhone | X% |
| parseAttributedBody | X% |

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Service implementation has bugs that should be fixed first
- Mocking SQLite proves too complex
- Coverage target seems unreachable without refactoring service
- You discover undocumented behavior that needs clarification
- You encounter blockers not covered in the task file
