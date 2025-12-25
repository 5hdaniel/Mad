# Backlog Index

This index tracks all backlog items with their current status and metadata.

**Last Updated:** 2025-12-24
**Total Items:** 82
**Pending:** 67 | **In Progress:** 0 | **Completed:** 14 | **Obsolete:** 2

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
- **Critical:** BACKLOG-030 (done), 032, 035 (done), 038 (done), 039 (done), 044 (done), 045 (done), 058 (done), 059 (done), 072 (done), 073 (done), 074 (done)
- **High:** BACKLOG-008, 009, 013, 016, 018, 020, 021, 023, 026, 031, 033, 037, 056, 060, 061, 062, 063, 067, 075, 076
- **Medium:** Multiple (see full index), 077, 078, 079
- **Low/Deferred:** BACKLOG-001, 003, 004, 010, 017, 069, 070

### By Sprint Assignment
- **SPRINT-001 (Onboarding Refactor):** ✅ Completed
- **SPRINT-002 (Tech Debt):** ✅ Completed (BACKLOG-058, 059, 060)
- **SPRINT-003 (Process & Data Integrity):** ✅ Completed (BACKLOG-072, 038, 039, 035)
- **SPRINT-004 (AI MVP Foundation):** ✅ Completed (BACKLOG-073, 074)
- **SPRINT-005 (AI MVP Core):** ✅ Completed (BACKLOG-075, 076)
- **SPRINT-006 (AI MVP Polish):** BACKLOG-077, 078, 079 (TASK-401 to TASK-414)
- **Unassigned:** All others

### AI MVP Project
- **Phase 0 (Schema):** BACKLOG-073
- **Phase 1 (LLM Infrastructure):** BACKLOG-074
- **Phase 2 (AI Analysis Tools):** BACKLOG-075
- **Phase 3 (Hybrid Pipeline):** BACKLOG-076
- **Phase 4 (Feedback Loop):** BACKLOG-077
- **Phase 5 (UI Enhancements):** BACKLOG-078
- **Phase 6 (Integration Testing):** BACKLOG-079
- **Note:** BACKLOG-066 (LLM Transaction Detection) is now covered by AI MVP project

---

## Full Index

**Categories:** `schema` | `service` | `ipc` | `ui` | `refactor` | `test` | `config` | `docs` | `infra`

