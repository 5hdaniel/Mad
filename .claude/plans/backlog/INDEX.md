# Backlog Index

This index tracks all backlog items with their current status and metadata.

**Last Updated:** 2026-01-17 (Added BACKLOG-298 video attachments, BACKLOG-299 group chat bug)
**Total Items:** 269
**Pending:** 147 | **In Progress:** 0 | **Completed:** 110 | **Partial:** 0 | **Obsolete:** 1 | **Deferred:** 2 | **Blocked:** 1

---

> **NON-NEGOTIABLE: METRICS CAPTURE REQUIRED**
>
> When completing ANY backlog item, you MUST:
>
> 1. **Record your agent_id immediately** when the Task tool returns
> 2. **Retrieve auto-captured metrics** via: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`
>
> | Metric | Source | Required |
> |--------|--------|----------|
> | Total Tokens | Auto-captured | Yes |
> | Duration | Auto-captured | Yes |
> | API Calls | Auto-captured | Yes |
> | Variance | Calculated | Yes |
>
> **No exceptions.** PR rejected without Implementation Summary in task file.

---

## Quick Filters

### By Priority

#### Critical (Audit Findings - Address First)
- **Security:** **232** (webSecurity disabled in OAuth), **235** (jsdiff DoS), **236** (PII masking in LLM), **287** (dashboard visible after logout)
- **Reliability:** **233** (unhandled rejection handlers), **234** (sync orchestrator race condition)
- **Architecture:** **237** (Transactions.tsx 19 useState), **238** (oversized flow hooks), **239** (direct db access)
- **Operations:** **240** (migration rollback), **241** (startup health checks)
- **Existing:** BACKLOG-030 (done), 032 (done), 035 (done), 038 (done), 039 (done), 044 (done), 045 (done), 058 (done), 059 (done), 072 (done), 073 (done), 074 (done), 107 (done), 108 (done), 117 (done), 132 (done), 139 (done), 142 (done), 209 (done), 212 (done), 213 (done), **191** (service tests), 202 (done), **229** (binary plist)

#### High (Audit Findings)
- **Reliability:** **242** (AbortController), **243** (IPC error handling), **244** (session cleanup), **245** (db connection), **246** (error boundaries)
- **Security:** **247** (preload sandbox), **248** (env var exposure), **249** (CSP tightening)
- **Architecture:** **250** (service dependencies), **251** (IPC handler patterns), **252** (LLM decoupling), **253** (module-level state)
- **Code Quality:** **254** (any/unknown types), **255** (large components), **256** (TODO/FIXME), **257** (useAutoRefresh state)
- **Performance:** **258** (N+1 query), **259** (event listener leak), **260** (virtual scrolling)
- **Operations:** **261** (logging unification), **262** (pre-deploy validation), **263** (auto-updater metrics)
- **Documentation:** **264** (LLM service API), **265** (algorithm docs)
- **Existing:** BACKLOG-008, 009, 013, 016, 018, 020, 021, 023, 026, 031, 033, 037, 056, 060 (done), 061 (done), 062 (done), 063 (done), 067, 075 (done), 076 (done), 084 (done), 085 (done), 088, 090 (done), 091 (done), 098, 099, 103 (done), 105 (done), 109 (done), 110 (done), **111**, 118 (done), 121 (done), 126 (done), 130 (done), 133 (done), 136 (done), 137 (done), 140 (done), 148 (done), 156 (done), **157**, **203**, 206 (done), 207 (done), 210 (done), 211 (done), 214 (done), 215 (done), 216 (done), 217 (done), **218** (BLOCKED), **220**, **221**, **222**, **228**

#### Medium (Audit Findings)
- **Code Quality:** **266** (duplicate utils), **267** (error handling patterns), **268** (relative imports)
- **Performance:** **269** (memoization), **270** (array operations), **271** (db indexes), **272** (JSON serialization)
- **Reliability:** **273** (test coverage), **274** (app termination cleanup)
- **Operations:** **275** (renderer logging), **276** (error recovery), **277** (CI secrets), **297** (startup error handling)
- **Documentation:** **278** (JSDoc coverage), **279** (IPC docs), **280** (migration docs), **281** (doc standards), **282** (error docs), **283** (config docs)
- **Existing:** Multiple (see full index), 014 (done), 050 (done), 054 (done), 065 (done), 077 (done), 078 (done), 079 (done), 081, 086, 087, 089, 092, 093, 094, 095, 096, 097, 100, 101, 102, 104 (done), **112**, **113**, **114**, **115**, **116**, 122 (done), 124 (done), 127 (done), 128 (done), 129 (done), **131**, 135 (done), 138 (done), 149 (done), 152 (done), **158**, **159**, 169 (done), 181 (done), **204**, 208 (done), **223**, **227**, 230 (done), **231**

#### Low (Audit Findings)
- **Architecture:** **284** (dependency injection), **285** (data abstraction layer)
- **Existing:** BACKLOG-001, 003, 004, 010, 017, 069 (deferred), 070 (deferred), 071, 092, **119**, **123**, **125**, 150 (done), **151**, 155 (done), **160**, **205**, **219**, **224**, **225**, **226**

### By Sprint Assignment
- **SPRINT-001 (Onboarding Refactor):** Completed
- **SPRINT-002 (Tech Debt):** Completed (BACKLOG-058, 059, 060)
- **SPRINT-003 (Process & Data Integrity):** Completed (BACKLOG-072, 038, 039, 035)
- **SPRINT-004 (AI MVP Foundation):** Completed (BACKLOG-073, 074)
- **SPRINT-005 (AI MVP Core):** Completed (BACKLOG-075, 076)
- **SPRINT-006 (AI MVP Polish):** Completed (BACKLOG-077, 078, 079) - TASK-401 to TASK-414
- **SPRINT-007 (LLM Cost Optimization):** Completed (BACKLOG-084, 085) - TASK-501 to TASK-512
- **SPRINT-008 (TransactionList Refactoring):** Completed - TASK-513 to TASK-521
- **SPRINT-009 (Codebase Standards Remediation):** Completed - TASK-600 to TASK-620 (20 tasks)
- **SPRINT-010 (Core Polish & Text Messages):** Completed - BACKLOG-103, 054, 105, 104, 050 (7 tasks: TASK-700 to TASK-706)
- **SPRINT-011 (Testing Infrastructure & Demo):** Completed - BACKLOG-108, 014 (5 tasks: TASK-800 to TASK-804)
- **SPRINT-012 (Process & Documentation Improvements):** Completed - BACKLOG-124 (done), 126 (done), 127 (done), 128 (done), 129 (done), 130 (done) (6 tasks: TASK-805 to TASK-810, PR #262)
- **SPRINT-013 (Architecture Cleanup):** Completed - BACKLOG-107 (done), 109 (done), 110 (done) (3 tasks: TASK-901 to TASK-903, PRs #263-265)
- **SPRINT-014 (Feature/Performance):** Completed - BACKLOG-032 (done), 090 (done), 091 Phase 1 (done) (9 tasks: TASK-904 to TASK-912, PRs #266-274)
- **SPRINT-015 (Infrastructure Stabilization):** Completed - BACKLOG-132 (done), 133 (done), 135 (done), 121 (done), 091 Phase 2 (done) (7 tasks: TASK-913 to TASK-919, PRs #275-281 + hotfix #278)
- **SPRINT-017 (Metrics Workflow Test):** Completed - TASK-921 (1 task, PR #283) - Validated auto-captured metrics workflow
- **SPRINT-018 (Token Accounting):** Completed - TASK-922, TASK-923 (2 tasks, PRs #284-285) - Added billable_tokens to metrics
- **SPRINT-019 (Database Gate):** Completed - BACKLOG-139, TASK-924 (PR #286 + 2 hotfixes) - Database init gate + backend fix
- **SPRINT-020 (State Coordination Foundation):** Complete - BACKLOG-142 Phase 1 (7 tasks: TASK-927 to TASK-933, PRs #287-294)
- **SPRINT-021 (State Coordination Migration):** Complete - BACKLOG-142 Phase 2 (PRs #296-309)
- **SPRINT-022 (State Coordination Cleanup):** Complete - BACKLOG-142 Phase 3 (10 tasks, PRs #306-313, ~198K tokens)
- **SPRINT-016 (Component Refactoring):** DEPRECATED - Task IDs collided with SPRINT-017/18/19; scope moved to SPRINT-023
- **SPRINT-023 (Architecture Debt Reduction):** Completed - BACKLOG-149 (done), 148 (done), 152 (done), 140 (done) (5 tasks: TASK-960 to TASK-964, PRs #314-317)
- **SPRINT-024 (Quality & Coverage):** PLANNED - BACKLOG-157, 159, 112, 113, 158 (5 tasks: TASK-970 to TASK-974)
- **SPRINT-031 (Codebase Health):** PLANNED - BACKLOG-191, 115 (partial), 192 (partial) (6 tasks: TASK-1017 to TASK-1022)
- **SPRINT-032 (Bug Fixes & Stability):** PLANNED - BACKLOG-202, 157, 203, 204 (partial) (5 tasks: TASK-1023 to TASK-1027)
- **SPRINT-025 (Communications Architecture):** COMPLETE - TASK-975 to TASK-977 (3 tasks completed: communications refactor, export folders, auto-link texts; TASK-978 deferred). **Incidents:** 14.2M token exploration loop (BACKLOG-161), PR merged without review, file overlap caused merge conflicts.
- **SPRINT-027 (Messages & Contacts Polish):** COMPLETE - 6 tasks (TASK-990 to TASK-995) + 9 unplanned fixes. PRs #354-362. Messages feature fully functional with thread grouping, auto-linking, manual attach/unlink, bubble direction, and contact fixes.
- **SPRINT-028 (Stability & UX Polish):** COMPLETE - 6 tasks (TASK-1003 to TASK-1009) + 7 unplanned fixes. PRs #364-369. npm audit fix, dashboard scroll, Show in Folder, state machine reduce, T&C streamline, auto-refresh.
- **SPRINT-033 (iMessage Stability & UX):** COMPLETE - 5 tasks (TASK-1028 to TASK-1032). PRs #400-408. iMessage encoding fix, UI freeze fix, contacts pre-pop fix, auto-link comms, separate email/text counts.
- **SPRINT-034 (Stability Fixes):** COMPLETE - 6 of 7 tasks (TASK-1035 to TASK-1040). PRs #413-418. Binary plist parsing, settings scroll, auto-link regression, contacts pre-pop regression, email state mismatch, edit contacts modal. TASK-1041 blocked pending requirements.
- **SPRINT-035 (Contact & Communication Fixes):** PLANNING - 4 tasks (TASK-1042 to TASK-1045). Contact save fix, unlink UI refresh, attachments stale ID, email banner UX.
- **SPRINT-036 (Deterministic Message Parsing):** COMPLETE - 6 of 7 tasks (TASK-1046 to TASK-1051). PRs #420-426. Deterministic format detection, binary plist refactor, typedstream refactor, parser integration, thread ID validation, message parsing test suite. TASK-1052 (user verification) pending.
- **SPRINT-037 (Test Coverage):** COMPLETE - 3 tasks (TASK-1053 to TASK-1055). PRs #428-429. Fixed databaseService native module mocking, added critical path tests, configured CI coverage thresholds. **Note:** 20 tests still failing in iosMessagesParser.test.ts (BACKLOG-231).
- **Unassigned:** All others

### State Coordination Overhaul Project - COMPLETE
- **Phase 1 (Foundation):** BACKLOG-142 / SPRINT-020 - **Complete** (PRs #287-294)
- **Phase 2 (Migration):** SPRINT-021 - **Complete** (PRs #296-309)
- **Phase 3 (Cleanup):** SPRINT-022 - **Complete** (PRs #310+)
- **Architecture Docs:** `.claude/docs/shared/state-machine-architecture.md`
- **Note:** State machine is now the only code path; legacy hooks removed

### AI MVP Project - COMPLETE
- **Phase 0 (Schema):** BACKLOG-073 - Completed
- **Phase 1 (LLM Infrastructure):** BACKLOG-074 - Completed
- **Phase 2 (AI Analysis Tools):** BACKLOG-075 - Completed
- **Phase 3 (Hybrid Pipeline):** BACKLOG-076 - Completed
- **Phase 4 (Feedback Loop):** BACKLOG-077 - Completed
- **Phase 5 (UI Enhancements):** BACKLOG-078 - Completed
- **Phase 6 (Integration Testing):** BACKLOG-079 - Completed
- **Note:** BACKLOG-066 (LLM Transaction Detection) is now covered by AI MVP project

---

## Full Index

**Categories:** `schema` | `service` | `ipc` | `ui` | `refactor` | `test` | `config` | `docs` | `infra` | `security` | `enhancement`

> **METRICS FORMAT CHANGE (2026-01-03)**
>
> Self-reported metrics (Turns/Time) have been deprecated. New tasks use auto-captured metrics:
> - **Est. Tokens**: PM estimate
> - **Actual Tokens**: From SubagentStop hook (`.claude/metrics/tokens.jsonl`)
> - **Duration**: Seconds (auto-captured)
> - **Variance**: (Actual - Est) / Est × 100
>
> Legacy columns retained for historical data. New tasks populate: Est Tokens, Actual Tokens, Duration, Variance.

| ID | Title | Category | Priority | Status | Sprint | Est. Turns | Est. Tokens | Est. Time | Impl Turns | Impl Tokens | Impl Time | PR Turns | PR Tokens | PR Time | Debug Turns | Debug Tokens | Debug Time | Total Turns | Total Tokens | Total Time | Variance | File |
|----|-------|----------|----------|--------|--------|------------|-------------|-----------|------------|-------------|-----------|----------|-----------|---------|-------------|--------------|------------|-------------|--------------|------------|----------|------|
| BACKLOG-001 | Add ES Module Type to package.json | infra | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-001.md](BACKLOG-001.md) |
| BACKLOG-002 | Code-Split Large JS Bundle | infra | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-002.md](BACKLOG-002.md) |
| BACKLOG-003 | Improve First-Sync Time Estimation | ui | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-003.md](BACKLOG-003.md) |
| BACKLOG-004 | Add Sync History/Logs Screen | ui | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-004.md](BACKLOG-004.md) |
| BACKLOG-005 | Implement databaseService with LLM-Ready Patterns | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-005.md](BACKLOG-005.md) |
| BACKLOG-006 | Dark Mode (Match System Settings) | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-006.md](BACKLOG-006.md) |
| BACKLOG-007 | Add iPhone Sync Integration Tests | test | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-007.md](BACKLOG-007.md) |
| BACKLOG-008 | Redesign New Transaction Flow | ui | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-008.md](BACKLOG-008.md) |
| BACKLOG-009 | Auth Popup Close Handler | ui | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-009.md](BACKLOG-009.md) |
| BACKLOG-010 | Default App Window to Full Screen | ui | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-010.md](BACKLOG-010.md) |
| BACKLOG-011 | Manually Add Missing Emails to Audit | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-012 | Manually Add Missing Texts to Audit | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-013 | Duplicate Transaction Detection | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-014 | Update Joyride Demo for New Users | ui | Medium | Completed | SPRINT-011 | 6-10 | ~35K | 13m | 3 | ~12K | 8m | 2 | ~6K | 5m | 0 | 0 | 0 | 5 | ~18K | 13m | -72% | [BACKLOG-014.md](BACKLOG-014.md) |
| BACKLOG-015 | Display Last Sync Time in UI | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-016 | Refactor Contact Import | refactor | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-017 | Naming Convention Documentation | docs | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-018 | Smart Contact Sync | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-019 | Returning User Experience | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-020 | Device UUID Licensing | infra | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-021 | License Management System | infra | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-022 | Minimizable iPhone Sync Modal | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-023 | Detailed Sync Progress | ui | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-024 | Auto-Start Sync on Launch | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-025 | Resume Failed Sync Prompt | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-026 | Skip Driver Install Check | infra | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-027 | Skip Mailbox Permission | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-028 | Create App Logo & Branding | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-029 | App Startup Performance | infra | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-030 | Message Parser Async Yielding | service | Critical | Completed | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-031 | Incremental Backup Size Estimation | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-032 | Handle Backup Already in Progress | service | Critical | Completed | SPRINT-014 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-904, 910 | - |
| BACKLOG-033 | Check Supabase Terms Acceptance | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-034 | Phone Type Card Layout | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-035 | Remove Orphaned Table | schema | Critical | Completed | SPRINT-003 | 5-8 | 20-30K | ~30m | 10 | ~40K | ~20m | - | - | - | - | - | - | 10 | ~40K | ~20m | +25% | [BACKLOG-035.md](BACKLOG-035.md) |
| BACKLOG-036 | Fix Sync Phase UI Text | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-037 | Don't Fail Sync on Disconnect | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-038 | Schema Mismatch contacts.name | schema | Critical | Completed | SPRINT-003 | 10-15 | 40-60K | ~1.5h | 8 | ~30K | ~15m | - | - | - | - | - | - | 8 | ~30K | ~15m | -36% | [BACKLOG-038.md](BACKLOG-038.md) |
| BACKLOG-039 | Schema Mismatch transactions.status | schema | Critical | Completed | SPRINT-003 | 10-15 | 40-60K | ~1.5h | 25 | ~100K | ~45m | - | - | - | - | - | - | 25 | ~100K | ~45m | +100% | [BACKLOG-039.md](BACKLOG-039.md) |
| BACKLOG-040 | ContactsService macOS Paths | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-041 | Create UX Engineer Agent | docs | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-042 | Lookback Period Not Persistent | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-043 | Settings Screen Not Scrollable | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-044 | Multiple Contacts Per Role | ui | Critical | Completed | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Backend + UI implemented |
| BACKLOG-045 | Block Contact Deletion | service | Critical | Completed | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | getTransactionsByContact + tests |
| BACKLOG-046 | DB Init Circuit Breaker | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-047 | Contact Deletion Query Fix | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-048 | Transaction Edit Preserve Tab | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-049 | Communications Tab | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-050 | Attachments Tab | ui | Medium | Completed | SPRINT-010 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-706 |
| BACKLOG-051 | Delete Comms/Attachments | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-052 | AI Transaction Timeline | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-053 | Manually Add Communications | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-054 | Render Email HTML | ui | Medium | Completed | SPRINT-010 | 6-10 | ~35K-55K | 1-2h | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-701 |
| BACKLOG-055 | AI House Viewing Extraction | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-056 | macOS Code Signing Fix | infra | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-057 | Login Auth Timeout Retry | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-058 | Split databaseService.ts | refactor | Critical | Completed | SPRINT-002 | 60-80 | 200-300K | - | ~25 | ~100K | ~2h | 2 | ~15K | ~15m | 5 | ~20K | ~30m | ~32 | ~135K | ~3h | -54% | [BACKLOG-058.md](BACKLOG-058.md) |
| BACKLOG-059 | Fix Skipped Tests (27+) | test | Critical | Completed | SPRINT-002 | 12-18 | 48-72K | - | 10 | ~45K | - | 1 | ~12K | - | 3 | ~8K | - | 14 | ~65K | - | -7% | [BACKLOG-059.md](BACKLOG-059.md) |
| BACKLOG-060 | Fix N+1 Query Pattern | refactor | High | Completed | SPRINT-002 | 10-15 | 40-60K | - | - | - | - | - | - | - | - | - | - | 14 | ~55K | - | +12% | [BACKLOG-060.md](BACKLOG-060.md) |
| BACKLOG-061 | Refactor Transactions.tsx | refactor | High | Completed | SPRINT-009 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-605 |
| BACKLOG-062 | Refactor Contacts.tsx | refactor | High | Completed | SPRINT-009 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-606 |
| BACKLOG-063 | Refactor useAppStateMachine.ts | refactor | High | Completed | SPRINT-009 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Tests added by TASK-614 |
| BACKLOG-064 | Add Batch DB Operations | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-065 | Remove Console Statements | refactor | Medium | Completed | SPRINT-009 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-616 |
| BACKLOG-066 | LLM Transaction Detection | service | High | Obsolete | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Covered by AI MVP (BACKLOG-073-079) |
| BACKLOG-067 | AI Timeline Builder | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-068 | Contact Deduplication | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-069 | Telemetry & Analytics | infra | Low | Deferred | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-070 | Enterprise User Management | infra | Low | Deferred | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-071 | Atomic Transaction Creation | service | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-072 | Enforce Engineer Workflow Compliance | config | Critical | Completed | SPRINT-003 | 23-35 | 90-140K | ~3h | 8 | ~32K | 15m | 1 | ~12K | 8m | 2 | ~8K | 5m | 11 | ~52K | 28m | -62% | [BACKLOG-072.md](BACKLOG-072.md) |
| BACKLOG-073 | AI MVP Phase 0 - Schema Foundation | schema | Critical | Completed | SPRINT-004 | 22 | ~50K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-073.md](BACKLOG-073.md) |
| BACKLOG-074 | AI MVP Phase 1 - LLM Infrastructure | service | Critical | Completed | SPRINT-004 | 28 | ~70K | ~2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-074.md](BACKLOG-074.md) |
| BACKLOG-075 | AI MVP Phase 2 - AI Analysis Tools | service | High | Completed | SPRINT-005 | 28 | ~70K | ~2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-075.md](BACKLOG-075.md) |
| BACKLOG-076 | AI MVP Phase 3 - Hybrid Pipeline | service | High | Completed | SPRINT-005 | 34 | ~85K | ~2.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-076.md](BACKLOG-076.md) |
| BACKLOG-077 | AI MVP Phase 4 - Feedback Loop | service | Medium | Completed | SPRINT-006 | 8 | ~25K | ~1h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-077.md](BACKLOG-077.md) |
| BACKLOG-078 | AI MVP Phase 5 - UI Enhancements | ui | Medium | Completed | SPRINT-006 | 13 | ~40K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-078.md](BACKLOG-078.md) |
| BACKLOG-079 | AI MVP Phase 6 - Integration Testing | test | Medium | Completed | SPRINT-006 | 13 | ~40K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-079.md](BACKLOG-079.md) |
| BACKLOG-081 | Consolidate AI Consent into T&C | enhancement | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-081.md](BACKLOG-081.md) |
| BACKLOG-084 | Thread-Based Transaction Detection | service | High | Completed | SPRINT-007 | ~100 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-084.md](BACKLOG-084.md) |
| BACKLOG-085 | Test Thread-Based Detection Accuracy | test | High | Completed | SPRINT-007 | ~50 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-085.md](BACKLOG-085.md) |
| BACKLOG-086 | Local ML Model with Hybrid Training | service | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-086.md](BACKLOG-086.md) |
| BACKLOG-087 | Onboarding Value Proposition Screen | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-087.md](BACKLOG-087.md) |
| BACKLOG-088 | Per-User Local ML Model | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-088.md](BACKLOG-088.md) |
| BACKLOG-089 | Password Manager Support in Authentication | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-089.md](BACKLOG-089.md) |
| BACKLOG-090 | Incremental Sync - Only Process New Data | service | High | Completed | SPRINT-014 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-906, 907, 908, 911 | [BACKLOG-090.md](BACKLOG-090.md) |
| BACKLOG-091 | Prevent Duplicate Emails Across Providers | service | High | Completed | SPRINT-014/015 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Phase 1 (TASK-905, 909), Phase 2 (TASK-917, 918, 919) | [BACKLOG-091.md](BACKLOG-091.md) |
| BACKLOG-092 | Rename transactionDetailsModule | refactor | Low | Pending | - | 2-3 | ~10K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-092.md](BACKLOG-092.md) |
| BACKLOG-093 | Create common/ Module | refactor | Medium | Pending | - | 3-4 | ~15K | 20-30m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-093.md](BACKLOG-093.md) |
| BACKLOG-094 | Create llm/ Module | refactor | Medium | Pending | - | 2-3 | ~10K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-094.md](BACKLOG-094.md) |
| BACKLOG-095 | Create email/ Module | refactor | Medium | Pending | - | 4-5 | ~20K | 30-40m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-095.md](BACKLOG-095.md) |
| BACKLOG-096 | Create system/ Module | refactor | Medium | Pending | - | 4-5 | ~20K | 30-40m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-096.md](BACKLOG-096.md) |
| BACKLOG-097 | Relocate Root-Level Test Files | refactor | Medium | Pending | - | 6-8 | ~30K | 45-60m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-097.md](BACKLOG-097.md) |
| BACKLOG-098 | Split AuditTransactionModal.tsx | refactor | High | Pending | - | 6-8 | ~30K | 1-1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-098.md](BACKLOG-098.md) |
| BACKLOG-099 | Split EmailOnboardingScreen.tsx | refactor | High | Pending | - | 7-9 | ~35K | 1.5-2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-099.md](BACKLOG-099.md) |
| BACKLOG-100 | Create auth/ Module | refactor | Medium | Pending | - | 3-4 | ~15K | 20-30m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-100.md](BACKLOG-100.md) |
| BACKLOG-101 | Split PermissionsScreen.tsx | refactor | Medium | Pending | - | 5-6 | ~22K | 45-60m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-101.md](BACKLOG-101.md) |
| BACKLOG-102 | Security Hardening Evaluation | security | Medium | Pending | - | 6-8 | ~30K | 1.5-2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-102.md](BACKLOG-102.md) |
| BACKLOG-103 | Fix Contact Selection Issue | ui | High | Completed | SPRINT-010 | 4-8 | ~25K-40K | 45-90m | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-700 |
| BACKLOG-104 | Dashboard UI to Emphasize Auto-Detection | ui | Medium | Completed | SPRINT-010 | 6-10 | ~35K-50K | 1-2h | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-705 |
| BACKLOG-105 | Text Messages Tab in Transaction Details | ui | High | Completed | SPRINT-010 | 15-25 | ~80K-120K | 3-5h | - | - | - | - | - | - | - | - | - | - | - | - | Addressed by TASK-702/703/704 |
| BACKLOG-107 | Split useAppStateMachine.ts into Flow Hooks | refactor | Critical | Completed | SPRINT-013 | 30-40 | ~100K | 1-1.5d | 9 | ~36K | 27m | - | - | - | 0 | 0 | 0 | 9 | ~36K | 27m | -55% | [BACKLOG-107.md](BACKLOG-107.md) |
| BACKLOG-108 | Fix Flaky appleDriverService Test | test | Critical | Completed | SPRINT-011 | 2-4 | ~10K | 20m | 3 | ~10K | 10m | 3 | ~9K | 10m | 0 | 0 | 0 | 6 | ~19K | 20m | -67% | [BACKLOG-108.md](BACKLOG-108.md) |
| BACKLOG-109 | Reduce AppRouter.tsx to <300 Lines | refactor | High | Completed | SPRINT-013 | 4-6 | ~20K | 30-45m | 1 | ~12K | 8m | - | - | - | 0 | 0 | 0 | 1 | ~12K | 8m | -83% | [BACKLOG-109.md](BACKLOG-109.md) |
| BACKLOG-110 | Reduce AppShell.tsx to <150 Lines | refactor | High | Completed | SPRINT-013 | 3-4 | ~15K | 20-30m | 2 | ~8K | 5m | - | - | - | 0 | 0 | 0 | 2 | ~8K | 5m | -43% | [BACKLOG-110.md](BACKLOG-110.md) |
| BACKLOG-111 | Migrate Components to Service Abstractions | refactor | High | Pending | - | 40-50 | ~150K | 1-1.5d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-111.md](BACKLOG-111.md) |
| BACKLOG-112 | Boost Test Coverage for src/hooks/ | test | Medium | Pending | - | 40-60 | ~150K | 1-2d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-112.md](BACKLOG-112.md) |
| BACKLOG-113 | Boost Test Coverage for src/utils/ | test | Medium | Pending | - | 20-30 | ~80K | 1d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-113.md](BACKLOG-113.md) |
| BACKLOG-114 | Boost Test Coverage for electron/utils/ | test | Medium | Pending | - | 20-30 | ~80K | 1d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-114.md](BACKLOG-114.md) |
| BACKLOG-115 | Address Remaining any Types in Electron Handlers | refactor | Medium | Pending | - | 40-60 | ~150K | 1-2d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-115.md](BACKLOG-115.md) |
| BACKLOG-116 | Bring Google Login to Feature Parity with Microsoft | service | Medium | Pending | - | 15-20 | ~60K | 2-3h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-116.md](BACKLOG-116.md) |
| BACKLOG-117 | Fix Sprint 009 Auth Regressions (Preload Sandbox + Google Login) | service | Critical | Completed | - | 4-6 | ~20K | 30-60m | 2 | ~8K | 9m | 1 | ~5K | 5m | 0 | 0 | 0 | 3 | ~13K | 14m | -70% | [BACKLOG-117.md](BACKLOG-117.md) |
| BACKLOG-118 | Fix OnboardingFlow React Hooks Order Bug | ui | High | Completed | - | 1-2 | ~10K | 15m | 1 | ~8K | 10m | - | - | - | - | - | - | 1 | ~8K | 10m | -50% | [BACKLOG-118.md](BACKLOG-118.md) |
| BACKLOG-119 | Audit OAuth Handler Parity (Google/Microsoft) | refactor | Low | Pending | - | 13-18 | ~50K | 2-3h | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-119.md](BACKLOG-119.md) |
| BACKLOG-120 | CI Testing Infrastructure Gaps | test/infra | Medium | Pending | - | 20-30 | ~80K | 1-2d | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-120.md](BACKLOG-120.md) |
| BACKLOG-121 | Add Generator Approach Guidance for Large Fixtures | docs | High | Completed | SPRINT-015 | 2-3 | ~10K | 20-30m | N/A | ~800K-1.1M | N/A | - | - | - | - | - | - | N/A | ~800K-1.1M | N/A | ~100x | [BACKLOG-121.md](BACKLOG-121.md) |
| BACKLOG-122 | Improve Engineer Agent Worktree Instructions | docs | Medium | Completed | - | 2-3 | ~10K | 20-30m | 2 | ~8K | 10m | - | - | - | - | - | - | 2 | ~8K | 10m | -50% | [BACKLOG-122.md](BACKLOG-122.md) |
| BACKLOG-123 | Update Test Category Estimation Multiplier | docs | Low | Pending | - | 1-2 | ~5K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-123.md](BACKLOG-123.md) |
| BACKLOG-124 | Add Sprint Completion Checklist to PM Workflow | docs | Medium | Completed | SPRINT-012 | 2-3 | ~10K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | TASK-805, PR #262 | [BACKLOG-124.md](BACKLOG-124.md) |
| BACKLOG-125 | Enforce Metrics Collection for All Sprints | docs | Low | Pending | - | 2-3 | ~8K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-125.md](BACKLOG-125.md) |
| BACKLOG-126 | Enforce Debugging Metrics with Commit Verification | docs | High | Completed | SPRINT-012 | 4-6 | ~20K | 30-45m | - | - | - | - | - | - | - | - | - | - | - | - | TASK-806, PR #262 | [BACKLOG-126.md](BACKLOG-126.md) |
| BACKLOG-127 | Add Sprint Capacity Limits to PM Workflow | docs | Medium | Completed | SPRINT-012 | 1-2 | ~6K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | TASK-807, PR #262 | [BACKLOG-127.md](BACKLOG-127.md) |
| BACKLOG-128 | Add Type Verification Checklist for Fixture Tasks | docs | Medium | Completed | SPRINT-012 | 1-2 | ~6K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | TASK-808, PR #262 | [BACKLOG-128.md](BACKLOG-128.md) |
| BACKLOG-129 | Create CI Troubleshooting Documentation | docs | Medium | Completed | SPRINT-012 | 2-3 | ~10K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | TASK-809, PR #262 | [BACKLOG-129.md](BACKLOG-129.md) |
| BACKLOG-130 | Sub-Agent Permission Auto-Denial Incident | infra/process | High | Completed | SPRINT-012 | 1-2 | ~8K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | TASK-810, PR #262 | [BACKLOG-130.md](BACKLOG-130.md) |
| BACKLOG-132 | Mandatory Worktree for Parallel/Background Agents | docs/process | Critical | Completed | SPRINT-015 | 1-2 | ~5K | 8-12m | 2 | ~8K | 5m | 1 | ~15K | 5m | 0 | 0 | 0 | 3 | ~23K | 10m | +360% | [BACKLOG-132.md](BACKLOG-132.md) |
| BACKLOG-133 | Engineer Token Cap with Early Reporting | docs/process | High | Completed | SPRINT-015 | 2-3 | ~10K | 15-25m | N/A | ~800K-1.1M | N/A | - | - | - | - | - | - | N/A | ~800K-1.1M | N/A | ~100x | TASK-914 |
| BACKLOG-135 | Fix window.d.ts Type Definitions | tech-debt | Medium | Completed | SPRINT-015 | 2-3 | ~10K | 15-20m | 3 | ~10K | 15m | - | - | - | - | - | - | 3 | ~10K | 15m | 0% | TASK-916 |
| BACKLOG-136 | PM Token Monitoring Workflow | docs/process | High | Completed | SPRINT-015 | 1 | ~5K | 10m | 1 | ~5K | 5m | - | - | - | - | - | - | 1 | ~5K | 5m | -50% | Hotfix during SPRINT-015 |
| BACKLOG-137 | Automatic Token Tracking Tooling | tooling | High | Completed | - | 6-10 | ~40K | 1-2h | 4 | ~34K | 20m | - | - | - | - | - | - | 4 | ~34K | 20m | -56% | [BACKLOG-137.md](BACKLOG-137.md) |
| BACKLOG-138 | Turns/Self-Reported Metrics Cleanup | docs/cleanup | Medium | Completed | - | - | ~75K | - | - | - | - | - | - | - | - | - | - | - | - | - | PR #282 | [BACKLOG-138.md](BACKLOG-138.md) |
| BACKLOG-139 | Comprehensive Database Initialization Gate | fix | Critical | Completed | SPRINT-019 | - | ~40K | - | - | ~889K | - | - | - | - | - | - | - | - | ~889K | ~31m | +2122% | [BACKLOG-139.md](BACKLOG-139.md) |
| BACKLOG-140 | Duplicate Transaction Re-Import Prevention | service | High | Completed | SPRINT-023 | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-964, PR #317 | [BACKLOG-140.md](BACKLOG-140.md) |
| BACKLOG-141 | Fix Onboarding Flicker for Returning Users (Quick Fix) | fix | Medium | Pending | - | - | ~10K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-141.md](BACKLOG-141.md) |
| BACKLOG-142 | State Coordination Layer Overhaul | refactor/arch | Critical | Completed | SPRINT-020/021/022 | - | ~850K | - | - | - | - | - | - | - | - | - | - | - | - | - | Multi-phase | [BACKLOG-142.md](BACKLOG-142.md) |
| BACKLOG-143 | Prevent Duplicate Contact Imports | enhancement | Medium | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-143.md](BACKLOG-143.md) |
| BACKLOG-148 | Split databaseService.ts into Domain Services | refactor | High | Completed | SPRINT-023 | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-961, PR #315 | [BACKLOG-148.md](BACKLOG-148.md) |
| BACKLOG-149 | Delete Deprecated EmailOnboardingScreen.tsx | refactor | Medium | Completed | SPRINT-023 | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-960, PR #314 | [BACKLOG-149.md](BACKLOG-149.md) |
| BACKLOG-150 | Reduce useAppStateMachine.ts Return Object | refactor | Low | Completed | SPRINT-028 | - | ~10K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1006, PR #367 | [BACKLOG-150.md](BACKLOG-150.md) |
| BACKLOG-151 | Reduce AppModals.tsx Below 150-Line Trigger | refactor | Low | Pending | - | - | ~5K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-151.md](BACKLOG-151.md) |
| BACKLOG-152 | Split TransactionDetails.tsx into Tab Components | refactor | Medium | Completed | SPRINT-023 | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-152.md](BACKLOG-152.md) |
| BACKLOG-155 | Dashboard Unnecessary Vertical Scroll | ui | Low | Completed | SPRINT-028 | - | ~10K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1004, PR #365 | [BACKLOG-155.md](BACKLOG-155.md) |
| BACKLOG-156 | Auto-Refresh Data Sources on App Load | service/enhancement | High | Completed | SPRINT-028 | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1003, PR #369 | [BACKLOG-156.md](BACKLOG-156.md) |
| BACKLOG-157 | Fix Failing Auth Handler Integration Test | test | High | Pending | SPRINT-024 | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-157.md](BACKLOG-157.md) |
| BACKLOG-158 | Decompose AuditTransactionModal Component | refactor | Medium | Pending | SPRINT-024 | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-158.md](BACKLOG-158.md) |
| BACKLOG-159 | Delete Deprecated PermissionsScreen.tsx | refactor | Medium | Pending | SPRINT-024 | - | ~10K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-159.md](BACKLOG-159.md) |
| BACKLOG-160 | Consolidate last_exported_at/on Column Naming | tech-debt | Low | Pending | - | - | ~5K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-165 | Duplicate Contacts in Import Contacts Page | ui | Medium | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-165.md](BACKLOG-165.md) |
| BACKLOG-166 | Platform Detection Returns "unknown" in Renderer | fix | Medium | Pending | - | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-166.md](BACKLOG-166.md) |
| BACKLOG-167 | Restrict Status Options for Manual Transactions | enhancement | Low | Pending | - | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-167.md](BACKLOG-167.md) |
| BACKLOG-168 | Transaction Bulk Edit Multi-Select Modal | ui | Medium | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-168.md](BACKLOG-168.md) |
| BACKLOG-169 | Show in Folder Button for Exports | ui | Medium | Completed | SPRINT-028 | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1008, PR #366 | [BACKLOG-169.md](BACKLOG-169.md) |
| BACKLOG-170 | Messages Not Loading in Attach Modal | fix | Critical | Needs Feature | - | - | ~5K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-170.md](BACKLOG-170.md) |
| BACKLOG-171 | Contacts Not Pre-Populated When Editing Transaction | fix | High | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-171.md](BACKLOG-171.md) |
| BACKLOG-172 | macOS Messages Import | feature | High | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-172.md](BACKLOG-172.md) |
| BACKLOG-173 | Contact-First AttachMessagesModal Interface | ui/perf | High | Completed | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-989, PR #353 | [BACKLOG-173.md](BACKLOG-173.md) |
| BACKLOG-174 | Redesign "Start New Audit" Flow | ui | High | Pending | SPRINT-029 | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-174.md](BACKLOG-174.md) |
| BACKLOG-178 | Auto-Linked Messages Display in Transaction Details | fix | High | Completed | SPRINT-027 | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-990, PR #358 | - |
| BACKLOG-179 | Manual Thread Attach/Unlink in Messages Tab | ui | High | Completed | SPRINT-027 | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-991, PR #359 | - |
| BACKLOG-180 | Message Bubble Direction Fix | fix | Medium | Completed | SPRINT-027 | - | ~10K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-992, PR #356 | - |
| BACKLOG-181 | Streamline Terms and Conditions Onboarding Step | ui | Medium | Completed | SPRINT-028 | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1009, PR #368 | [BACKLOG-181.md](BACKLOG-181.md) |
| BACKLOG-182 | getCurrentUser() Returns False After Login | fix | High | Completed | SPRINT-027 | - | ~8K | - | - | - | - | - | - | - | - | - | - | - | - | - | direct commit | [BACKLOG-182.md](BACKLOG-182.md) |
| BACKLOG-183 | Mixed UI During Import - Instructions With Progress | fix | Medium | Completed | SPRINT-027 | - | ~5K | - | - | - | - | - | - | - | - | - | - | - | - | - | direct commit | [BACKLOG-183.md](BACKLOG-183.md) |
| BACKLOG-184 | Contacts Import Failing (1000 Limit) | fix | High | Completed | SPRINT-027 | - | ~2K | - | - | - | - | - | - | - | - | - | - | - | - | - | direct commit | [BACKLOG-184.md](BACKLOG-184.md) |
| BACKLOG-185 | Import Stuck at 100% on Progress Bar | fix | Medium | Completed | SPRINT-027 | - | ~3K | - | - | - | - | - | - | - | - | - | - | - | - | - | direct commit | [BACKLOG-185.md](BACKLOG-185.md) |
| BACKLOG-186 | Continue Button Not Working After Import | fix | Critical | Completed | SPRINT-027 | - | ~5K | - | - | - | - | - | - | - | - | - | - | - | - | - | direct commit | [BACKLOG-186.md](BACKLOG-186.md) |
| BACKLOG-187 | Display Attachments (Images/GIFs) in Text Messages | feature | Medium | Pending | SPRINT-029 | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-187.md](BACKLOG-187.md) |
| BACKLOG-188 | Scan Lookback Period Setting Not Persisting | fix | Medium | Pending | SPRINT-030 | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-188.md](BACKLOG-188.md) |
| BACKLOG-189 | Configurable Attachment Size Limit | enhancement | Low | Pending | - | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-189.md](BACKLOG-189.md) |
| BACKLOG-190 | Transaction Date Range for Message Linking | fix | Critical | Pending | SPRINT-030 | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-190.md](BACKLOG-190.md) |
| BACKLOG-191 | Add Test Coverage for Core Service Layer | test | Critical | Pending | SPRINT-031 | - | ~115K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-191.md](BACKLOG-191.md) |
| BACKLOG-192 | Clean Up Console Statements (186 Remaining) | refactor | Medium | Pending | SPRINT-031 | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-192.md](BACKLOG-192.md) |
| BACKLOG-193 | Refactor databaseService.ts (1,223 Lines) | refactor | High | Pending | - | - | ~80K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-193.md](BACKLOG-193.md) |
| BACKLOG-194 | Add Test Coverage for Contexts | test | Medium | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-194.md](BACKLOG-194.md) |
| BACKLOG-195 | Add Test Coverage for Large Hooks | test | Medium | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-195.md](BACKLOG-195.md) |
| BACKLOG-196 | Implement or Remove Settings.tsx TODOs | ui | Low | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-196.md](BACKLOG-196.md) |
| BACKLOG-197 | Enable Stricter TypeScript Rules | config | Low | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-197.md](BACKLOG-197.md) |
| BACKLOG-198 | Decompose Large Component Files | refactor | Low | Pending | - | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-198.md](BACKLOG-198.md) |
| BACKLOG-200 | Contacts import fails with email validation error | service | Medium | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-200.md](BACKLOG-200.md) |
| BACKLOG-201 | "00" prefix appearing before iMessage text | ui | Medium | Completed | - | - | ~5K | - | ~180K | - | - | - | - | - | - | - | - | - | ~180K | ~3h | +3500% | [BACKLOG-201.md](BACKLOG-201.md) |
| BACKLOG-202 | Fix Test Regressions (contact-handlers/databaseService) | test/fix | Critical | Completed | SPRINT-037 | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1053, PR #428 | [BACKLOG-202.md](BACKLOG-202.md) |
| BACKLOG-203 | Add Comprehensive Tests for macOSMessagesImportService | test | High | Pending | SPRINT-032 | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-203.md](BACKLOG-203.md) |
| BACKLOG-204 | Abstract window.api Calls into Service Layer | refactor | Medium | Pending | SPRINT-032 | - | ~80K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-204.md](BACKLOG-204.md) |
| BACKLOG-205 | Fix Flaky useAutoRefresh Timer Tests | test | Low | Pending | - | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-205.md](BACKLOG-205.md) |
| BACKLOG-206 | UI Freezing During iMessage Sync/Import | enhancement/perf | High | Completed | SPRINT-033 | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1029 | [BACKLOG-206.md](BACKLOG-206.md) |
| BACKLOG-207 | Auto-Link Communications When Contact Added | enhancement | High | Completed | SPRINT-033 | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1031 | [BACKLOG-207.md](BACKLOG-207.md) |
| BACKLOG-208 | Separate Email/Text Counts on Transaction Cards | ui | Medium | Completed | SPRINT-033 | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1032 | [BACKLOG-208.md](BACKLOG-208.md) |
| BACKLOG-209 | Fix iMessage Text Encoding Corruption (Data Loss) | service/fix | Critical | Completed | SPRINT-033 | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1028 | [BACKLOG-209.md](BACKLOG-209.md) |
| BACKLOG-210 | Contacts Not Pre-Populating in Edit Transaction | bug | High | Completed | SPRINT-033 | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1030 | [BACKLOG-210.md](BACKLOG-210.md) |
| BACKLOG-211 | Email Onboarding State Mismatch | bug/ux | High | Completed | SPRINT-034 | - | ~35K | - | ~184K | - | - | - | - | - | - | - | - | - | ~184K | TASK-1039, PR #417 | [BACKLOG-211.md](BACKLOG-211.md) |
| BACKLOG-212 | Settings Popup Not Scrollable | bug/ui | Critical | Completed | SPRINT-034 | - | ~40K | - | ~219K | - | - | - | - | - | - | - | - | - | ~219K | TASK-1036, PR #414 | [BACKLOG-212.md](BACKLOG-212.md) |
| BACKLOG-213 | Recurring Check Permissions Screen Bug | bug/stability | Critical | Completed | - | - | ~15K | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1033, PR #409 | [BACKLOG-213.md](BACKLOG-213.md) |
| BACKLOG-214 | Auto-Link Communications Not Working (TASK-1031 Regression) | bug/regression | High | Completed | SPRINT-034 | - | ~30K | - | ~463K | - | - | - | - | - | - | - | - | - | ~463K | TASK-1037, PR #415 | [BACKLOG-214.md](BACKLOG-214.md) |
| BACKLOG-215 | Encoding Corruption in Group Chats (Binary Plist Fix) | bug/data-integrity | High | Completed | SPRINT-034 | - | ~50K | - | ~432K | - | - | - | - | - | - | - | - | - | ~432K | TASK-1035, PR #413 | [BACKLOG-215.md](BACKLOG-215.md) |
| BACKLOG-216 | Edit Contacts Still Not Pre-Populating (TASK-1030 Regression) | bug/regression | High | Completed | SPRINT-034 | - | ~25K | - | ~386K | - | - | - | - | - | - | - | - | - | ~386K | TASK-1038, PR #416 | [BACKLOG-216.md](BACKLOG-216.md) |
| BACKLOG-217 | UX Improvement - Edit Contacts Button Flow | enhancement/ux | High | Completed | SPRINT-034 | - | ~40K | - | ~156K | - | - | - | - | - | - | - | - | - | ~156K | TASK-1040, PR #418 | [BACKLOG-217.md](BACKLOG-217.md) |
| BACKLOG-218 | Group Chat Display in Transaction Details (Placeholder) | enhancement/ux | High | Blocked | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | Pending user requirements | [BACKLOG-218.md](BACKLOG-218.md) |
| BACKLOG-219 | Audit Debug/Logging Calls Across Repository | tech-debt/quality | Low | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-219.md](BACKLOG-219.md) |
| BACKLOG-220 | Unlink Communications UI Not Refreshing | bug/ui | High | **Reopened** | SPRINT-042 | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | PR #450 insufficient; requires thread-based schema | [BACKLOG-220.md](BACKLOG-220.md) |
| BACKLOG-221 | iMessage Attachments Not Displaying (Stale message_id) | bug/data-integrity | High | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-221.md](BACKLOG-221.md) |
| BACKLOG-222 | Contact Changes Not Saving When Editing Transaction | bug/data-persistence | High | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-222.md](BACKLOG-222.md) |
| BACKLOG-223 | Add Text Message Status Indicator (Like Email Status) | enhancement/ux | Medium | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-223.md](BACKLOG-223.md) |
| BACKLOG-224 | Apply Edit Contacts Pattern to Transaction Details | enhancement/ux | Low | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-224.md](BACKLOG-224.md) |
| BACKLOG-225 | Video Attachment Support for iMessage Import | enhancement | Low | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-225.md](BACKLOG-225.md) |
| BACKLOG-226 | URL Preview Formatting in Messages | enhancement/ui | Low | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-226.md](BACKLOG-226.md) |
| BACKLOG-227 | Show iMessage Attachments in Attachments Tab | enhancement/ui | Medium | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-227.md](BACKLOG-227.md) |
| BACKLOG-228 | UI Freeze When Viewing Messages to Attach | bug/perf | High | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | Related to BACKLOG-173 regression | [BACKLOG-228.md](BACKLOG-228.md) |
| BACKLOG-229 | Binary Plist Text Still Showing as Garbage (CRITICAL) | bug/data-integrity | Critical | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | TASK-1035 incomplete | [BACKLOG-229.md](BACKLOG-229.md) |
| BACKLOG-230 | NULL thread_id Investigation and Fix | data-integrity | Medium | Completed | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | Analysis complete; macOS orphans, not parser issue | [BACKLOG-230-null-thread-id-investigation.md](BACKLOG-230-null-thread-id-investigation.md) |
| BACKLOG-231 | Fix Failing iosMessagesParser Tests (20 tests) | test | Medium | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | Mock database setup issues | [BACKLOG-231.md](BACKLOG-231.md) |

<!-- ============================================== -->
<!-- CODEBASE AUDIT FINDINGS (2026-01-15)           -->
<!-- Source: 7 SR Engineer Audits                    -->
<!-- ============================================== -->

<!-- CRITICAL PRIORITY - Security & Reliability -->
| BACKLOG-232 | Fix Disabled webSecurity in OAuth Popup Windows | security | Critical | Completed | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | googleAuthHandlers.ts, microsoftAuthHandlers.ts | PR #433 |
| BACKLOG-233 | Add Global Unhandled Rejection Handlers | reliability | Critical | Completed | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | main.ts, main.tsx missing process.on handlers | PR #435 |
| BACKLOG-234 | Fix Race Condition in Sync Orchestrator | reliability | Critical | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | Concurrent sync state conflicts | - |
| BACKLOG-235 | Patch jsdiff DoS Vulnerability | security | Critical | Completed | - | - | ~10K | - | - | - | - | - | - | - | - | - | - | - | - | - | npm audit vulnerability | PR #434 |
| BACKLOG-236 | Fix Incomplete PII Masking in LLM Pipeline | security | Critical | Completed | - | - | ~45K | - | - | - | - | - | - | - | - | - | - | - | - | - | Content sent to LLM may expose PII | PR #436 |
| BACKLOG-287 | Dashboard Visible After Logout | security | **CRITICAL** | Completed | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | Auth state not cleared on logout | PR #437 |

<!-- CRITICAL PRIORITY - Architecture & Code Quality -->
| BACKLOG-237 | Reduce Transactions.tsx State Complexity (19 useState) | code-quality | Critical | Pending | - | - | ~80K | - | - | - | - | - | - | - | - | - | - | - | - | - | Extract to custom hooks/context | - |
| BACKLOG-238 | Break Down Oversized Flow Hooks | architecture | Critical | Pending | - | - | ~100K | - | - | - | - | - | - | - | - | - | - | - | - | - | useEmailHandlers 382 lines, useAuthFlow 233 lines | - |
| BACKLOG-239 | Reduce Direct Database Access Pattern | architecture | Critical | Pending | - | - | ~120K | - | - | - | - | - | - | - | - | - | - | - | - | - | 45 instances of const db = pattern | - |

<!-- CRITICAL PRIORITY - Operations -->
| BACKLOG-240 | Implement Database Migration Rollback Strategy | operations | Critical | Pending | - | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | No rollback procedures exist | - |
| BACKLOG-241 | Add Startup Health Checks | operations | Critical | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | No pre-flight validation on app start | - |

<!-- HIGH PRIORITY - Reliability -->
| BACKLOG-242 | Add AbortController Support for Long Operations | reliability | High | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | No cancellation support for sync/fetch | - |
| BACKLOG-243 | Fix Fire-and-Forget IPC Event Handlers | reliability | High | Pending | - | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | IPC handlers lack error handling | - |
| BACKLOG-244 | Guarantee Session Cleanup Before State Transitions | reliability | High | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | Session state leaks possible | - |
| BACKLOG-245 | Validate Database Connection State | reliability | High | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | No connection validation before queries | - |
| BACKLOG-246 | Add Component-Level Error Boundaries | reliability | High | Pending | - | - | ~45K | - | - | - | - | - | - | - | - | - | - | - | - | - | Missing granular error boundaries | - |

<!-- HIGH PRIORITY - Security -->
| BACKLOG-247 | Re-enable Sandbox for Preload Script | security | High | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | sandbox: false in webPreferences | - |
| BACKLOG-248 | Fix Environment Variable Exposure in googleAuthService | security | High | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | Credentials may leak to renderer | - |
| BACKLOG-249 | Tighten CSP in Development Mode | security | High | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | CSP too permissive | - |

<!-- HIGH PRIORITY - Architecture -->
| BACKLOG-250 | Reduce Heavy Service Dependency Chains | architecture | High | Pending | - | - | ~80K | - | - | - | - | - | - | - | - | - | - | - | - | - | transactionService imports 13+ services | - |
| BACKLOG-251 | Standardize IPC Handler Error Handling | architecture | High | Pending | - | - | ~70K | - | - | - | - | - | - | - | - | - | - | - | - | - | 165 handlers with inconsistent patterns | - |
| BACKLOG-252 | Decouple LLM Service from Consumers | architecture | High | Pending | - | - | ~55K | - | - | - | - | - | - | - | - | - | - | - | - | - | Tight coupling to LLM implementation | - |
| BACKLOG-253 | Remove Module-Level State Anti-Patterns | architecture | High | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | Global state in hooks causes Strict Mode issues | - |

<!-- HIGH PRIORITY - Code Quality -->
| BACKLOG-254 | Fix Type Safety Issues with any and unsafe unknown | code-quality | High | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | AppleDriverSetup.tsx:43 and others | - |
| BACKLOG-255 | Modularize Large Components (700-827 lines) | code-quality | High | Pending | - | - | ~90K | - | - | - | - | - | - | - | - | - | - | - | - | - | Multiple oversized component files | - |
| BACKLOG-256 | Address TODO/FIXME Comments (15+) | code-quality | High | Pending | - | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | Incomplete features flagged | - |
| BACKLOG-257 | Fix Module-Level Mutable State in useAutoRefresh | code-quality | High | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | Memory leak and state sharing risk | - |

<!-- HIGH PRIORITY - Performance -->
| BACKLOG-258 | Fix N+1 Query in Transaction Details | performance | High | Pending | - | - | ~45K | - | - | - | - | - | - | - | - | - | - | - | - | - | Nested subqueries pattern | - |
| BACKLOG-259 | Fix Memory Leak in useAutoRefresh Event Listeners | performance | High | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | Uncleaned event listeners | - |
| BACKLOG-260 | Implement Virtual Scrolling for Large Lists | performance | High | Pending | - | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | Transaction/message lists need virtualization | - |

<!-- HIGH PRIORITY - Operations -->
| BACKLOG-261 | Unify Logging Architecture | operations | High | Pending | - | - | ~70K | - | - | - | - | - | - | - | - | - | - | - | - | - | 280 structured vs 87 console.log | - |
| BACKLOG-262 | Add Pre-Deployment Validation | operations | High | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | No validation before deploy | - |
| BACKLOG-263 | Add Auto-Updater Metrics and Failure Tracking | operations | High | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | Silent update failures possible | - |

<!-- HIGH PRIORITY - Documentation -->
| BACKLOG-264 | Document LLM Service API | docs | High | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | Complex retry/batch logic undocumented | - |
| BACKLOG-265 | Document Complex Algorithms | docs | High | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | messageMatchingService, autoLinkService | - |

<!-- MEDIUM PRIORITY - Code Quality -->
| BACKLOG-266 | Consolidate Duplicate Utility Functions | code-quality | Medium | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | formatCurrency, formatDate duplicates | - |
| BACKLOG-267 | Standardize Error Handling Patterns | code-quality | Medium | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | Inconsistent error handling across codebase | - |
| BACKLOG-268 | Convert Relative Imports to Path Aliases | code-quality | Medium | Pending | - | - | ~80K | - | - | - | - | - | - | - | - | - | - | - | - | - | 332+ relative import paths | - |

<!-- MEDIUM PRIORITY - Performance -->
| BACKLOG-269 | Add Memoization to Transaction Components | performance | Medium | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | Missing useMemo/useCallback | - |
| BACKLOG-270 | Optimize Conversation Filtering Array Operations | performance | Medium | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | Inefficient array operations | - |
| BACKLOG-271 | Add Indexes for Database LIKE Queries | performance | Medium | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | Unindexed columns in search queries | - |
| BACKLOG-272 | Fix Synchronous JSON Serialization in Hot Paths | performance | Medium | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | Blocking serialization | - |

<!-- MEDIUM PRIORITY - Reliability -->
| BACKLOG-273 | Improve Test Coverage (24% baseline) | reliability | Medium | Pending | - | - | ~100K | - | - | - | - | - | - | - | - | - | - | - | - | - | 21 skipped tests, many uncovered paths | - |
| BACKLOG-274 | Ensure Cleanup on App Termination | reliability | Medium | Pending | - | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | Insufficient cleanup handlers | - |

<!-- MEDIUM PRIORITY - Operations -->
| BACKLOG-275 | Add Structured Logging to Renderer Process | operations | Medium | Pending | - | - | ~45K | - | - | - | - | - | - | - | - | - | - | - | - | - | LogService not used in renderer | - |
| BACKLOG-276 | Implement Error Recovery & Rollback Strategy | operations | Medium | Pending | - | - | ~60K | - | - | - | - | - | - | - | - | - | - | - | - | - | No graceful error recovery | - |
| BACKLOG-277 | Secure CI Logs from Secret Exposure | operations | Medium | Pending | - | - | ~20K | - | - | - | - | - | - | - | - | - | - | - | - | - | Potential credential leaks in CI | - |

<!-- MEDIUM PRIORITY - Documentation -->
| BACKLOG-278 | Improve JSDoc Coverage | docs | Medium | Pending | - | - | ~80K | - | - | - | - | - | - | - | - | - | - | - | - | - | ~2400 comments for 246 files (~10/file) | - |
| BACKLOG-279 | Document IPC Handlers Consistently | docs | Medium | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | Handler documentation inconsistent | - |
| BACKLOG-280 | Document Migration & Version History | docs | Medium | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | No migration documentation | - |
| BACKLOG-281 | Create Documentation Standards | docs | Medium | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | No consistent doc patterns | - |
| BACKLOG-282 | Document Error Handling Patterns | docs | Medium | Pending | - | - | ~30K | - | - | - | - | - | - | - | - | - | - | - | - | - | Error patterns undocumented | - |
| BACKLOG-283 | Document Configuration/Environment Setup | docs | Medium | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | Setup documentation gaps | - |

<!-- LOW PRIORITY - Architecture -->
| BACKLOG-284 | Implement Dependency Injection for Services | architecture | Low | Pending | - | - | ~120K | - | - | - | - | - | - | - | - | - | - | - | - | - | Manual service instantiation | - |
| BACKLOG-285 | Add Data Abstraction Layer for Components | architecture | Low | Pending | - | - | ~100K | - | - | - | - | - | - | - | - | - | - | - | - | - | Direct data access in components | - |

<!-- MEDIUM PRIORITY - UI/UX Architecture -->
| BACKLOG-289 | Unified Notification System | ui-ux | Medium | Completed | SPRINT-040 | - | ~50K | - | - | ~40K | - | - | - | - | - | - | - | - | ~40K | - | PR #439 | - |
| BACKLOG-290 | Reusable Sync Progress Component | ui-ux | Medium | Completed | SPRINT-040 | - | ~40K | - | - | ~45K | - | - | - | - | - | - | - | - | ~45K | - | PR #440 | - |

<!-- LOW PRIORITY - UI/UX -->
| BACKLOG-286 | Unify Chat Card and Group Chat Card Components | ui-ux | Low | Completed | SPRINT-040 | - | ~40K | - | - | ~70K | - | - | - | - | - | - | - | - | ~70K | - | PRs #442,445-448 | - |
| BACKLOG-288 | Simplify Dashboard Button Labels | ui-ux | Low | Completed | SPRINT-040 | - | ~10K | - | - | ~20K | - | - | - | - | - | - | - | - | ~20K | - | PRs #441,443 | - |
| BACKLOG-295 | Transaction Header Responsive Layout | ui-ux | Medium | Completed | SPRINT-040 | - | ~18K | - | - | ~18K | - | - | - | - | - | - | - | - | ~18K | - | PR #449 | - |
| BACKLOG-296 | Database Schema Alignment - Service Updates | tech-debt/data-integrity | High | In Progress | SPRINT-042 | - | ~40K | - | - | - | - | - | - | - | - | - | - | - | - | - | Thread-based communications schema | [BACKLOG-296.md](BACKLOG-296.md) |
| BACKLOG-297 | Startup Error Handling - User-Friendly Failure Screen | ux/error-handling | Medium | Pending | - | - | ~50K | - | - | - | - | - | - | - | - | - | - | - | - | - | Timeout + error screen on init failure | [BACKLOG-297.md](BACKLOG-297.md) |
| BACKLOG-298 | Video Attachment Support in ConversationViewModal | ui-ux | Medium | Pending | - | - | ~35K | - | - | - | - | - | - | - | - | - | - | - | - | - | Videos filtered out, only images displayed | [BACKLOG-298.md](BACKLOG-298.md) |
| BACKLOG-299 | 1:1 Chat Incorrectly Shown as Group Chat | bug/data-quality | Medium | Pending | - | - | ~25K | - | - | - | - | - | - | - | - | - | - | - | - | - | "unknown" participant triggers isGroupChat() | [BACKLOG-299.md](BACKLOG-299.md) |

---

## Status Legend

| Status | Description |
|--------|-------------|
| Pending | Not started |
| In Progress | Actively being worked on |
| Completed | Done and merged |
| Blocked | Waiting on dependency |
| Deferred | Explicitly postponed |
| Obsolete | No longer applicable |

---

## Sprint History

| Sprint ID | Name | Status | Items Completed |
|-----------|------|--------|-----------------|
| SPRINT-001 | Onboarding Refactor | Completed | TASK-101 to TASK-116 |
| SPRINT-002 | Tech Debt | Completed | BACKLOG-058, 059, 060 + 3 bonus fixes |
| SPRINT-003 | Process & Data Integrity | Completed | BACKLOG-072, 038, 039, 035 (4 tasks, 53 turns, ~210K tokens) |
| SPRINT-004 | AI MVP Foundation | Completed | BACKLOG-073, 074 (14 tasks, TASK-301 to TASK-314) |
| SPRINT-005 | AI MVP Core | Completed | BACKLOG-075, 076 (10 tasks, TASK-315 to TASK-324) |
| SPRINT-006 | AI MVP Polish | Completed | BACKLOG-077, 078, 079 (14 tasks, TASK-401 to TASK-414) |
| SPRINT-007 | LLM Cost Optimization | Completed | BACKLOG-084, 085 (12 tasks, TASK-501 to TASK-512) - 97% cost reduction |
| SPRINT-008 | TransactionList Refactoring | Completed | TASK-513 to TASK-521 (9 tasks, 26 turns, ~146K tokens, ~2hrs) |
| SPRINT-009 | Codebase Standards Remediation | Completed | TASK-600 to TASK-620 (20 tasks) - Security + Architecture + Types |
| SPRINT-010 | Core Polish & Text Messages | Completed | BACKLOG-103, 054, 105, 104, 050 (7 tasks: TASK-700 to TASK-706) - PRs #245-255 |
| SPRINT-011 | Testing Infrastructure & Demo | Completed | BACKLOG-108, 014 (5 tasks: TASK-800 to TASK-804) - PRs #256-260 |
| SPRINT-012 | Process & Documentation Improvements | Completed | BACKLOG-126, 124, 127, 128, 129, 130 (6 tasks: TASK-805 to TASK-810, PR #262) |
| SPRINT-013 | Architecture Cleanup | Completed | BACKLOG-107, 109, 110 (3 tasks: TASK-901 to TASK-903, PRs #263-265, 12 turns, ~56K tokens) |
| SPRINT-014 | Feature/Performance | Completed | BACKLOG-032, 090, 091 Phase 1 (9 tasks: TASK-904 to TASK-912, PRs #266-274) |
| SPRINT-015 | Infrastructure Stabilization | Completed | BACKLOG-132, 133, 135, 121, 091 Phase 2 (7 tasks: TASK-913 to TASK-919, PRs #275-281 + hotfix #278) |
| SPRINT-017 | Metrics Workflow Test | Completed | TASK-921 (1 task, PR #283) - Validated auto-captured metrics, found PR template gap |
| SPRINT-018 | Token Accounting | Completed | TASK-922, TASK-923 (2 tasks, PRs #284-285) - Added billable_tokens to metrics |
| SPRINT-019 | Database Gate | Completed | BACKLOG-139, TASK-924 (1 task, PR #286 + 2 hotfixes) - Database init gate + backend fix, ~889K billable tokens |
| SPRINT-020 | State Coordination Foundation | Completed | BACKLOG-142 Phase 1 (7 tasks: TASK-927 to TASK-933, PRs #287-294) - State machine types, reducer, context, orchestrator |
| SPRINT-021 | State Coordination Migration | Completed | BACKLOG-142 Phase 2 (PRs #296-309) - Hook migration to state machine, feature flag enabled |
| SPRINT-022 | State Coordination Cleanup | Completed | BACKLOG-142 Phase 3 (7 tasks: TASK-949-957) - Legacy code removed, architecture documented |
| SPRINT-027 | Messages & Contacts Polish | Completed | 6 tasks (TASK-990 to TASK-995) + 9 unplanned fixes. PRs #354-362. Thread grouping, auto-linking, manual attach/unlink, bubble direction, contact SAVE/LOAD bugs |
| SPRINT-028 | Stability & UX Polish | Completed | 6 tasks (TASK-1003 to TASK-1009) + 7 unplanned fixes. PRs #364-369. npm audit, dashboard scroll, Show in Folder, state machine, T&C, auto-refresh |
| SPRINT-029 | UX Improvements | Planned | TASK-1011, TASK-1012 (Start New Audit redesign, Message attachments) |
| SPRINT-030 | Message & Transaction UX | Planned | TASK-1013-1016 (Date range filter, group chat names, lookback period, attachments) |
| SPRINT-031 | Codebase Health | Planned | 6 tasks (TASK-1017-1022): Service layer tests, any type cleanup, console cleanup |
| SPRINT-032 | Bug Fixes & Stability | Planned | 5 tasks (TASK-1023-1027): Test regressions, auth handler, macOS messages tests, window.api audit |
| SPRINT-033 | iMessage Stability & UX | Completed | 5 tasks (TASK-1028-1032): iMessage encoding fix, UI freeze, contacts pre-pop, auto-link, email/text counts |
| SPRINT-034 | Stability Fixes | Completed | 6 of 7 tasks (TASK-1035-1040): Binary plist, settings scroll, regressions, email state, edit contacts. TASK-1041 blocked |
| SPRINT-035 | Contact & Communication Fixes | Planning | 4 tasks (TASK-1042-1045): Contact save, unlink refresh, attachments stale ID, email banner |
| SPRINT-036 | Deterministic Message Parsing | Completed | 6 of 7 tasks (TASK-1046-1051): Format detection, parser refactors, thread ID, test suite. TASK-1052 pending |
| SPRINT-037 | Test Coverage | Completed | 3 tasks (TASK-1053-1055): databaseService mocking fix (PR #428), critical path tests (PR #429), CI coverage thresholds (PR #429). 20 iosMessagesParser tests still failing (BACKLOG-231) |
| SPRINT-040 | UI Design System | Completed | 9 tasks (TASK-1100-1108) + 2 hotfixes: SyncProgress component (PR #440), Notification system (PR #439), Dashboard labels (PRs #441,443), Chat card unification (PRs #442,445-448), Transaction header responsive (PR #449) |
| SPRINT-041 | Bug Fixes | Completed | 5 tasks (TASK-1109-1113): Unlink UI refresh (PR #450), Duplicate sync (PR #451), Contact save (PR #452), Attachments stale ID (PR #453), UI freeze modal (PR #454). **Note:** BACKLOG-220 fix insufficient - reopened for SPRINT-042 |
| SPRINT-042 | Database Schema Alignment | Planning | 3 tasks (TASK-1114-1116): Thread-based communications schema, service updates, unlink UI integration. Includes BACKLOG-220 (reopened), BACKLOG-296 |

---

## Changelog

- 2024-12-15: Created index, added BACKLOG-058 to 070
- 2024-12-15: Assigned BACKLOG-058, 059, 060 to SPRINT-002
- 2025-12-16: SPRINT-002 completed - marked BACKLOG-058, 059, 060 as complete
- 2025-12-16: Added sprint review document (SPRINT-002-tech-debt-review.md)
- 2025-12-16: PRs merged: #134 (tests), #135 (email bugs), #136 (Windows login), #137 (db split), #138 (native modules)
- 2025-12-16: Added BACKLOG-072 (Workflow Enforcement) - Critical priority from SPRINT-002 audit
- 2025-12-16: Created SPRINT-003 (Process & Data Integrity) - assigned BACKLOG-072, 038, 039, 035
- 2025-12-16: Added AI MVP backlog items (BACKLOG-073 through BACKLOG-079) - 7 phases across 3 sprints
- 2025-12-16: Marked BACKLOG-066 as Obsolete (covered by AI MVP project)
- 2025-12-16: SR Engineer + PM reviewed AI MVP plan - 40% schema reduction due to existing implementations
- 2025-12-16: Planned SPRINT-004 (AI Foundation), SPRINT-005 (AI Core), SPRINT-006 (AI Polish)
- 2025-12-16: Created SPRINT-004 plan and 14 task files (TASK-301 to TASK-314) for BACKLOG-073, BACKLOG-074
- 2025-12-17: BACKLOG-072 (TASK-201) completed - Workflow Enforcement (PR #139 merged)
- 2025-12-17: SPRINT-003 completed - All 4 tasks merged (PRs #139, #140, #141, #142)
- 2025-12-17: BACKLOG-038 (TASK-202) completed - Contacts display_name (PR #141 merged)
- 2025-12-17: BACKLOG-039 (TASK-203) completed - Transaction status (PR #140 merged)
- 2025-12-17: BACKLOG-035 (TASK-204) completed - Orphaned tables + closing_date fix (PR #142 merged)
- 2025-12-17: *INCIDENT*: Parallel agent execution burned ~14M tokens before manual intervention
- 2025-12-20: BACKLOG-044 (Multiple Contacts Per Role) marked complete - already implemented in UI + backend
- 2025-12-20: BACKLOG-045 (Block Contact Deletion) marked complete - getTransactionsByContact + tests exist
- 2025-12-17: Lesson learned: Database schema tasks must be SEQUENTIAL, never parallel
- 2025-12-17: Added Category column and Variance tracking to INDEX.md for estimation accuracy analysis
- 2025-12-18: SPRINT-004 completed - All 14 tasks merged (TASK-301 to TASK-314)
- 2025-12-18: SPRINT-005 completed - All 10 tasks merged to develop (PR #169)
- 2025-12-18: BACKLOG-075, 076 marked complete (AI Analysis Tools + Hybrid Pipeline)
- 2025-12-18: Created SPRINT-006 plan for AI MVP Polish (BACKLOG-077, 078, 079)
- 2025-12-18: Created 14 task files (TASK-401 to TASK-414) for SPRINT-006
- 2025-12-18: Integration branch strategy: int/ai-polish for SPRINT-006
- 2025-12-19: SPRINT-006 completed - All 14 tasks merged (PRs #170-183), int/ai-polish merged to develop
- 2025-12-19: BACKLOG-077, 078, 079 marked complete (AI MVP Polish complete)
- 2025-12-19: Added BACKLOG-084, 085, 086, 087, 088 (Cost Optimization + ML + UX)
- 2025-12-20: SPRINT-007 completed - All 12 tasks merged (PRs #185-197), 97% LLM cost reduction achieved
- 2025-12-20: BACKLOG-084, 085 marked complete (Thread-based detection + validation)
- 2025-12-24: Created SPRINT-008 (TransactionList Refactoring) - 8 tasks (TASK-513 to TASK-520)
- 2025-12-24: SPRINT-008 targets: Toast fix, component extraction (3), hook extraction (3), directory structure
- 2025-12-24: Estimates: 39-54 turns, ~186K tokens, 5-7 hours total
- 2025-12-24: TASK-513 (Toast Fix) completed - PR #200 merged, 2 turns, ~16K tokens, 20m
- 2025-12-24: TASK-514 (Extract TransactionStatusWrapper) completed - PR #201 merged, 4 turns, ~16K tokens, 12m
- 2025-12-24: TASK-515 (Extract TransactionCard) completed - PR #202 merged, 1 turn, ~12K tokens, 7m
- 2025-12-24: TASK-516 (Extract TransactionToolbar) completed - PR #203 merged, 5 turns, ~20K tokens, 23m
- 2025-12-24: Phase 3 (Component Extraction) complete - TransactionList reduced to ~625 lines
- 2025-12-24: TASK-517 (Extract useTransactionList hook) completed - PR #204 merged, 4 turns, ~26K tokens, 12m
- 2025-12-24: TASK-518 (Extract useTransactionScan hook) completed - PR #205 merged, 5 turns, ~24K tokens, 20m
- 2025-12-24: TASK-519 (Extract useBulkActions hook) completed - PR #206 merged, 4 turns, ~24K tokens, 15m
- 2025-12-24: Phase 4 (Hook Extraction) complete - TransactionList reduced to ~431 lines
- 2025-12-24: TASK-520 (Directory structure) completed - PR #207 merged, 1 turn, ~8K tokens, 15m
- 2025-12-24: **SPRINT-008 COMPLETE** - TransactionList: 1,357 to 431 lines (-68%), 9 files extracted
- 2025-12-24: TASK-521 (Expand bulk status to all 4 statuses) completed - PR #208 merged, 2 turns, ~12K tokens, 7m
- 2025-12-24: Created SPRINT-009 (Codebase Standards Remediation) - 18 tasks (TASK-600 to TASK-617)
- 2025-12-24: SPRINT-009 based on SR Engineer codebase audit: 2 CRITICAL (security), 8 HIGH (architecture), 4 MEDIUM (types), 4 LOW (cleanup)
- 2025-12-24: SPRINT-009 targets: main.ts <500 lines, preload.ts <400 lines, Transactions.tsx <600 lines, 114 any types to <10
- 2025-12-28: SPRINT-009 completed - All 20 tasks merged (PRs #212-239)
- 2025-12-28: Security hardening complete, architecture violations fixed, type safety improved
- 2025-12-27: Added BACKLOG-092 through BACKLOG-102 (component organization and refactoring items)
- 2025-12-27: INDEX.md major update - corrected sprint statuses, archived completed task files
- 2025-12-27: BACKLOG-061, 062, 063, 065 marked complete (addressed by SPRINT-009)
- 2025-12-27: Task files archived: SPRINT-006 (14), SPRINT-007 (12), SPRINT-009 (21)
- 2025-12-28: Created SPRINT-010 (Core Polish & Text Messages) - 6 tasks (TASK-700 to TASK-705)
- 2025-12-28: Added BACKLOG-103 (Contact Selection Fix), BACKLOG-104 (Dashboard AI Display), BACKLOG-105 (Text Messages Tab)
- 2025-12-28: SPRINT-010 covers: bug fix, HTML email rendering, text messages feature, dashboard enhancement
- 2025-12-28: Added BACKLOG-107 through BACKLOG-115 (9 items from SR Engineer findings for SPRINT-012+)
- 2025-12-28: New items: 2 CRITICAL (useAppStateMachine split, flaky test), 3 HIGH (AppRouter, AppShell, service migration), 4 MEDIUM (test coverage, any types)
- 2025-12-28: Added BACKLOG-116 (Google Login Feature Parity) - Medium priority, from SR Engineer review of PR #242
- 2025-12-28: Added BACKLOG-117 (Sprint 009 Auth Regressions) - Critical priority, preload sandbox + Google login flow regression
- 2025-12-28: Added BACKLOG-118 (OnboardingFlow Hooks Bug) - High priority, React hooks order violation fixed
- 2025-12-28: BACKLOG-118 completed - useCallback moved before early return to fix hooks order
- 2025-12-28: Created TASK-900 for BACKLOG-117 implementation
- 2025-12-28: BACKLOG-117 completed - PR #242 merged (preload sandbox + Google login + timeout protection)
- 2025-12-28: CI workflow fix - fetch base branch for PR comparison
- 2025-12-28: Added BACKLOG-119 (OAuth Handler Parity Audit) - Low priority, prevents future Google/Microsoft handler drift
- 2025-12-30: Added BACKLOG-120 (CI Testing Infrastructure Gaps) - Medium priority, tracks testing gaps from TASK-704 CI debugging
- 2025-12-31: TASK-804 (BACKLOG-108) completed - Fix flaky appleDriverService test (PR #256 merged)
- 2025-12-31: TASK-800 types completed - Email fixture types (PR #257 merged)
- 2025-12-31: TASK-803 (BACKLOG-014) completed - Joyride demo update for AI detection (PR #258 merged)
- 2025-12-31: TASK-801 fixtures completed - 203 messages, 52 contacts, iOS backup services (PR #259 merged)
- 2025-12-31: TASK-802 completed - Integration testing framework with sandbox and mock providers (PR #260 merged)
- 2025-12-31: **SPRINT-011 COMPLETE** - All 5 tasks merged (PRs #256-260), testing infrastructure established
- 2026-01-01: Added BACKLOG-121 (Generator Approach Guidance) - High priority, from SPRINT-011 retrospective (32K token limit lesson)
- 2026-01-01: Added BACKLOG-122 (Engineer Worktree Instructions) - Medium priority, from SPRINT-011 retrospective (worktree confusion)
- 2026-01-01: Added BACKLOG-123 (Test Category Estimation Multiplier) - Low priority, from SPRINT-011 retrospective (-28% avg variance)
- 2026-01-01: BACKLOG-122 completed - Engineer worktree instructions added to engineer.md and git-branching.md (2 turns, ~8K tokens)
- 2026-01-01: **SPRINT-010 retroactive update** - All 7 tasks were merged 2025-12-29 but sprint file was never updated. Fixed sprint file, marked BACKLOG-054, 103, 104, 105 as Completed.
- 2026-01-01: Added BACKLOG-124 (Sprint Completion Checklist) - Medium priority, from SPRINT-010 retrospective (stale sprint file)
- 2026-01-01: Added BACKLOG-125 (Enforce Metrics Collection) - Low priority, from SPRINT-010 retrospective (missing metrics)
- 2026-01-01: Added BACKLOG-127, 128, 129 from SPRINT-010/011 retro action items (sprint capacity, type verification, CI troubleshooting)
- 2026-01-01: Updated BACKLOG-126 title to "Enforce Debugging Metrics with Commit Verification" (refined SOP)
- 2026-01-01: Added BACKLOG-126 (Incident/Blocker Tracking) - **High priority**, from TASK-704 CI incident (22h undocumented debugging)
- 2026-01-01: Added TASK-704 to variance breakdown - actual ~24 turns vs estimated 10-14 (+100% variance due to CI incident)
- 2026-01-01: Updated SPRINT-010 with "Major Incident" section documenting the 22-hour CI debugging
- 2026-01-01: Created SPRINT-012 (Process & Documentation Improvements) - 5 tasks (TASK-805 to TASK-809)
- 2026-01-01: Assigned BACKLOG-126, 124, 127, 128, 129 to SPRINT-012 (all docs category from retrospectives)
- 2026-01-01: **INCIDENT** BACKLOG-130 created - Sub-agent permission auto-denial burned ~9.6M tokens across 5 parallel engineer agents
- 2026-01-01: Lesson learned: Background agents cannot prompt for Write/Edit permissions - need pre-approval or foreground execution
- 2026-01-02: Added BACKLOG-131 (PR Metrics Validation Shell Escaping Bug) - Medium priority, CI workflow bug discovered during SPRINT-012 PR #262
- 2026-01-02: **SPRINT-012 COMPLETE** - All 6 tasks merged (PR #262): BACKLOG-124, 126, 127, 128, 129, 130 marked complete
- 2026-01-02: Lesson learned: Permission pre-approval via settings.json `permissions.allow` prevents background agent blocks
- 2026-01-02: **SPRINT-013 COMPLETE** - Architecture Cleanup: 3 tasks merged (PRs #263-265), BACKLOG-107, 109, 110 marked complete
- 2026-01-02: useAppStateMachine split: 1130→422 lines + 8 flow hooks, AppRouter: 359→229 lines, AppShell: 190→110 lines
- 2026-01-02: Sprint-013 efficiency: 12 turns (est 22-30), -57% variance - refactor tasks continue to be overestimated
- 2026-01-02: Created SPRINT-014 (Feature/Performance) - 9 tasks (TASK-904 to TASK-912)
- 2026-01-02: SPRINT-014 scope: BACKLOG-032 (full), BACKLOG-090 (full), BACKLOG-091 (Phase 1 only - schema + Gmail Message-ID)
- 2026-01-02: BACKLOG-091 Phase 2 (Outlook + content hash + full dedup) deferred to SPRINT-015
- 2026-01-02: **SPRINT-014 COMPLETE** - All 9 tasks merged (PRs #266-274): Sync status service, dedup schema, incremental sync (Gmail/Outlook/iPhone), Message-ID extraction, sync lock UI, LLM filter, integration tests
- 2026-01-02: BACKLOG-032 (Handle Backup in Progress), 090 (Incremental Sync), 091 Phase 1 (Gmail Message-ID) marked complete
- 2026-01-02: Added BACKLOG-135 (window.d.ts Type Definitions) - Medium priority, from TASK-910 token overrun (~6M tokens due to type debugging)
- 2026-01-02: **SPRINT-014 RETROSPECTIVE** completed - identified 3 major incidents:
  - Incident 1: Parallel agent race condition (TASK-906+908) consumed ~18M tokens (BACKLOG-132)
  - Incident 2: window.d.ts type gaps (TASK-910) consumed ~6M tokens (BACKLOG-135)
  - Incident 3: LLM filter debugging (TASK-911) consumed ~2.5M tokens
- 2026-01-02: **Token efficiency for SPRINT-014:** ~0.4% of tokens produced mergeable work
- 2026-01-02: Service category now has data: 5 tasks, -45% avg variance (suggested multiplier: 0.55x)
- 2026-01-02: BACKLOG-132 (Mandatory Worktree Enforcement) completed - TASK-913, PR #274 merged (3 turns, ~23K tokens, 10m)
- 2026-01-02: Updated BACKLOG-132 variance to +360% (total tokens vs impl-only estimate); added SR Review Overhead table to PM Estimation Guidelines
- 2026-01-02: Added data quality warning to Estimation Accuracy Analysis; marked all tasks with ✓/⚠️/❌ for complete/incomplete/incident metrics; only 8 of 30 tasks have complete lifecycle data
- 2026-01-02: **SPRINT-015 COMPLETE** - Infrastructure Stabilization (7 tasks: TASK-913 to TASK-919, PRs #275-281 + hotfix #278)
  - BACKLOG-132 (Worktree Enforcement), 133 (Token Cap), 135 (window.d.ts), 121 (Generator Docs) marked complete
  - BACKLOG-091 Phase 2 complete (TASK-917 Outlook Message-ID, TASK-918 Content Hash, TASK-919 Duplicate Linking)
  - Hotfix #278: Database init gate bug discovered and fixed during sprint
  - BACKLOG-136: PM Token Monitoring workflow added mid-sprint
- 2026-01-02: Key incident: TASK-914/915 consumed ~100x estimated tokens (~1.6-2.2M vs ~15-18K)
- 2026-01-02: Phase 3 (email dedup) completed efficiently: 9 turns, ~40K tokens (vs estimated 12-17 turns, ~58K tokens)
- 2026-01-02: Service category adjustment confirmed at 0.50x (TASK-917/918/919 avg -31% variance)
- 2026-01-02: SPRINT-016 (Component Refactoring) plan created and ready to start
- 2026-01-03: **BACKLOG-137 COMPLETE** - Automatic Token Tracking Tooling implemented:
  - SubagentStop hook captures actual tokens from engineer agent transcripts
  - Metrics persisted to `.claude/metrics/tokens.jsonl`
  - Task file template updated with "Actual Tokens (Auto-Captured)" section
  - PM Estimation Guidelines updated to reference automatic tracking
  - Self-reported vs actual variance can now be measured objectively
- 2026-01-03: **METRICS FORMAT ALIGNMENT** - Templates aligned with auto-captured data:
  - Hook updated to capture duration (start/end timestamps)
  - Task template simplified: removed self-reported Turns/Time, uses auto-captured Tokens/Duration/API Calls
  - INDEX.md table columns preserved for historical data, new tasks use simplified format
  - PM estimates now in tokens only (no turns/time)
  - Engineers MUST record agent_id immediately when Task tool returns
- 2026-01-03: Added BACKLOG-138 (Turns/Metrics Cleanup) - Remove remaining ~600+ "turns" references from active docs
- 2026-01-03: **BACKLOG-138 COMPLETE** - PR #282 merged:
  - Updated 14 documentation files to auto-captured format
  - Updated `.github/workflows/pr-metrics-check.yml` for new validation
  - Updated `.github/PULL_REQUEST_TEMPLATE.md` with Agent ID format
  - CI now validates for Agent ID + `| Metric | Value |` table
- 2026-01-03: **SPRINT-017 COMPLETE** - Metrics Workflow Test:
  - TASK-921: Fixed duplicate buttons on SecureStorageStep (PR #283)
  - Validated SubagentStop hook captures metrics to tokens.jsonl
  - Found gap: Engineer used legacy PR format instead of template
  - Fixed: Updated engineer.md to require PR template usage
  - Auto-captured metrics: Engineer ~1M tokens (892K cache), 174 sec, 31 API calls
- 2026-01-03: **SPRINT-018 COMPLETE** - Token Accounting Clarity:
  - TASK-922: Added billable_tokens to SubagentStop hook (PR #284)
  - TASK-923: Updated metrics documentation (PR #285)
  - Sprint Billable Tokens: 254K (Engineer: 116K, SR: 137K)
  - Key insight: Total tokens (3.5M) vs Billable (254K) - cache reads are 93%
- 2026-01-03: Added BACKLOG-139 (Database Init Gate) - Critical fix for recurring bug:
  - "Database is not initialized" error fixed piecemeal 4+ times, still recurring
  - Root cause: Navigation guards routing but modals bypass it
  - Fix: App-level gate blocking UI until database is ready
  - SPRINT-019 created with TASK-924
- 2026-01-03: **SPRINT-019 COMPLETE** - Database Initialization Gate:
  - TASK-924 (PR #286): Frontend gates in AppShell + AppModals + components
  - Hotfix #1 (commit 3a47484): Sync isDatabaseInitialized with isAuthenticated
  - Hotfix #2 (commit 6dafd7b): Share databaseService connection with dbConnection module (real fix)
  - Root cause discovered: Two separate database systems (databaseService vs dbConnection) not connected
  - Sprint billable tokens: ~889K (including investigation + 2 hotfixes)
  - Variance: +2122% (PM Est ~40K vs Actual ~889K - complex debugging required)
- 2026-01-03: Added BACKLOG-140 (Duplicate Transaction Re-Import Prevention) - High priority
- 2026-01-03: Added BACKLOG-141 (Onboarding Flicker Quick Fix) - Medium priority, will be superseded by BACKLOG-142
- 2026-01-03: **Created BACKLOG-142 (State Coordination Overhaul)** - Critical, multi-phase initiative:
  - Root cause: Fragmented hook-based state coordination causes recurring race conditions
  - Issues addressed: Database init errors (fixed 4+ times), onboarding flicker, navigation loops
  - Solution: Unified state machine with single source of truth
  - Phases: Foundation (SPRINT-020), Migration (SPRINT-021), Cleanup (SPRINT-022)
  - SPRINT-020 created with 7 tasks (TASK-927 to TASK-933), ~295K tokens estimated
  - Risk register created with 4 active risks
- 2026-01-03: **SPRINT-020 COMPLETE** - State Coordination Foundation (7 tasks: TASK-927 to TASK-933, PRs #287-294)
  - All 7 tasks merged to project/state-coordination branch
  - Unified state machine with discriminated union types implemented
  - Feature flag defaults to false for safe rollout
  - 49 total tests (32 integration + 17 platform)
  - Sprint billable tokens: ~260K (vs ~295K estimated)
- 2026-01-03: Added BACKLOG-143 (Prevent Duplicate Contact Imports) - Medium priority:
  - User-reported issue: contacts can be imported multiple times
  - Solution options: filter import list, show post-import summary, or hybrid approach
  - Related to contact management UX
- 2026-01-04: **BACKLOG-142 (State Coordination Overhaul) COMPLETE**
  - SPRINT-022 (Phase 3 - Cleanup) completed
  - Legacy hook code paths removed (TASK-952)
  - State machine is now the only code path
  - Architecture documentation added: `.claude/docs/shared/state-machine-architecture.md`
  - Total project span: 3 sprints (SPRINT-020, 021, 022)
- 2026-01-04: **Added BACKLOG-148 to BACKLOG-152** from SR Engineer architecture review:
  - BACKLOG-148 (HIGH): Split databaseService.ts (3,877 lines) into domain-specific services
    - Note: BACKLOG-058 addressed this in SPRINT-002 but file has regrown
  - BACKLOG-149 (MEDIUM): Delete deprecated EmailOnboardingScreen.tsx (1,203 lines)
    - File marked @deprecated, migration to EmailConnectStep.tsx should be complete
  - BACKLOG-150 (LOW): Reduce useAppStateMachine.ts (432 lines, 32 over 400 trigger)
    - Maintenance-level after BACKLOG-107/SPRINT-013 major reduction
  - BACKLOG-151 (LOW): Reduce AppModals.tsx (169 lines, 19 over 150 trigger)
    - Extract iPhone Sync modal wrapper
  - BACKLOG-152 (MEDIUM): Split TransactionDetails.tsx (832 lines) into tab components
    - Also addresses direct window.api calls (architecture violation)
  - Note: BACKLOG-098 (Split AuditTransactionModal.tsx) already exists for that item
- 2026-01-04: **SPRINT-023 (Architecture Debt Reduction) PLANNED**
  - SPRINT-016 marked DEPRECATED (task IDs TASK-920-926 collided with SPRINT-017/18/19)
  - Created 5 tasks (TASK-960 to TASK-964):
    - TASK-960: Delete deprecated EmailOnboardingScreen.tsx (BACKLOG-149)
    - TASK-961: Split databaseService.ts - Analysis & Core (BACKLOG-148 Phase 1)
    - TASK-962: Split databaseService.ts - Domain Services (BACKLOG-148 Phase 2)
    - TASK-963: Split TransactionDetails.tsx (BACKLOG-152)
    - TASK-964: Duplicate Transaction Re-Import Prevention (BACKLOG-140)
  - Total estimated: ~130K tokens
  - Status: Pending SR Engineer Review
- 2026-01-04: **Backlog Audit & Status Reconciliation**
  - Fixed BACKLOG-124, 126, 127, 128, 129, 130 status: Pending -> Completed (SPRINT-012 items)
  - Fixed BACKLOG-142 in Quick Filters: marked as done (state coordination overhaul complete)
  - Updated Quick Filters to show all completed items: 061, 062, 063, 103, 105, 118, 050, 054, 065, 104
  - Added BACKLOG-155 (Dashboard Scroll) to Full Index - file existed but was not indexed
  - Corrected header counts: Total 143 (was 161), Pending 86 (was 81), Completed 54 (was 70), Obsolete 1 (was 2)
  - The previous counts were incorrect due to:
    1. SPRINT-012 items marked "(done)" in sprint section but "Pending" in Full Index
    2. Total count included phantom backlog IDs that don't exist (080, 082, 083, 106, 131, 134, 144-147)
    3. Completed count understated items marked complete in sprints
    4. BACKLOG-155 file existed but was never added to INDEX.md
- 2026-01-04: Added BACKLOG-156 (Auto-Refresh Data Sources on App Load) - High priority
  - Auto-sync emails (both platforms), texts (Mac), contacts (Mac) on app startup
  - Eliminates need to click "Auto Detect" manually
  - Related to BACKLOG-024 (Auto-Start Sync) - consider merging or marking duplicate
  - Est. ~40K tokens
- 2026-01-04: **SPRINT-024 Planned (Quality & Coverage)**
  - Created SPRINT-024-quality-and-coverage.md
  - Added BACKLOG-157: Fix Failing Auth Handler Test (High, ~15K tokens)
  - Added BACKLOG-158: Decompose AuditTransactionModal (Medium, ~60K tokens)
  - Added BACKLOG-159: Delete Deprecated PermissionsScreen (Medium, ~10K tokens)
  - Created 5 tasks: TASK-970 to TASK-974
  - Marked BACKLOG-152 as Completed (SPRINT-023)
  - Sprint focus: test coverage (29% → 45%+), component decomposition
  - Total estimated: ~215K tokens
- 2026-01-05: **Retroactive Documentation for PR #353 (Contact-First AttachMessagesModal)**
  - Created BACKLOG-173: Contact-First AttachMessagesModal Interface (Completed, ~40K tokens)
  - Created TASK-989: Retroactive task file for the feature work
  - Related items already documented:
    - BACKLOG-170: Messages Not Loading in Attach Modal (investigation that led to this)
    - BACKLOG-172: macOS Messages Import (future feature discovered during investigation)
    - TASK-985, TASK-986: Related investigation/feature tasks
  - Key changes in PR #353:
    - Fixed UI freeze when loading 579k+ messages (added LIMIT to query)
    - Implemented contact-first interface (two-view: contacts list -> thread selection)
    - Added new database methods: getMessageContacts(), getMessagesByContact(), getUnlinkedEmails()
    - Added contact name resolution from macOS Contacts database
    - Enhanced thread cards to show participants and date ranges
    - Updated terminology from "messages" to "chats"
  - Also added BACKLOG-168 to BACKLOG-172 to Full Index (were missing)
- 2026-01-05: **SPRINT-027 (Messages & Contacts Polish) Created**
  - Based on feature/contact-first-attach-messages branch (PR #353)
  - Created 3 tasks: TASK-990, TASK-991, TASK-992
  - Added BACKLOG-178, BACKLOG-179, BACKLOG-180 to Full Index
  - Sprint deliverables:
    - TASK-990: Fix auto-linked messages not appearing in Messages tab
    - TASK-991: Complete manual thread attach/unlink functionality
    - TASK-992: Fix message bubble direction (outgoing on right, incoming on left)
  - Total estimated: ~60K tokens (+ ~30K SR review overhead)
- 2026-01-09: **SPRINT-027 (Messages & Contacts Polish) COMPLETE**
  - All 6 planned tasks completed: TASK-990 to TASK-995
  - PRs merged: #354 (thread grouping), #355 (contacts SAVE), #356 (bubble direction), #357 (contacts LOAD), #358 (auto-linked messages), #359 (manual threads)
  - Additional polish PRs: #360 (contact names), #361 (attached messages display), #362 (thread grouping final)
  - Unplanned fixes completed (9 items):
    - Fixed permissions step bug (type mismatch for checkAllPermissions)
    - Fixed duplicate import bug (added singleton guard)
    - Implemented dual progress bars for contacts/messages import
    - Fixed text messages appearing in Related Emails section
    - Made message threads collapsed by default with View/Hide toggle
    - Fixed contact import to store ALL phones and emails (not just first)
  - feature/contact-first-attach-messages merged to develop (PR #353)
  - Total actual: ~249K tokens (vs ~177K estimated, +41% variance from unplanned work)
  - BACKLOG-178, 179, 180 marked complete
  - Added BACKLOG-181: Streamline Terms and Conditions Onboarding Step
- 2026-01-09: **Retroactive Documentation - Permissions Step Bugs (SPRINT-027)**
  - Created BACKLOG-182: getCurrentUser() Returns False After Login (High, Completed)
    - Root cause: Session-only OAuth design, getCurrentUser() looks for file-based session
    - Fix: Pass userId through onboarding context from app.currentUser.id
  - Created BACKLOG-183: Mixed UI During Import - Instructions With Progress (Medium, Completed)
    - Root cause: No early return when import view should show
    - Fix: Dedicated import view with early return pattern
  - Created BACKLOG-184: Contacts Import Failing (1000 Limit) (High, Completed)
    - Root cause: Hardcoded limit of 1000 contacts
    - Fix: Increased limit from 1000 to 5000
  - Created BACKLOG-185: Import Stuck at 100% on Progress Bar (Medium, Completed)
    - Root cause: Promise.all waiting for both messages AND contacts
    - Fix: Only wait for messages; contacts continue in background
  - Created BACKLOG-186: Continue Button Not Working After Import (Critical, Completed)
    - Root cause: goToStep("dashboard") is no-op when state machine enabled
    - Fix: Added stateMachineDispatch to usePermissionsFlow, dispatch ONBOARDING_STEP_COMPLETE
  - All 5 fixes committed directly to fix/messages-display-issues branch during SPRINT-027
- 2026-01-10: **SPRINT-028 (Stability & UX Polish) COMPLETE**
  - 6 planned tasks completed (TASK-1003 to TASK-1009):
    - TASK-1005: npm audit fix (PR #364)
    - TASK-1004: Dashboard scroll fix (PR #365, BACKLOG-155)
    - TASK-1008: Show in Folder button (PR #366, BACKLOG-169)
    - TASK-1006: State machine reduce (PR #367, BACKLOG-150)
    - TASK-1009: T&C streamline (PR #368, BACKLOG-181)
    - TASK-1003: Auto-refresh on load (PR #369, BACKLOG-156)
  - 7 unplanned fixes committed directly to develop:
    - Message parser fix (truncated text extraction)
    - Auto-refresh once per session (not every dashboard visit)
    - Settings reorder (coming soon items to bottom)
    - Sync status priority fix (show progress-based status first)
    - Sync status UI (show all 3 types with progress bars)
    - Compact sync status UI (horizontal layout)
    - Clickable export file path
  - Backlog items marked complete: BACKLOG-150, 155, 156, 169, 181
  - Total estimated: ~140K tokens (planned) + ~29K (unplanned) = ~169K tokens
- 2026-01-10: **SPRINT-029 (UX Improvements) Ready**
  - 2 tasks planned: TASK-1011 (Start New Audit redesign), TASK-1012 (Message attachments)
  - Backlog items: BACKLOG-174, BACKLOG-187
  - Total estimated: ~106K tokens
- 2026-01-10: **Codebase Health Review - New Backlog Items Created**
  - Created 8 new backlog items (BACKLOG-191 to BACKLOG-198) from SR Engineer codebase health review
  - **Critical:** BACKLOG-191 (Service layer test coverage - 0% on 781 lines)
  - **High:** BACKLOG-193 (databaseService.ts refactor - 1,223 lines)
  - **Medium:** BACKLOG-192 (Console cleanup), BACKLOG-194 (Context tests), BACKLOG-195 (Hook tests)
  - **Low:** BACKLOG-196 (Settings TODOs), BACKLOG-197 (Stricter TS rules), BACKLOG-198 (Component decomposition)
  - Pre-existing BACKLOG-115 (any types) also identified for partial completion
- 2026-01-10: **SPRINT-031 (Codebase Health) Created**
  - 6 tasks planned: TASK-1017 to TASK-1022
  - Focus: Service layer tests (4 tasks), any type cleanup (1 task), console cleanup (1 task)
  - Backlog items: BACKLOG-191 (Critical), BACKLOG-115 (partial), BACKLOG-192 (partial)
  - Total estimated: ~220K tokens (including SR review overhead + buffer)
  - Phase 1: Sequential service tests (establish mock pattern)
  - Phase 2: Parallel cleanup tasks (no file conflicts)
- 2026-01-14: **Comprehensive Backlog Index Update**
  - Added BACKLOG-227 through BACKLOG-230 (new items from SPRINT-035/036 testing):
    - BACKLOG-227: Show iMessage attachments in Attachments tab (Medium)
    - BACKLOG-228: UI freeze when viewing messages to attach (High) - BACKLOG-173 regression
    - BACKLOG-229: Binary plist garbage text still appearing (CRITICAL) - TASK-1035 incomplete
    - BACKLOG-230: NULL thread_id investigation (Medium, Complete) - macOS orphaned messages
  - Added missing items BACKLOG-205 through BACKLOG-213 to Full Index:
    - BACKLOG-205: Flaky useAutoRefresh timer tests (Low)
    - BACKLOG-206-210: SPRINT-033 items (now marked Completed)
    - BACKLOG-211-213: SPRINT-034 items (now marked Completed)
  - Added missing items BACKLOG-225 and BACKLOG-226 to Full Index:
    - BACKLOG-225: Video attachment support (Low)
    - BACKLOG-226: URL preview formatting (Low)
  - Updated status for SPRINT-033 completions: BACKLOG-206, 207, 208, 209, 210
  - Updated status for SPRINT-034 completions: BACKLOG-211, 212, 213, 214, 215, 216, 217
  - Marked BACKLOG-218 as Blocked (pending user requirements)
  - Marked BACKLOG-230 as Completed (analysis complete, macOS data issue)
  - Added SPRINT-033, 034, 035, 036 to Sprint History
  - Total items: 210 (from 195), Completed: 103 (from 75)
- 2026-01-14: **Identified Potential Duplicates/Consolidations**
  - BACKLOG-228 (UI freeze attach messages) may be regression of BACKLOG-173 (contact-first interface)
  - BACKLOG-229 (garbage text) is follow-up to SPRINT-036 work
  - BACKLOG-206 (UI freeze sync) vs BACKLOG-228 (UI freeze attach) - different features, not duplicates
  - BACKLOG-215 (encoding corruption) and BACKLOG-229 (garbage text) - related but different root causes
- 2026-01-15: **SPRINT-037 (Test Coverage) COMPLETE**
  - 3 tasks completed: TASK-1053, TASK-1054, TASK-1055
  - PRs merged: #428 (databaseService native module mocking fix), #429 (critical path tests + CI coverage thresholds)
  - BACKLOG-202 (databaseService test mocking) marked Completed
  - **Known Issue:** 20 tests still failing in `iosMessagesParser.test.ts` - mock database setup issues
  - Created BACKLOG-231 to track iosMessagesParser test failures
  - Total items: 211, Completed: 105
- 2026-01-15: **High Priority Items for Next Sprint**
  - **CRITICAL:** BACKLOG-229 (binary plist garbage text still appearing)
  - **CRITICAL:** BACKLOG-191 (service layer tests - 0% coverage on 781 lines)
  - **HIGH:** BACKLOG-228 (UI freeze when viewing messages to attach)
  - **HIGH:** BACKLOG-220-222 (contact/communication UI bugs)
  - **MEDIUM:** BACKLOG-231 (iosMessagesParser test failures - 20 tests)
- 2026-01-15: **Codebase Audit Findings Consolidated (7 SR Engineer Audits)**
  - Added 54 new backlog items (BACKLOG-232 through BACKLOG-285)
  - **Audit Categories:** Code Quality, Architecture, Reliability, Security, Operations, Performance, Documentation
  - **Critical (10 items):** Security vulnerabilities (webSecurity, jsdiff DoS, PII masking), reliability gaps (unhandled rejections, race conditions), architecture debt (state complexity, oversized hooks, direct db access), operations gaps (migration rollback, startup health)
  - **High (24 items):** AbortController support, IPC error handling, session cleanup, error boundaries, preload sandbox, service decoupling, type safety, component modularization, N+1 queries, memory leaks, logging unification, API documentation
  - **Medium (18 items):** Utility consolidation, error patterns, path aliases, memoization, test coverage, structured logging, JSDoc coverage
  - **Low (2 items):** Dependency injection, data abstraction layer
  - **Total Estimated Tokens:** ~2.6M tokens for all audit remediation work
  - **Sprint Planning Note:** Security/Critical items should be prioritized in upcoming sprints
  - Total items: 265, Pending: 148
- 2026-01-17: **SPRINT-040 (UI Design System) CLOSED**
  - Completed 9 tasks (TASK-1100 to TASK-1108) + 2 hotfixes
  - **PRs Merged:** #439-449 (11 total)
  - **Backlog Items Completed:** BACKLOG-286, 288, 289, 290, 295 (5 items)
  - **Key Deliverables:**
    - SyncProgress component with 3 variants (compact, standard, detailed)
    - Unified notification system with context API
    - Dashboard button labels simplified
    - Chat cards unified (individual + group)
    - Transaction header responsive layout
  - **Duration:** 2 days (estimated 3-4 days)
  - **Tokens:** ~220K (estimated ~227K)
  - Total items: 266, Pending: 144, Completed: 110
- 2026-01-17: **SPRINT-041 (Bug Fixes) CLOSED**
  - Completed 5 tasks (TASK-1109 to TASK-1113)
  - **PRs Merged:** #450-454 (5 total)
  - **Backlog Items:** BACKLOG-220, 221, 222, 228, 293
  - **Key Deliverables:**
    - Unlink UI refresh (PR #450) - partial fix only
    - Duplicate sync guard (PR #451)
    - Contact save persistence (PR #452)
    - Attachments stale ID fix (PR #453)
    - UI freeze prevention (PR #454)
  - **Issue:** BACKLOG-220 fix was insufficient - PR #450 addressed callback timing but root cause is thread-based schema architecture
- 2026-01-17: **BACKLOG-220 REOPENED**
  - **Reason:** PR #450 fix from SPRINT-041 was insufficient
  - **Root Cause:** Communications table links by message_id but UI operates on threads
  - **Required:** Thread-based schema refactor (communications.thread_id instead of message_id)
  - **Stashed Work:** `stash@{0}: TASK-1109-thread-based-schema-refactor-deferred` (7 files, 502+/619-)
  - **Reassigned to:** SPRINT-042 (Database Schema Alignment)
- 2026-01-17: **SPRINT-042 (Database Schema Alignment) PLANNED**
  - 3 tasks planned (TASK-1114 to TASK-1116)
  - **Scope:** Thread-based schema, service updates, unlink UI integration
  - **Backlog Items:** BACKLOG-220 (reopened), BACKLOG-296 (database schema alignment)
  - **Reference:** Schema audit on `research/database-schema-audit` branch
  - **Estimated Tokens:** ~55K
  - Total items: 266, Pending: 143, Reopened: 1
- 2026-01-17: **Added BACKLOG-298 and BACKLOG-299** (SPRINT-041 testing findings)
  - BACKLOG-298 (Medium): Video Attachment Support in ConversationViewModal
    - ConversationViewModal only displays image/* attachments
    - Videos (.mov, .mp4) are filtered out by isDisplayableImage()
    - Options: inline video player, thumbnail + click-to-open, or file icon
    - Est. ~35K tokens
  - BACKLOG-299 (Medium): 1:1 Chat Incorrectly Shown as Group Chat
    - "unknown" participant value triggers isGroupChat() incorrectly
    - Needs investigation: where does "unknown" originate?
    - Root cause likely in message parser or phone normalization
    - Est. ~25K tokens (includes investigation)
  - Total items: 269, Pending: 147

---

## Estimation Accuracy Analysis

**Purpose:** Track PM estimation accuracy by category to improve future predictions.

> ⚠️ **DATA QUALITY WARNING (as of SPRINT-015)**
>
> Historical data uses self-reported metrics which are unreliable (~100x variance observed).
> Starting 2026-01-03, all new tasks use auto-captured metrics via SubagentStop hook.
> Category adjustment factors will be recalculated once sufficient auto-captured data is available.

### By Category (Updated after each sprint)

| Category | Tasks | Complete (✓) | Avg Variance | Trend | Adjustment Factor |
|----------|-------|--------------|--------------|-------|-------------------|
| schema | 4 | 0 | +20% | under | 1.2x ⚠️ |
| refactor | 10 | 1 | -52% | over | **0.5x** ⚠️ |
| test | 3 | 2 | +14% | mixed | 1.1x |
| config | 1 | 1 | -62% | over | 0.5x |
| security | 2 | 0 | -65% | over | 0.4x ⚠️ |
| service | 9 | 1 | -31% | over | **0.50x** (SPRINT-015 confirmed) |
| docs | 3 | 1 | ~100x (incident) | incident | **5.0x** (iteration buffer) |
| types | 1 | 0 | 0% | accurate | **1.0x** (new) |
| ui | 1 | 1 | -72% | over | 0.3x |
| ipc | 0 | 0 | - | - | TBD |

**⚠️ Warning:** Categories with 0-1 complete tasks have unreliable adjustment factors.
Categories with reliable data (2+ complete tasks): `test`, `service` (9 tasks).
**CRITICAL:** `docs` category has incident-level variance - use 5x buffer and PM monitoring.

### Variance Breakdown (All Completed Tasks)

**Legend:** ✓ = Complete metrics (Impl + PR + Debug) | ⚠️ = Impl-only (missing PR/Debug) | ❌ = Incident

| Task | Category | Est | Actual | Variance | Data | Root Cause |
|------|----------|-----|--------|----------|------|------------|
| BACKLOG-014 | ui | 6-10 | 5 | -72% | ✓ | Simpler demo update |
| BACKLOG-035 | schema | 5-8 | 10 | +25% | ⚠️ | Migration complexity underestimated |
| BACKLOG-038 | schema | 10-15 | 8 | -36% | ⚠️ | Simpler than expected |
| BACKLOG-039 | schema | 10-15 | 25 | +100% | ⚠️ | Unexpected edge cases in status enum |
| BACKLOG-058 | refactor | 60-80 | 32 | -54% | ✓ | Clean extraction, fewer dependencies |
| BACKLOG-059 | test | 12-18 | 14 | -7% | ✓ | Accurate estimate |
| BACKLOG-060 | refactor | 10-15 | 14 | +12% | ⚠️ | Accurate estimate |
| BACKLOG-072 | config | 23-35 | 11 | -62% | ✓ | Workflow docs simpler than expected |
| BACKLOG-108 | test | 2-4 | 6 | +50% | ✓ | Flaky test fix more complex |
| BACKLOG-117 | service | 4-6 | 3 | -50% | ✓ | Auth regression simpler than expected |
| TASK-513 | refactor | 4-6 | 2 | -60% | ⚠️ | Toast fix simpler than expected |
| TASK-514 | refactor | 6-8 | 4 | -43% | ⚠️ | Clean component boundaries |
| TASK-515 | refactor | 4-6 | 1 | -80% | ⚠️ | Trivial extraction |
| TASK-516 | refactor | 8-10 | 5 | -44% | ⚠️ | Well-structured source code |
| TASK-517 | refactor | 4-6 | 4 | -20% | ⚠️ | Hook extraction on target |
| TASK-518 | refactor | 4-6 | 5 | 0% | ⚠️ | Accurate estimate |
| TASK-519 | refactor | 6-8 | 4 | -43% | ⚠️ | Clean hook boundaries |
| TASK-520 | refactor | 3-4 | 1 | -71% | ⚠️ | Directory restructure trivial |
| **TASK-704** | **ui/ipc** | **10-14** | **~24** | **+100%** | ⚠️ | **CI debugging incident (22h) - metrics not captured** |
| TASK-904 | service | 4-6 | 2 | -60% | ⚠️ | Clean IPC implementation |
| TASK-905 | schema | 3-4 | 5 | +25% | ⚠️ | Migration pattern discovery |
| **TASK-906** | **service** | **4-6** | **incident** | **245x** | ❌ | **Parallel agent race condition (BACKLOG-132)** |
| TASK-907 | service | 4-6 | 1 | -80% | ⚠️ | Trivial extension of TASK-906 pattern |
| **TASK-908** | **service** | **3-4** | **incident** | **893x** | ❌ | **Parallel agent race condition (BACKLOG-132)** |
| TASK-909 | service | 3-4 | 1 | -70% | ⚠️ | Clean header extraction |
| **TASK-910** | **ui** | **3-4** | **incident** | **~400x** | ❌ | **window.d.ts type gap (BACKLOG-135)** |
| TASK-911 | service | 2-3 | 2 | 0% | ⚠️ | On target |
| TASK-912 | test | 4-6 | 4 | -20% | ⚠️ | Clean test authoring |
| BACKLOG-132 | docs | 1-2 | 3 | +360% | ✓ | PM estimate excluded SR review overhead (~15K) |
| **TASK-914** | **docs** | **2-3** | **N/A** | **~100x** | ❌ | **Token cap iteration spiral (self-reported ~8K, actual ~800K-1.1M)** |
| **TASK-915** | **docs** | **1-2** | **N/A** | **~100x** | ❌ | **Generator docs iteration spiral (self-reported ~12K, actual ~800K-1.1M)** |
| TASK-916 | types | 2-3 | 3 | 0% | ⚠️ | Type sync straightforward |
| TASK-917 | service | 4-6 | 3 | -40% | ⚠️ | Pattern reference accelerated work |
| TASK-918 | service | 4-5 | 3 | -33% | ⚠️ | Well-specified task file |
| TASK-919 | service | 4-6 | 3 | -20% | ⚠️ | Sequential execution, no conflicts |

**Summary:** 8 tasks with complete data, 25 tasks with incomplete data, 5 incidents

### Learnings

1. **Schema tasks are unpredictable** - variance from -36% to +100%
2. **Refactor tasks are consistently overestimated** - avg -52% (use 0.5x multiplier)
3. **Config/docs tasks are overestimated** - avg -62%
4. **Security tasks are overestimated** - avg -65% (use 0.4x multiplier)
5. **Well-structured source code accelerates refactoring** - SPRINT-008 showed clean component boundaries enable faster extraction
6. **Sequential refactor tasks compound efficiency** - each task builds on prior work, reducing discovery time
7. **Service tasks overestimated when clean** - SPRINT-014 showed -45% avg variance (excluding incidents)
8. **CI/debugging incidents can dwarf implementation time** - TASK-704 took 30min to implement but 22h to debug CI issues. Incident tracking is MANDATORY (see BACKLOG-126)
9. **Parallel agent isolation is MANDATORY** - SPRINT-014 race condition (TASK-906+908) consumed ~18M tokens. Use worktrees for all background agents (BACKLOG-132)
10. **Type definition gaps cause debugging spirals** - SPRINT-014 TASK-910 consumed ~6M tokens due to window.d.ts missing getUnifiedStatus() (BACKLOG-135)
11. **PM estimates must include SR review overhead** - BACKLOG-132 showed +360% token variance because PM estimated impl only (~5K), but SR review added ~15K. Future estimates should add ~10-20K for mandatory PR review phase.
12. **Documentation tasks with iteration can spiral** - SPRINT-015 TASK-914/915 consumed ~100x estimated tokens due to iteration cycles and CI debugging. Self-reported metrics captured only final successful run. Docs category needs 5x buffer for iteration.
13. **Pattern reference dramatically accelerates service tasks** - SPRINT-015 TASK-917 referenced TASK-909 pattern, completing at -40% variance. Well-specified task files with code examples reduce variance.
14. **Sequential execution for shared files is mandatory** - SPRINT-015 Phase 3 (TASK-917/918/919) completed efficiently by strict sequential order. No merge conflicts despite all three touching fetch services.
15. **SQLite integer booleans cause React rendering bugs** - BACKLOG-201: `msg.has_attachments` returns 0/1 from SQLite, not boolean. In JSX, `{0 && <Component/>}` renders "0" as text (React renders numbers but not false/null/undefined). Fix: Always use `!!field` or `Boolean(field)` for SQLite integer fields in JSX conditionals. Investigation took ~3h for a 2-line fix - browser DevTools "Inspect Element" was the breakthrough (revealed "00" as orphan text nodes).

### PM Estimation Guidelines (Update as patterns emerge)

> **Note:** As of 2026-01-03, estimates are in tokens only. Duration is captured but not estimated.

| Category | Base Estimate | Adjustment | Notes |
|----------|---------------|------------|-------|
| schema | PM estimate | x 1.2 | High variance, add buffer |
| refactor | PM estimate | **x 0.5** | Consistently overestimate (10 tasks, -52% avg) |
| test | PM estimate | x 0.9 | Usually accurate, slight overestimate |
| config | PM estimate | x 0.5 | Significantly overestimate |
| security | PM estimate | x 0.4 | SPRINT-009 showed simpler implementations |
| service | PM estimate | **x 0.50** | SPRINT-014/015 confirmed -31% to -45% avg variance |
| types | PM estimate | **x 1.0** | SPRINT-015 TASK-916 showed 0% variance |
| docs | PM estimate | **x 5.0** | SPRINT-015 TASK-914/915 ~100x overrun - add iteration buffer |
| ipc | PM estimate | x 1.5 | TBD - suspected underestimate |
| ui | PM estimate | x 1.0 | TBD - SPRINT-014 incident skews data |

#### SR Review Overhead (Add to ALL estimates)

| Task Complexity | SR Review Overhead |
|-----------------|-------------------|
| Trivial (docs, config) | +10-15K tokens |
| Standard (service, ui) | +15-25K tokens |
| Complex (schema, refactor) | +25-40K tokens |

**Formula:** `Total Estimate = (Impl Estimate × Category Adjustment) + SR Review Overhead`

**Example:** A `docs` task estimated at ~10K tokens:
- Adjusted impl: ~10K × 0.5 = ~5K
- SR review overhead: +10-15K
- **Total estimate: ~15-20K tokens**

#### Automatic Token Tracking (BACKLOG-137)

**Actual tokens and duration are now captured automatically** via SubagentStop hook.

Hook output fields:
- `total_tokens` - Sum of input + output + cache tokens
- `duration_secs` - Time from first to last message in transcript
- `api_calls` - Number of API roundtrips

```bash
# View all metrics
cat .claude/metrics/tokens.jsonl | jq '.'

# Find specific agent's data (use agent_id from Task tool output)
grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'
```

Engineers MUST record their `agent_id` immediately when the Task tool returns, then populate the "Metrics (Auto-Captured)" section of the task file.

**SPRINT-008 Insight**: For refactor sprints targeting well-structured code with clear boundaries, consider x 0.4 or even x 0.3 multiplier.

**SPRINT-014 Insight**: Token overruns from infrastructure issues (race conditions, type gaps) can exceed implementation costs by 100-900x. Prevention is critical - see BACKLOG-132, 133, 135.
