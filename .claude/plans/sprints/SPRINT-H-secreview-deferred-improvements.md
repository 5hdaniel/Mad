# SPRINT-H: SecReview H -- Deferred Improvements

**Sprint ID:** `7a432df3-1b3d-42bb-8531-fc9c3f84922d`
**Status:** Awaiting Merge (PR #1328 -> develop)
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
| TASK-2265 | BACKLOG-1098 | Adopt Zod for runtime schema validation | cross-portal | 50K | - | Completed |
| TASK-2267 | BACKLOG-1265 | Add list virtualization + IPC caching (cache only; react-window deferred) | electron | 40K | - | Completed |
| TASK-2268 | BACKLOG-1266 | Supabase migration CI + backup verification | infrastructure | 30K | - | Completed |
| TASK-2269 | BACKLOG-1267 | Extract window.api service abstractions (2 services; component migration deferred) | electron | 35K | - | Completed |

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
- [x] Worktree created (`Mad-TASK-2265`)
- [x] Engineer assigned
- [x] Plan reviewed (SR)
- [x] Implementation complete (28 tests, schemas for User/Contact/Transaction, graceful degradation)
- [x] PR #1325 created -> int/secreview-h
- [x] CI passed (all platforms)
- [x] Merged to int/secreview-h

### TASK-2267: IPC Caching (list virtualization deferred)
- [x] Worktree created (`Mad-TASK-2267`)
- [x] Engineer assigned
- [x] Plan reviewed (SR)
- [x] Implementation complete (19 tests, TTL cache, dedup, prefix invalidation, stats)
- [x] PR #1327 created -> int/secreview-h
- [x] CI passed (all platforms)
- [x] Merged to int/secreview-h
- **Note:** react-window integration deferred (requires TSX component changes)

### TASK-2268: Supabase Migration CI
- [x] Worktree created (`Mad-TASK-2268`)
- [x] Engineer assigned
- [x] Plan reviewed (SR)
- [x] Implementation complete (CI workflow + lint script + backup docs)
- [x] PR #1324 created -> int/secreview-h
- [x] CI passed (all platforms)
- [x] Merged to int/secreview-h

### TASK-2269: Window.api Service Abstractions
- [x] Worktree created (`Mad-TASK-2269`)
- [x] Engineer assigned
- [x] Plan reviewed (SR)
- [x] Implementation complete (messageService + outlookService + barrel exports)
- [x] PR #1326 created -> int/secreview-h
- [x] CI passed (all platforms, after fix for ipc.ts type alignment)
- [x] Merged to int/secreview-h
- **Note:** Component migration (60+ files) deferred per scope threshold

### Integration PR
- [x] PR #1328 created: `int/secreview-h` -> `develop`
- [ ] User approval pending
- [ ] Merged to develop

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

1. **TASK-2265 Zod avatar_url null handling:** UserSchema initially had `z.string().optional()` for `avatar_url` but actual DB data has `null` values. Fixed by changing to `z.string().nullable().optional()`. Pattern: always use `.nullable().optional()` for optional DB fields.

2. **TASK-2269 type mismatch with ipc.ts:** Service abstractions were initially authored against `src/window.d.ts` types, but TypeScript resolves `window.api` against `electron/types/ipc.ts` which has slightly different signatures (e.g., `importMacOSMessages` has 1 arg in ipc.ts vs 2 in window.d.ts, `onImportProgress` phase union differs). Root cause: two competing type declaration files. Fixed by aligning service types to `ipc.ts`. CI failed and was fixed in a follow-up commit.

3. **Worktree node_modules:** Worktrees don't share `node_modules`. Required symlinking from main repo for test execution.

4. **lint-migrations.sh macOS grep compatibility:** Initial script used `grep -P` (Perl regex) which macOS BSD grep doesn't support. Fixed by rewriting all patterns to use `grep -E` (POSIX extended regex).

5. **Scope reductions:** TASK-2267 deferred react-window integration (requires TSX component changes in multiple files). TASK-2269 deferred component migration (60+ files with `window.api` calls) per scope threshold.

### Lessons Learned

- **Type declaration conflicts**: When `window.d.ts` and `ipc.ts` both define `MainAPI`, TypeScript merges them but `ipc.ts` takes precedence for `window.api`. Always verify against `ipc.ts` for service wrappers.
- **Graceful degradation for validation**: The Zod `validateResponse()` pattern (log warning, return data as-is on failure) is safe for gradual rollout -- no runtime breakage.
- **Migration lint**: 87 existing migrations pass validation with only 2 advisory warnings (expected patterns for legacy migrations).
