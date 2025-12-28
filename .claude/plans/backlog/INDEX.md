# Backlog Index

This index tracks all backlog items with their current status and metadata.

**Last Updated:** 2025-12-28
**Total Items:** 125
**Pending:** 87 | **In Progress:** 0 | **Completed:** 35 | **Obsolete:** 2 | **Deferred:** 2

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
- **Critical:** BACKLOG-030 (done), 032, 035 (done), 038 (done), 039 (done), 044 (done), 045 (done), 058 (done), 059 (done), 072 (done), 073 (done), 074 (done), **107**, **108**
- **High:** BACKLOG-008, 009, 013, 016, 018, 020, 021, 023, 026, 031, 033, 037, 056, 060 (done), 061, 062, 063, 067, 075 (done), 076 (done), 084 (done), 085 (done), 088, 090, 091, 098, 099, **109**, **110**, **111**
- **Medium:** Multiple (see full index), 077 (done), 078 (done), 079 (done), 081, 086, 087, 089, 092, 093, 094, 095, 096, 097, 100, 101, 102, **112**, **113**, **114**, **115**
- **Low/Deferred:** BACKLOG-001, 003, 004, 010, 017, 069, 070, 071

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
- **SPRINT-010 (Core Polish & Text Messages):** Active - BACKLOG-103, 054, 105, 104, 050 (7 tasks)
- **SPRINT-011 (Testing Infrastructure & Demo):** Planned - BACKLOG-108, 014 (5 tasks)
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
| BACKLOG-014 | Update Joyride Demo for New Users | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
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
| BACKLOG-032 | Handle Backup Already in Progress | service | Critical | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
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
| BACKLOG-054 | Render Email HTML | ui | Medium | Pending | SPRINT-010 | 6-10 | ~35K-55K | 1-2h | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
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
| BACKLOG-090 | Incremental Sync - Only Process New Data | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-090.md](BACKLOG-090.md) |
| BACKLOG-091 | Prevent Duplicate Emails Across Providers | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-091.md](BACKLOG-091.md) |
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
| BACKLOG-103 | Fix Contact Selection Issue | ui | High | Pending | SPRINT-010 | 4-8 | ~25K-40K | 45-90m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-103.md](BACKLOG-103.md) |
| BACKLOG-104 | Dashboard UI to Emphasize Auto-Detection | ui | Medium | Pending | SPRINT-010 | 6-10 | ~35K-50K | 1-2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-104.md](BACKLOG-104.md) |
| BACKLOG-105 | Text Messages Tab in Transaction Details | ui | High | Pending | SPRINT-010 | 15-25 | ~80K-120K | 3-5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-105.md](BACKLOG-105.md) |
| BACKLOG-107 | Split useAppStateMachine.ts into Flow Hooks | refactor | Critical | Pending | - | 30-40 | ~100K | 1-1.5d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-107.md](BACKLOG-107.md) |
| BACKLOG-108 | Fix Flaky appleDriverService Test | test | Critical | Pending | SPRINT-011 | 2-4 | ~10K | 1-2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-108.md](BACKLOG-108.md) |
| BACKLOG-109 | Reduce AppRouter.tsx to <300 Lines | refactor | High | Pending | - | 4-6 | ~20K | 30-45m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-109.md](BACKLOG-109.md) |
| BACKLOG-110 | Reduce AppShell.tsx to <150 Lines | refactor | High | Pending | - | 3-4 | ~15K | 20-30m | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-110.md](BACKLOG-110.md) |
| BACKLOG-111 | Migrate Components to Service Abstractions | refactor | High | Pending | - | 40-50 | ~150K | 1-1.5d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-111.md](BACKLOG-111.md) |
| BACKLOG-112 | Boost Test Coverage for src/hooks/ | test | Medium | Pending | - | 40-60 | ~150K | 1-2d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-112.md](BACKLOG-112.md) |
| BACKLOG-113 | Boost Test Coverage for src/utils/ | test | Medium | Pending | - | 20-30 | ~80K | 1d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-113.md](BACKLOG-113.md) |
| BACKLOG-114 | Boost Test Coverage for electron/utils/ | test | Medium | Pending | - | 20-30 | ~80K | 1d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-114.md](BACKLOG-114.md) |
| BACKLOG-115 | Address Remaining any Types in Electron Handlers | refactor | Medium | Pending | - | 40-60 | ~150K | 1-2d | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-115.md](BACKLOG-115.md) |

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
| SPRINT-010 | Core Polish & Text Messages | **Active** | BACKLOG-103, 054, 105, 104, 050 (7 tasks: TASK-700 to TASK-706) |
| SPRINT-011 | Testing Infrastructure & Demo | Planned | BACKLOG-108, 014 (5 tasks: TASK-800 to TASK-804) |

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

---

## Estimation Accuracy Analysis

**Purpose:** Track PM estimation accuracy by category to improve future predictions.

### By Category (Updated after each sprint)

| Category | Tasks | Avg Variance | Trend | Adjustment Factor |
|----------|-------|--------------|-------|-------------------|
| schema | 3 | +30% | under | 1.3x |
| refactor | 10 | -52% | over | **0.5x** |
| test | 1 | -7% | accurate | 1.0x |
| config | 1 | -62% | over | 0.5x |
| security | 2 | -65% | over | 0.4x |
| service | 0 | - | - | TBD |
| ipc | 0 | - | - | TBD |
| ui | 0 | - | - | TBD |

**Note:** Refactor category now has sufficient data (10 tasks) for reliable adjustment factor.

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

### Learnings

1. **Schema tasks are unpredictable** - variance from -36% to +100%
2. **Refactor tasks are consistently overestimated** - avg -52% (use 0.5x multiplier)
3. **Config/docs tasks are overestimated** - avg -62%
4. **Security tasks are overestimated** - avg -65% (use 0.4x multiplier)
5. **Well-structured source code accelerates refactoring** - SPRINT-008 showed clean component boundaries enable faster extraction
6. **Sequential refactor tasks compound efficiency** - each task builds on prior work, reducing discovery time
7. **Need more data on: service, ipc, ui categories**

### PM Estimation Guidelines (Update as patterns emerge)

| Category | Base Estimate | Adjustment | Notes |
|----------|---------------|------------|-------|
| schema | PM estimate | x 1.3 | High variance, add buffer |
| refactor | PM estimate | **x 0.5** | Consistently overestimate (10 tasks, -52% avg) |
| test | PM estimate | x 1.0 | Usually accurate |
| config | PM estimate | x 0.5 | Significantly overestimate |
| security | PM estimate | x 0.4 | SPRINT-009 showed simpler implementations |
| service | PM estimate | x 1.0 | TBD - need data |
| ipc | PM estimate | x 1.5 | TBD - suspected underestimate |
| ui | PM estimate | x 1.0 | TBD - need data |

**SPRINT-008 Insight**: For refactor sprints targeting well-structured code with clear boundaries, consider x 0.4 or even x 0.3 multiplier.
