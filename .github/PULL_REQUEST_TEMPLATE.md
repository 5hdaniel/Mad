## Summary
<!-- Brief description of what this PR does -->

## Changes
<!-- List specific changes made -->

## Task Reference
<!-- Always pair TASK and BACKLOG numbers — every PR must be traceable to a pm_backlog_items row -->
- **Task ID**: TASK-XXX
- **Backlog Item**: BACKLOG-XXX
- **Sprint**:
- **Branch**:

---

## Public Repository Notice

<!-- LOCKED SECTION. `Validate PR Metrics` fails if the sentence below is missing
     or altered by even one word. Do not reword it, do not "improve" it, do not
     move it into a details block. Add your own notes underneath it instead. -->

This repository is public. Do not describe vulnerabilities, addresses, credentials, endpoints, or network layout here. Link the backlog item.

<!-- Why this is a fixed sentence and not a checkbox: on 2026-09-03 and again on
     2026-09-06 an agent wrote accurate security detail into a commit message and
     a PR body, both times having read the prose rule minutes earlier. A checkbox
     gets ticked. A sentence that CI diffs cannot be ticked away.

     Correcting a wrong public sentence about a live surface means DELETING it,
     not replacing it with the accurate one. The accurate version is the more
     dangerous of the two.

     A PR body can be edited, but GitHub keeps every prior revision and shows it
     to anyone who can read the repo. A commit message cannot be edited at all,
     and a force-push does not remove it — GitHub still serves the orphaned
     object by SHA, to unauthenticated clients. See BACKLOG-3133. -->

---

## Engineer Pre-PR Checklist

**REQUIRED: Complete ALL items before requesting review**

### 1. Branch & Setup
- [ ] Created branch from the **Branch From** base in the task plan (default `int/<sprint-name>` for sprint tasks; `develop` for standalone work)
- [ ] Branch follows naming: `fix/task-XXX-*` or `feature/task-XXX-*`

### 2. Implementation
- [ ] All acceptance criteria met
- [ ] Tests pass locally: `npm test`
- [ ] Type check passes: `npm run type-check`
- [ ] Lint passes: `npm run lint`

### 3. Supabase Updated (source of truth)
- [ ] Implementation Summary posted via `pm_add_comment` on the backlog item
- [ ] Deviations/issues documented via `pm_add_comment` (if any)
- [ ] `branch_name` + `pr_url` recorded on the backlog item:
      `UPDATE pm_backlog_items SET branch_name = '<branch>', pr_url = '<url>' WHERE id = '<uuid>';`

### 4. Metrics Linkage
- [ ] Agent ID recorded below (numeric metrics are auto-captured to `pm_token_metrics` — do NOT paste token counts here)

---

## Engineer Metrics: TASK-XXX

### Agent ID

**Record this when the Task tool returns — it is the linkage key for `pm_token_metrics`:**
```
Engineer Agent ID: <paste your agent_id here>
```

> Numeric metrics (tokens, duration, API calls, variance) are auto-captured by the
> SubagentStop hook into Supabase `pm_token_metrics` after the agent finishes.
> PM rolls them up via `pm_record_task_tokens('<task_uuid>')` at Step 14 (BACKLOG-1873).

**Implementation Notes:**
<!-- Summary of approach, key decisions -->

---

## Test Plan
<!-- How to verify this change works -->
- [ ]

---

## SR Engineer Review Section

**DO NOT EDIT BELOW - For SR Engineer only**

### SR Engineer Checklist

**BLOCKING - Verify before reviewing code:**
- [ ] Engineer Agent ID is present (not placeholder)
- [ ] TASK-/BACKLOG- cross-reference present
- [ ] Implementation Summary posted in `pm_comments` on the backlog item
- [ ] `branch_name` + `pr_url` recorded on the backlog item

**Code Review:**
- [ ] CI passes
- [ ] Code quality acceptable
- [ ] Architecture compliance verified
- [ ] No security concerns

**Merge Gate:**
- [ ] User has explicitly approved the merge (testing gate — agent-handoff Step 12a). NEVER merge without it.

### SR Engineer Agent ID

```
SR Engineer Agent ID: <paste your agent_id here>
```

**Review Notes:**
<!-- Architecture concerns, security review, approval rationale -->

---

**After user approval and merge, PM records metrics via `pm_record_task_tokens` and marks the item complete in Supabase.**

---

## Automated Validation

This PR will be automatically validated by CI for:
- Presence of the Engineer Metrics section
- Presence of an Agent ID (pm_token_metrics linkage key)
- A TASK-#### or BACKLOG-#### cross-reference
- The **Public Repository Notice** sentence, present and unaltered (BACKLOG-3133)

Separately, the **Message Hygiene Gate** scans this PR's title, body and every
commit message for addresses, credentials, privileged role names, admin
endpoints and denylisted terms. It re-runs when the description is EDITED, not
only when you push.

PRs missing these elements will fail the PR Metrics Validation check.
Numeric metrics are NOT validated in the PR body — they live in Supabase (BACKLOG-1873).
