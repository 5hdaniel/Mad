# BACKLOG-128: Add Type Verification Checklist for Fixture Tasks

**Priority:** Medium
**Category:** docs
**Created:** 2026-01-01
**Source:** SPRINT-011 Retrospective - Pattern 3: Type Alignment Gaps

---

## Problem Statement

TASK-800 (Email Fixtures) used invalid TransactionStage values that caused CI failures:
- Used: `initial_contact`, `negotiation`, `contract`
- Actual type: `intro`, `showing`, `offer`, `inspections`, `escrow`, `closing`, `post_closing`

The engineer assumed reasonable-sounding values without verifying against the actual TypeScript type definition.

**Evidence from SPRINT-011 Retro:**
> "Engineer assumed transaction stage values without verifying against actual TypeScript type definition. Reasonable-sounding values were invented rather than verified."

---

## Proposed Solution

Add a Type Verification Checklist to the fixture task template so engineers verify enum values before committing.

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/task-file-authoring.md` - Add fixture task section

## Implementation Notes

### Proposed Content

```markdown
## Fixture Task Template Additions

### Type Verification Checklist (Required for Fixture Tasks)

Before committing fixture data, verify:

- [ ] All enum values match actual TypeScript definitions
- [ ] Import types from source files (do NOT hardcode values)
- [ ] Run `npm run type-check` before committing fixture data
- [ ] File paths to type definitions included in task acceptance criteria

### How to Verify Enum Values

```bash
# Find the type definition
grep -rn "type TransactionStage" --include="*.ts" src/ electron/

# Or check the exact file
cat electron/services/types.ts | grep -A 10 "TransactionStage"
```

### PM Responsibility

When creating fixture tasks, PM MUST:
1. Include exact enum values in task file (not "use appropriate values")
2. Provide file path to type definition
3. Add type-check to acceptance criteria

### Example

**Bad task spec:**
> "Use appropriate transaction stages for the test emails"

**Good task spec:**
> "Use TransactionStage values from `electron/services/types.ts`:
> - Valid values: `intro`, `showing`, `offer`, `inspections`, `escrow`, `closing`, `post_closing`
> - Do NOT use: `initial_contact`, `negotiation`, `contract` (these don't exist)"
```

---

## Acceptance Criteria

- [ ] task-file-authoring.md includes Fixture Task Template section
- [ ] Type Verification Checklist with 4 items included
- [ ] How to verify enum values (grep command) included
- [ ] PM responsibility section added
- [ ] Good/bad example provided

---

## Estimated Effort

- **Turns:** 1-2
- **Tokens:** ~6K
- **Time:** 10-15m

---

## References

- SPRINT-011 Retrospective: Pattern 3 (Type Alignment Gaps)
- SPRINT-011-phase-retro-report.md: Proposal 1
- TASK-800: Required fix commit for TransactionStage type alignment
