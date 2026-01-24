# PR Lifecycle Management

**Status:** Canonical reference for PR lifecycle and orphan prevention
**Last Updated:** 2026-01-24

---

## CRITICAL: A PR is NOT Complete Until MERGED

**Creating a PR is step 3 of 4, not the final step.**

```
1. CREATE   → Branch + commits pushed
2. OPEN     → PR created with description
3. APPROVE  → CI passes + SR Engineer approves
4. MERGE    → PR merged to target branch ← COMPLETION HAPPENS HERE
```

A PR that is approved but not merged is an ORPHANED PR. This is a process failure.

---

## The Orphan PR Problem

### What Happened (SPRINT-051/052 Incident)

- 20+ PRs were created during sprints
- Many had failing CI or merge conflicts
- Engineers moved on to next tasks without merging
- User thought sprints were complete
- Same bugs were "fixed" multiple times because original fixes were never merged
- Massive confusion and lost work

### Root Cause

- No explicit rule that PRs must be merged before task completion
- No session-end verification of open PRs
- No enforcement that engineers must merge (not just create) PRs

---

## PR Lifecycle Rules (MANDATORY)

### Rule 1: Task is NOT Complete Until PR is MERGED

A task status can only be "Complete" when:
- [ ] PR is merged (not just approved)
- [ ] Merge verified with `gh pr view <number> --json state`
- [ ] State shows `"MERGED"`, not `"OPEN"`

```bash
# Verify PR is actually merged
gh pr view 123 --json state --jq '.state'
# Expected: MERGED
# If it says OPEN, the task is NOT complete
```

### Rule 2: Engineer MUST Merge After SR Approval

After SR Engineer approves a PR, the Engineer MUST:

1. **Merge immediately** (do not wait, do not move to next task)
   ```bash
   gh pr merge <PR-NUMBER> --merge
   ```

2. **Verify merge succeeded**
   ```bash
   gh pr view <PR-NUMBER> --json state --jq '.state'
   # Must show: MERGED
   ```

3. **Only THEN mark task as complete**

### Rule 3: Session-End PR Verification (MANDATORY)

Before ending ANY working session, run this check:

```bash
# Check for open PRs that might be orphaned
gh pr list --state open --author @me
```

**If ANY open PRs exist:**
- [ ] Is CI failing? → Fix before ending session
- [ ] Is it awaiting review? → Note for next session
- [ ] Is it approved but not merged? → MERGE NOW
- [ ] Does it have merge conflicts? → Resolve before ending session

**Do NOT end a session with approved-but-unmerged PRs.**

### Rule 4: Sprint Completion PR Audit

Before marking ANY sprint as complete:

```bash
# List all open PRs
gh pr list --state open

# Check for sprint-related PRs (look for task IDs, sprint slugs)
gh pr list --state open --search "TASK-"
gh pr list --state open --search "SPRINT-"
```

**A sprint is NOT complete if:**
- Any sprint-related PR is still open
- Any task has an unmerged PR
- Any approved PR is waiting for merge

---

## PR State Reference

| State | Meaning | Action Required |
|-------|---------|-----------------|
| `OPEN` | PR exists but not merged | Needs merge |
| `CLOSED` | PR closed without merge | Work is LOST - investigate |
| `MERGED` | PR successfully merged | Task can be marked complete |

### Danger: CLOSED vs MERGED

```bash
# Check if a PR was merged or just closed
gh pr view 123 --json state,mergedAt

# MERGED shows:
# { "state": "MERGED", "mergedAt": "2026-01-24T..." }

# CLOSED (not merged) shows:
# { "state": "CLOSED", "mergedAt": null }
```

A CLOSED (not merged) PR means the work was ABANDONED. This should trigger investigation.

---

## Workflow Integration

### For Engineers

After SR approval, your workflow is:

```
1. SR Engineer approves PR
2. You merge: gh pr merge <PR> --merge
3. You verify: gh pr view <PR> --json state
4. ONLY THEN: Mark task complete in task file
5. ONLY THEN: Report to PM that task is done
```

### For SR Engineers

After approving a PR, verify engineer merges it:

```
1. Approve PR
2. Instruct engineer to merge
3. Before moving on, verify: gh pr view <PR> --json state
4. If still OPEN after 5 minutes, follow up
```

### For PM

Before closing a sprint:

```
1. Run: gh pr list --state open
2. Identify any sprint-related PRs
3. For each open PR:
   - If approved: Instruct engineer to merge
   - If CI failing: Assign fix
   - If conflicts: Assign resolution
4. ONLY mark sprint complete when all PRs show MERGED
```

---

## Verification Commands Quick Reference

```bash
# Check single PR state
gh pr view <NUMBER> --json state --jq '.state'

# List all open PRs
gh pr list --state open

# List your open PRs
gh pr list --state open --author @me

# Check if PR was merged or closed
gh pr view <NUMBER> --json state,mergedAt

# List recently merged PRs (last 7 days)
gh pr list --state merged --limit 20

# Search for orphaned sprint PRs
gh pr list --state open --search "TASK-"
```

---

## Incident Prevention Checklist

Copy this to your notes before each working session:

```markdown
## Session End Checklist

Before ending this session:
- [ ] `gh pr list --state open --author @me` - No orphaned PRs
- [ ] All approved PRs have been merged
- [ ] All merges verified with `gh pr view <PR> --json state`
- [ ] No PRs with failing CI left unattended
- [ ] Sprint tracker updated with merge confirmations
```

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `.claude/docs/PR-SOP.md` | Full PR procedure (Phase 9 = Merge) |
| `.claude/docs/ENGINEER-WORKFLOW.md` | Engineer task completion criteria |
| `.claude/skills/agentic-pm/modules/sprint-management.md` | Sprint closure checklist |