| ID | Title | Category | Priority | Status | Sprint | Est. Turns | Est. Tokens | Est. Time | Impl Turns | Impl Tokens | Impl Time | PR Turns | PR Tokens | PR Time | Debug Turns | Debug Tokens | Debug Time | Total Turns | Total Tokens | Total Time | Variance | File |
|----|-------|----------|----------|--------|--------|------------|-------------|-----------|------------|-------------|-----------|----------|-----------|---------|-------------|--------------|------------|-------------|--------------|------------|----------|------|
| BACKLOG-001 | Add ES Module Type to package.json | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-001.md](BACKLOG-001.md) |
| BACKLOG-002 | Code-Split Large JS Bundle | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-002.md](BACKLOG-002.md) |
| BACKLOG-003 | Improve First-Sync Time Estimation | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-003.md](BACKLOG-003.md) |
| BACKLOG-004 | Add Sync History/Logs Screen | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-004.md](BACKLOG-004.md) |
| BACKLOG-005 | Implement databaseService with LLM-Ready Patterns | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-005.md](BACKLOG-005.md) |
| BACKLOG-006 | Dark Mode (Match System Settings) | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-006.md](BACKLOG-006.md) |
| BACKLOG-007 | Add iPhone Sync Integration Tests | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-007.md](BACKLOG-007.md) |
| BACKLOG-008 | Redesign New Transaction Flow | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-008.md](BACKLOG-008.md) |
| BACKLOG-009 | Auth Popup Close Handler | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-009.md](BACKLOG-009.md) |
| BACKLOG-010 | Default App Window to Full Screen | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-010.md](BACKLOG-010.md) |
| BACKLOG-011 | Manually Add Missing Emails to Audit | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-012 | Manually Add Missing Texts to Audit | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-013 | Duplicate Transaction Detection | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-014 | Update Joyride Demo for New Users | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-015 | Display Last Sync Time in UI | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-016 | Refactor Contact Import | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-017 | Naming Convention Documentation | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-018 | Smart Contact Sync | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-019 | Returning User Experience | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-020 | Device UUID Licensing | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-021 | License Management System | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-022 | Minimizable iPhone Sync Modal | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-023 | Detailed Sync Progress | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-024 | Auto-Start Sync on Launch | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-025 | Resume Failed Sync Prompt | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-026 | Skip Driver Install Check | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-027 | Skip Mailbox Permission | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-028 | Create App Logo & Branding | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-029 | App Startup Performance | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-030 | Message Parser Async Yielding | Critical | ✅ Completed | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-031 | Incremental Backup Size Estimation | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-032 | Handle Backup Already in Progress | Critical | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-033 | Check Supabase Terms Acceptance | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-034 | Phone Type Card Layout | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-035 | Remove Orphaned Table | schema | Critical | ✅ Completed | SPRINT-003 | 5-8 | 20-30K | ~30m | 10 | ~40K | ~20m | - | - | - | - | - | - | 10 | ~40K | ~20m | +25% | [BACKLOG-035.md](BACKLOG-035.md) |
| BACKLOG-036 | Fix Sync Phase UI Text | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-037 | Don't Fail Sync on Disconnect | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-038 | Schema Mismatch contacts.name | schema | Critical | ✅ Completed | SPRINT-003 | 10-15 | 40-60K | ~1.5h | 8 | ~30K | ~15m | - | - | - | - | - | - | 8 | ~30K | ~15m | -36% | [BACKLOG-038.md](BACKLOG-038.md) |
| BACKLOG-039 | Schema Mismatch transactions.status | schema | Critical | ✅ Completed | SPRINT-003 | 10-15 | 40-60K | ~1.5h | 25 | ~100K | ~45m | - | - | - | - | - | - | 25 | ~100K | ~45m | +100% | [BACKLOG-039.md](BACKLOG-039.md) |
| BACKLOG-040 | ContactsService macOS Paths | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-041 | Create UX Engineer Agent | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-042 | Lookback Period Not Persistent | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-043 | Settings Screen Not Scrollable | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-044 | Multiple Contacts Per Role | ui | Critical | ✅ Completed | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Backend + UI implemented |
| BACKLOG-045 | Block Contact Deletion | service | Critical | ✅ Completed | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | getTransactionsByContact + tests |
| BACKLOG-046 | DB Init Circuit Breaker | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-047 | Contact Deletion Query Fix | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-048 | Transaction Edit Preserve Tab | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-049 | Communications Tab | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-050 | Attachments Tab | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-051 | Delete Comms/Attachments | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-052 | AI Transaction Timeline | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-053 | Manually Add Communications | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-054 | Render Email HTML | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-055 | AI House Viewing Extraction | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-056 | macOS Code Signing Fix | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-057 | Login Auth Timeout Retry | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-058 | Split databaseService.ts | refactor | Critical | ✅ Completed | SPRINT-002 | 60-80 | 200-300K | - | ~25 | ~100K | ~2h | 2 | ~15K | ~15m | 5 | ~20K | ~30m | ~32 | ~135K | ~3h | -54% | [BACKLOG-058.md](BACKLOG-058.md) |
| BACKLOG-059 | Fix Skipped Tests (27+) | test | Critical | ✅ Completed | SPRINT-002 | 12-18 | 48-72K | - | 10 | ~45K | - | 1 | ~12K | - | 3 | ~8K | - | 14 | ~65K | - | -7% | [BACKLOG-059.md](BACKLOG-059.md) |
| BACKLOG-060 | Fix N+1 Query Pattern | refactor | High | ✅ Completed | SPRINT-002 | 10-15 | 40-60K | - | - | - | - | - | - | - | - | - | - | 14 | ~55K | - | +12% | [BACKLOG-060.md](BACKLOG-060.md) |
| BACKLOG-061 | Refactor Transactions.tsx | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-062 | Refactor Contacts.tsx | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-063 | Refactor useAppStateMachine.ts | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-064 | Add Batch DB Operations | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-065 | Remove Console Statements | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-066 | LLM Transaction Detection | High | Obsolete | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | Covered by AI MVP (BACKLOG-073-079) |
| BACKLOG-067 | AI Timeline Builder | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-068 | Contact Deduplication | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-069 | Telemetry & Analytics | Low | Deferred | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-070 | Enterprise User Management | Low | Deferred | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-071 | Atomic Transaction Creation | Low | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-072 | Enforce Engineer Workflow Compliance | config | Critical | ✅ Completed | SPRINT-003 | 23-35 | 90-140K | ~3h | 8 | ~32K | 15m | 1 | ~12K | 8m | 2 | ~8K | 5m | 11 | ~52K | 28m | -62% | [BACKLOG-072.md](BACKLOG-072.md) |
| BACKLOG-073 | AI MVP Phase 0 - Schema Foundation | Critical | Pending | SPRINT-004 | 22 | ~50K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-073.md](BACKLOG-073.md) |
| BACKLOG-074 | AI MVP Phase 1 - LLM Infrastructure | Critical | Pending | SPRINT-004 | 28 | ~70K | ~2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-074.md](BACKLOG-074.md) |
| BACKLOG-075 | AI MVP Phase 2 - AI Analysis Tools | High | Pending | SPRINT-005 | 28 | ~70K | ~2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-075.md](BACKLOG-075.md) |
| BACKLOG-076 | AI MVP Phase 3 - Hybrid Pipeline | High | Pending | SPRINT-005 | 34 | ~85K | ~2.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-076.md](BACKLOG-076.md) |
| BACKLOG-077 | AI MVP Phase 4 - Feedback Loop | Medium | Pending | SPRINT-006 | 8 | ~25K | ~1h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-077.md](BACKLOG-077.md) |
| BACKLOG-078 | AI MVP Phase 5 - UI Enhancements | Medium | Pending | SPRINT-006 | 13 | ~40K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-078.md](BACKLOG-078.md) |
| BACKLOG-079 | AI MVP Phase 6 - Integration Testing | Medium | Pending | SPRINT-006 | 13 | ~40K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-079.md](BACKLOG-079.md) |
| BACKLOG-089 | Password Manager Support in Authentication | ui | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-089.md](BACKLOG-089.md) |
| BACKLOG-090 | Incremental Sync - Only Process New Data | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-090.md](BACKLOG-090.md) |
| BACKLOG-091 | Prevent Duplicate Emails Across Providers | service | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-091.md](BACKLOG-091.md) |
| TASK-513 | Fix Toast Notification Persistence | refactor | High | In Progress | SPRINT-008 | 4-6 | ~20K | 30-45m | 2 | ~16K | 20m | - | - | - | 0 | 0 | 0 | - | - | - | - | [TASK-513-toast-fix.md](../tasks/TASK-513-toast-fix.md) |
| TASK-514 | Extract TransactionStatusWrapper | refactor | Medium | Pending | SPRINT-008 | 6-8 | ~28K | 45-60m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-514-extract-transaction-status-wrapper.md](../tasks/TASK-514-extract-transaction-status-wrapper.md) |
| TASK-515 | Extract TransactionCard | refactor | Medium | Pending | SPRINT-008 | 4-6 | ~20K | 30-45m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-515-extract-transaction-card.md](../tasks/TASK-515-extract-transaction-card.md) |
| TASK-516 | Extract TransactionToolbar | refactor | Medium | Pending | SPRINT-008 | 8-10 | ~36K | 60-90m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-516-extract-transaction-toolbar.md](../tasks/TASK-516-extract-transaction-toolbar.md) |
| TASK-517 | Extract useTransactionList Hook | refactor | Medium | Pending | SPRINT-008 | 4-6 | ~20K | 30-45m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-517-extract-use-transaction-list.md](../tasks/TASK-517-extract-use-transaction-list.md) |
| TASK-518 | Extract useTransactionScan Hook | refactor | Medium | Pending | SPRINT-008 | 4-6 | ~20K | 30-45m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-518-extract-use-transaction-scan.md](../tasks/TASK-518-extract-use-transaction-scan.md) |
| TASK-519 | Extract useBulkActions Hook | refactor | Medium | Pending | SPRINT-008 | 6-8 | ~28K | 45-60m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-519-extract-use-bulk-actions.md](../tasks/TASK-519-extract-use-bulk-actions.md) |
| TASK-520 | Directory Structure + Barrel Exports | refactor | Low | Pending | SPRINT-008 | 3-4 | ~14K | 20-30m | - | - | - | - | - | - | - | - | - | - | - | - | [TASK-520-directory-restructure.md](../tasks/TASK-520-directory-restructure.md) |

