# SPRINT-H: SecReview H -- Deferred Improvements

**Sprint ID:** `7a432df3-1b3d-42bb-8531-fc9c3f84922d`
**Status:** Active
**Start Date:** 2026-03-19
**Integration Branch:** `int/secreview-h`
**Branch From:** `develop`

---

## Sprint Goal

Complete 4 deferred security review improvements: Zod runtime validation, list virtualization with IPC caching, Supabase migration CI, and window.api service abstraction extraction. All 4 items are parallel-safe with no shared file dependencies.

---

## In-Scope

| Task ID | Backlog ID | Title | Area | Est Tokens | Actual Tokens | Status |
|---------|------------|-------|------|-----------|---------------|--------|
| TASK-2265 | BACKLOG-1098 | Adopt Zod for runtime schema validation | cross-portal | 50K | - | In Progress |
| TASK-2267 | BACKLOG-1265 | Add list virtualization + IPC caching | electron | 40K | - | In Progress |
| TASK-2268 | BACKLOG-1266 | Supabase migration CI + backup verification | infrastructure | 30K | - | In Progress |
| TASK-2269 | BACKLOG-1267 | Extract window.api service abstractions | electron | 35K | - | In Progress |

**Total Estimated:** ~155K tokens

---

## Execution Plan

### Parallelization (SR-Approved)

All 4 tasks run in parallel using isolated git worktrees:

| Task | Worktree | Branch | Files Touched |
|------|----------|--------|---------------|
| TASK-2265 | `Mad-TASK-2265` | `fix/task-2265-zod-validation` | electron/schemas/*, package.json |
| TASK-2267 | `Mad-TASK-2267` | `fix/task-2267-list-virtualization` | src/components/*, electron/services/ipcCache.ts |
| TASK-2268 | `Mad-TASK-2268` | `fix/task-2268-migration-ci` | .github/workflows/*, scripts/*, docs/* |
| TASK-2269 | `Mad-TASK-2269` | `fix/task-2269-window-api-abstractions` | src/services/*, src/components/* |

**Potential conflict:** TASK-2267 and TASK-2269 both touch `src/components/` but in different ways (virtualization wrapper vs service call extraction). SR Engineer to review for merge conflicts.

### Dependency Graph

```
TASK-2265 ─┐
TASK-2267 ─┤──> int/secreview-h ──> develop (PR, await user approval)
TASK-2268 ─┤
TASK-2269 ─┘
```

No inter-task dependencies. All merge to integration branch independently.

---

## Merge Strategy

1. Each task creates PR targeting `int/secreview-h`
2. SR Engineer reviews each PR individually
3. Merge approved PRs to `int/secreview-h` in any order
4. After all 4 merged: create final PR `int/secreview-h` -> `develop`
5. **DO NOT merge final PR** -- leave for user approval

---

## Task Progress

### TASK-2265: Zod Runtime Validation
- [ ] Worktree created
- [ ] Engineer assigned
- [ ] Plan reviewed (SR)
- [ ] Implementation complete
- [ ] PR created -> int/secreview-h
- [ ] SR review passed
- [ ] Merged to int/secreview-h

### TASK-2267: List Virtualization + IPC Caching
- [ ] Worktree created
- [ ] Engineer assigned
- [ ] Plan reviewed (SR)
- [ ] Implementation complete
- [ ] PR created -> int/secreview-h
- [ ] SR review passed
- [ ] Merged to int/secreview-h

### TASK-2268: Supabase Migration CI
- [ ] Worktree created
- [ ] Engineer assigned
- [ ] Plan reviewed (SR)
- [ ] Implementation complete
- [ ] PR created -> int/secreview-h
- [ ] SR review passed
- [ ] Merged to int/secreview-h

### TASK-2269: Window.api Service Abstractions
- [ ] Worktree created
- [ ] Engineer assigned
- [ ] Plan reviewed (SR)
- [ ] Implementation complete
- [ ] PR created -> int/secreview-h
- [ ] SR review passed
- [ ] Merged to int/secreview-h

---

## Sprint Retrospective

*To be completed after all tasks finish.*

### Estimation Accuracy

| Task | Estimated | Actual | Variance |
|------|-----------|--------|----------|
| TASK-2265 | 50K | - | - |
| TASK-2267 | 40K | - | - |
| TASK-2268 | 30K | - | - |
| TASK-2269 | 35K | - | - |
| **Total** | **155K** | - | - |

### Issues Summary

*Aggregated from task handoffs.*

### Lessons Learned

*To be completed after sprint.*
