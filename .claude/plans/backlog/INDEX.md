# Backlog Index

This index tracks all backlog items with their current status and metadata.

**Last Updated:** 2026-01-02
**Total Items:** 146
**Pending:** 80 | **In Progress:** 0 | **Completed:** 60 | **Partial:** 1 | **Obsolete:** 2 | **Deferred:** 2

---

> **NON-NEGOTIABLE: METRICS SUBMISSION REQUIRED**
>
> When completing ANY backlog item, you MUST submit granular metrics:
>
> | Phase | Turns | Tokens | Time |
> |-------|-------|--------|------|
> | Implementation | required | required | required |
> | PR Review | required | required | required |
> | Debugging/Fixes | required | required | required |
> | **Total** | required | required | required |
>
> **No exceptions.** PM will reject completion reports without this breakdown.

---

## Quick Filters

### By Priority
- **Critical:** BACKLOG-030 (done), 032 (done), 035 (done), 038 (done), 039 (done), 044 (done), 045 (done), 058 (done), 059 (done), 072 (done), 073 (done), 074 (done), 107 (done), 108 (done), 117 (done), 132 (done)
- **High:** BACKLOG-008, 009, 013, 016, 018, 020, 021, 023, 026, 031, 033, 037, 056, 060 (done), 061, 062, 063, 067, 075 (done), 076 (done), 084 (done), 085 (done), 088, 090 (done), 091 Phase 1 (done), 098, 099, 109 (done), 110 (done), **111**, **118**, **121**, 126 (done), 130 (done), **133** (NEW - token cap with early reporting), **134** (done - engineer token optimization)
- **Medium:** Multiple (see full index), 014 (done), 077 (done), 078 (done), 079 (done), 081, 086, 087, 089, 092, 093, 094, 095, 096, 097, 100, 101, 102, **112**, **113**, **114**, **115**, **116**, 122 (done), 124 (done), 127 (done), 128 (done), 129 (done), **131**
- **Low/Deferred:** BACKLOG-001, 003, 004, 010, 017, 069, 070, 071, **119**, **123**, **125**

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
- **Unassigned:** All others

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
| BACKLOG-091 | Prevent Duplicate Emails Across Providers | service | High | Partial | SPRINT-014 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Phase 1 done (TASK-905, 909), Phase 2 deferred | [BACKLOG-091.md](BACKLOG-091.md) |
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
| BACKLOG-121 | Add Generator Approach Guidance for Large Fixtures | docs | High | Pending | - | 2-3 | ~10K | 20-30m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-121.md](BACKLOG-121.md) |
| BACKLOG-122 | Improve Engineer Agent Worktree Instructions | docs | Medium | Completed | - | 2-3 | ~10K | 20-30m | 2 | ~8K | 10m | - | - | - | - | - | - | 2 | ~8K | 10m | -50% | [BACKLOG-122.md](BACKLOG-122.md) |
| BACKLOG-123 | Update Test Category Estimation Multiplier | docs | Low | Pending | - | 1-2 | ~5K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-123.md](BACKLOG-123.md) |
| BACKLOG-124 | Add Sprint Completion Checklist to PM Workflow | docs | Medium | Pending | SPRINT-012 | 2-3 | ~10K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-124.md](BACKLOG-124.md) |
| BACKLOG-125 | Enforce Metrics Collection for All Sprints | docs | Low | Pending | - | 2-3 | ~8K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-125.md](BACKLOG-125.md) |
| BACKLOG-126 | Enforce Debugging Metrics with Commit Verification | docs | High | Pending | SPRINT-012 | 4-6 | ~20K | 30-45m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-126.md](BACKLOG-126.md) |
| BACKLOG-127 | Add Sprint Capacity Limits to PM Workflow | docs | Medium | Pending | SPRINT-012 | 1-2 | ~6K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-127.md](BACKLOG-127.md) |
| BACKLOG-128 | Add Type Verification Checklist for Fixture Tasks | docs | Medium | Pending | SPRINT-012 | 1-2 | ~6K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-128.md](BACKLOG-128.md) |
| BACKLOG-129 | Create CI Troubleshooting Documentation | docs | Medium | Pending | SPRINT-012 | 2-3 | ~10K | 15-20m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-129.md](BACKLOG-129.md) |
| BACKLOG-130 | Sub-Agent Permission Auto-Denial Incident | infra/process | High | Pending | SPRINT-012 | 1-2 | ~8K | 10-15m | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-130.md](BACKLOG-130.md) |
| BACKLOG-132 | Mandatory Worktree for Parallel/Background Agents | docs/process | Critical | Completed | - | 1-2 | ~5K | 8-12m | 2 | ~8K | 5m | 1 | ~15K | 5m | 0 | 0 | 0 | 3 | ~23K | 10m | 0% | [BACKLOG-132.md](BACKLOG-132.md) |

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

