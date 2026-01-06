# BACKLOG-134: Engineer Token Optimization

**Priority:** HIGH
**Category:** process
**Status:** Complete
**Created:** 2026-01-02
**Completed:** 2026-01-02
**Source:** SPRINT-014 observation - CI polling caused ~500K-2.7M token overconsumption

---

## Problem Statement

Engineer agents consume excessive tokens due to:
1. **CI polling loops** - Repeated `sleep X && gh pr checks` calls (10-20x)
2. **Verbose command output** - npm test/lint without --silent flags
3. **Edit tool retries** - Endless retries on "string not found" errors
4. **Unclear responsibility split** - Engineers waiting for CI instead of handing off

**Incidents:**
- TASK-909: ~2.7M tokens (CI wait loops + no Read/Glob permissions)
- TASK-907: ~656K tokens (CI watch loops)

## Solution

Update `.claude/agents/engineer.md` with four token optimization rules:

### 1. Engineers Don't Poll CI

After creating PR:
- Report PR number and link to PM/SR Engineer
- DO NOT wait for CI
- SR Engineer handles CI verification and merge

### 2. Use --silent Flags

```bash
# Instead of:
npm test -- --testPathPattern="foo"

# Use:
npm test -- --testPathPattern="foo" --silent
```

### 3. Limit Tool Retries

If an Edit fails twice with "string not found":
- STOP and report the issue
- DO NOT keep retrying with variations
- Ask for help or use a different approach

### 4. Clear Responsibility Split

| Agent | Does | Doesn't |
|-------|------|---------|
| Engineer | Implement, commit, push, create PR | Poll CI, wait for CI, merge |
| SR Engineer | Review, verify CI, merge | Re-implement |

## Implementation

Updated `.claude/agents/engineer.md`:
- Modified Step 6 to remove CI wait loop
- Modified Step 7 to clarify immediate handoff after PR creation
- Added "Token Optimization Rules" section
- Added "Tool Retry Limits" section

## Acceptance Criteria

- [x] Engineer.md updated with no-CI-polling rule
- [x] Engineer.md updated with --silent flag guidance
- [x] Engineer.md updated with tool retry limits
- [x] Clear responsibility split documented

## Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | 1 | ~8K | 5 min |
| **Total** | 1 | ~8K | 5 min |

## Related

- **BACKLOG-130**: Permission auto-denial (contributed to TASK-909 token burn)
- **BACKLOG-132**: Worktree race condition (~18M tokens)
- **BACKLOG-133**: Token cap with early reporting (future prevention)