---

## Status Legend

| Status | Description |
|--------|-------------|
| Pending | Not started |
| In Progress | Actively being worked on |
| ✅ Completed | Done and merged |
| Blocked | Waiting on dependency |
| Deferred | Explicitly postponed |
| Obsolete | No longer applicable |

---

## Sprint History

| Sprint ID | Name | Status | Items Completed |
|-----------|------|--------|-----------------|
| SPRINT-001 | Onboarding Refactor | ✅ Completed | TASK-101 to TASK-116 |
| SPRINT-002 | Tech Debt | ✅ Completed | BACKLOG-058, 059, 060 + 3 bonus fixes |
| SPRINT-003 | Process & Data Integrity | ✅ Completed | BACKLOG-072, 038, 039, 035 (4 tasks, 53 turns, ~210K tokens*) |
| SPRINT-004 | AI MVP Foundation | ✅ Completed | BACKLOG-073, 074 (14 tasks, TASK-301 to TASK-314) |
| SPRINT-005 | AI MVP Core | ✅ Completed | BACKLOG-075, 076 (10 tasks, TASK-315 to TASK-324) |
| SPRINT-006 | AI MVP Polish | 📋 Planned | BACKLOG-077, 078, 079 (14 tasks, TASK-401 to TASK-414) |
| SPRINT-007 | LLM Cost Optimization | 📋 Planned | TASK-501 to TASK-512 |
| SPRINT-008 | TransactionList Refactoring | ✅ Completed | TASK-513 to TASK-520 (8 tasks, 26 turns, ~146K tokens, ~2hrs) |

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
- 2025-12-24: **SPRINT-008 COMPLETE** - TransactionList: 1,357→431 lines (-68%), 9 files extracted
- 2025-12-24: TASK-521 (Expand bulk status to all 4 statuses) completed - PR #208 merged, 2 turns, ~12K tokens, 7m

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
4. **Well-structured source code accelerates refactoring** - SPRINT-008 showed clean component boundaries enable faster extraction
5. **Sequential refactor tasks compound efficiency** - each task builds on prior work, reducing discovery time
6. **Need more data on: service, ipc, ui categories**

### PM Estimation Guidelines (Update as patterns emerge)

| Category | Base Estimate | Adjustment | Notes |
|----------|---------------|------------|-------|
| schema | PM estimate | × 1.3 | High variance, add buffer |
| refactor | PM estimate | **× 0.5** | Consistently overestimate (10 tasks, -52% avg) |
| test | PM estimate | × 1.0 | Usually accurate |
| config | PM estimate | × 0.5 | Significantly overestimate |
| service | PM estimate | × 1.0 | TBD - need data |
| ipc | PM estimate | × 1.5 | TBD - suspected underestimate |
| ui | PM estimate | × 1.0 | TBD - need data |

**SPRINT-008 Insight**: For refactor sprints targeting well-structured code with clear boundaries, consider × 0.4 or even × 0.3 multiplier.