---

## Estimation Accuracy Analysis

**Purpose:** Track PM estimation accuracy by category to improve future predictions.

### By Category (Updated after each sprint)

| Category | Tasks | Avg Variance | Trend | Adjustment Factor |
|----------|-------|--------------|-------|-------------------|
| schema | 4 | +20% | under | 1.2x |
| refactor | 10 | -52% | over | **0.5x** |
| test | 2 | -15% | accurate | 0.9x |
| config | 1 | -62% | over | 0.5x |
| security | 2 | -65% | over | 0.4x |
| service | 5 | -45% | over | **0.55x** |
| ipc | 0 | - | - | TBD |
| ui | 0 | - | - | TBD (SPRINT-014 incident skews data) |

**Note:** Refactor and service categories now have sufficient data for reliable adjustment factors.
**Warning:** UI category variance unreliable due to TASK-910 type debugging incident.

### Variance Breakdown (All Completed Tasks)

| Task | Category | Est | Actual | Variance | Root Cause |
|------|----------|-----|--------|----------|------------|
| BACKLOG-035 | schema | 5-8 | 10 | +25% | Migration complexity underestimated |
| BACKLOG-038 | schema | 10-15 | 8 | -36% | Simpler than expected |
| BACKLOG-039 | schema | 10-15 | 25 | +100% | Unexpected edge cases in status enum |
| BACKLOG-058 | refactor | 60-80 | 32 | -54% | Clean extraction, fewer dependencies |
| BACKLOG-059 | test | 12-18 | 14 | -7% | Accurate estimate |
| BACKLOG-060 | refactor | 10-15 | 14 | +12% | Accurate estimate |
| BACKLOG-072 | config | 23-35 | 11 | -62% | Workflow docs simpler than expected |
| TASK-513 | refactor | 4-6 | 2 | -60% | Toast fix simpler than expected |
| TASK-514 | refactor | 6-8 | 4 | -43% | Clean component boundaries |
| TASK-515 | refactor | 4-6 | 1 | -80% | Trivial extraction |
| TASK-516 | refactor | 8-10 | 5 | -44% | Well-structured source code |
| TASK-517 | refactor | 4-6 | 4 | -20% | Hook extraction on target |
| TASK-518 | refactor | 4-6 | 5 | 0% | Accurate estimate |
| TASK-519 | refactor | 6-8 | 4 | -43% | Clean hook boundaries |
| TASK-520 | refactor | 3-4 | 1 | -71% | Directory restructure trivial |
| **TASK-704** | **ui/ipc** | **10-14** | **~24** | **+100%** | **CI debugging incident (22h) - metrics not captured** |
| TASK-904 | service | 4-6 | 2 | -60% | Clean IPC implementation |
| TASK-905 | schema | 3-4 | 5 | +25% | Migration pattern discovery |
| **TASK-906** | **service** | **4-6** | **incident** | **245x** | **Parallel agent race condition (BACKLOG-132)** |
| TASK-907 | service | 4-6 | 1 | -80% | Trivial extension of TASK-906 pattern |
| **TASK-908** | **service** | **3-4** | **incident** | **893x** | **Parallel agent race condition (BACKLOG-132)** |
| TASK-909 | service | 3-4 | 1 | -70% | Clean header extraction |
| **TASK-910** | **ui** | **3-4** | **incident** | **~400x** | **window.d.ts type gap (BACKLOG-135)** |
| TASK-911 | service | 2-3 | 2 | 0% | On target |
| TASK-912 | test | 4-6 | 4 | -20% | Clean test authoring |

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

### PM Estimation Guidelines (Update as patterns emerge)

| Category | Base Estimate | Adjustment | Notes |
|----------|---------------|------------|-------|
| schema | PM estimate | x 1.2 | High variance, add buffer |
| refactor | PM estimate | **x 0.5** | Consistently overestimate (10 tasks, -52% avg) |
| test | PM estimate | x 0.9 | Usually accurate, slight overestimate |
| config | PM estimate | x 0.5 | Significantly overestimate |
| security | PM estimate | x 0.4 | SPRINT-009 showed simpler implementations |
| service | PM estimate | **x 0.55** | SPRINT-014 showed -45% avg variance |
| ipc | PM estimate | x 1.5 | TBD - suspected underestimate |
| ui | PM estimate | x 1.0 | TBD - SPRINT-014 incident skews data |

**SPRINT-008 Insight**: For refactor sprints targeting well-structured code with clear boundaries, consider x 0.4 or even x 0.3 multiplier.

**SPRINT-014 Insight**: Token overruns from infrastructure issues (race conditions, type gaps) can exceed implementation costs by 100-900x. Prevention is critical - see BACKLOG-132, 133, 135.
