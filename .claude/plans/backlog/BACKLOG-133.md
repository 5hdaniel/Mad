# BACKLOG-133: Engineer Token Cap with Early Reporting

**Priority:** HIGH
**Category:** process
**Status:** Pending
**Created:** 2026-01-02
**Source:** SPRINT-014 observation - token overconsumption prevention

---

## Problem Statement

Engineers can consume excessive tokens without early detection. In past incidents:
- TASK-906/908 race condition: ~18M tokens (BACKLOG-132)
- TASK-909 original run: ~2.7M tokens (CI wait loops)

We need automatic detection and reporting when engineers exceed expected token usage.

## Proposed Solution

Add token cap logic to `engineer.md` agent prompt:

### 4x Token Cap Rule

```
If estimated tokens = X, then soft cap = 4X

When engineer reaches 4x estimated tokens:
1. STOP current work
2. Report status to PM:
   - Work completed so far
   - Current token count vs estimate
   - Remaining work
   - Reason for overconsumption (if known)
3. Wait for PM decision:
   - Continue (with new cap)
   - Abort and review
```

### Implementation

1. **Task file requirement**: All tasks must have `**Estimated:** X turns, ~YK tokens, Z min`
2. **Engineer prompt update**: Add token tracking and cap logic
3. **PM prompt update**: Handle token cap reports

### Example Task File Section

```markdown
**Estimated:** 3-4 turns, ~15K tokens, 15-20 min
**Token Cap:** 60K (4x upper estimate)
```

### Example Engineer Report

```
## TOKEN CAP REACHED

**Task:** TASK-XXX
**Estimated:** 15K tokens
**Current:** 60K tokens (4x cap hit)

### Progress
- [x] Step 1 complete
- [x] Step 2 complete
- [ ] Step 3: stuck on X

### Reason for Overconsumption
Encountered unexpected issue: [description]

### Options
1. Continue with additional 30K token budget
2. Abort and investigate root cause
3. Hand off to different approach

**Awaiting PM decision.**
```

## Acceptance Criteria

- [ ] Engineer.md updated with token cap logic
- [ ] Task template includes token cap field
- [ ] PM receives and can act on token cap reports
- [ ] Documentation updated with token cap workflow

## Do / Don't

### Do
- Make cap configurable per task (4x is default)
- Include clear reporting format
- Allow PM override for complex tasks

### Don't
- Hard-fail on cap (just report and wait)
- Apply cap to SR Engineer reviews (different workflow)
- Add excessive tracking overhead

---

## Related

- **BACKLOG-132**: Worktree race condition (root cause was different, but similar overconsumption)
- **BACKLOG-130**: Permission auto-denial (contributed to workarounds)
