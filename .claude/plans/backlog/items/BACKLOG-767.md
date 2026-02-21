# BACKLOG-767: Investigate and split oversized service files

**Type:** refactor
**Area:** service
**Priority:** Medium
**Status:** Pending
**Sprint:** SPRINT-090
**Created:** 2026-02-21

---

## Description

5 service files exceed maintainability thresholds and mix too many concerns:

| Service | Lines | Concerns |
|---------|-------|----------|
| `folderExportService.ts` | ~2,599 | Export + contact resolution + PDF + attachment manifest |
| `transactionService.ts` | ~2,083 | CRUD + email fetch + message parsing + extraction |
| `macOSMessagesImportService.ts` | ~1,966 | Parsing + filtering + validation + DB persistence |
| `contactDbService.ts` | ~1,719 | CRUD + phone/email lookup + dedup + activity tracking |
| `databaseService.ts` | ~1,667 | Catch-all facade over specialized db services |

## Investigation Required

Some services may already be manageable after recent refactoring work:

- **databaseService.ts** was noted as "already refactored into facade pattern" in SPRINT-089
- **folderExportService.ts** just had utilities extracted by TASK-2030 (export dedup)
- Prior backlog items overlap:
  - BACKLOG-738 (split service files -- folderExportService, transactionService, contactDbService)
  - BACKLOG-497 (SQLite worker thread -- may subsume databaseService refactor)
  - BACKLOG-193 (refactor databaseService.ts -- 1,223 lines when created, now 1,667)

## Approach

**Investigation-first**: Read-only assessment of each service to determine:
1. Current line count (may have changed after TASK-2030 extractions)
2. Whether the facade pattern / recent extractions have made it manageable
3. Which services genuinely need splitting vs which can be deferred
4. Risk assessment for each split (how many consumers, test coverage)

Then: implement splits only for services that clearly need it, defer the rest.

## Task

TASK-2032

## Related Items

- BACKLOG-738 (split oversized service files)
- BACKLOG-497 (SQLite worker thread)
- BACKLOG-193 (refactor databaseService.ts)
