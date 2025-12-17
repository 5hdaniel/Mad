# Backlog Index

This index tracks all backlog items with their current status and metadata.

**Last Updated:** 2025-12-16
**Total Items:** 79
**Pending:** 72 | **In Progress:** 0 | **Completed:** 6 | **Obsolete:** 2

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
- **Critical:** BACKLOG-030, 032, 035, 038, 039, 044, 045, 058, 059, 072, 073, 074
- **High:** BACKLOG-008, 009, 013, 016, 018, 020, 021, 023, 026, 031, 033, 037, 056, 060, 061, 062, 063, 067, 075, 076
- **Medium:** Multiple (see full index), 077, 078, 079
- **Low/Deferred:** BACKLOG-001, 003, 004, 010, 017, 069, 070

### By Sprint Assignment
- **SPRINT-001 (Onboarding Refactor):** ✅ Completed
- **SPRINT-002 (Tech Debt):** ✅ Completed (BACKLOG-058, 059, 060)
- **SPRINT-003 (Process & Data Integrity):** BACKLOG-072, 038, 039, 035
- **SPRINT-004 (AI MVP Foundation):** BACKLOG-073, 074 (planned after SPRINT-003)
- **SPRINT-005 (AI MVP Core):** BACKLOG-075, 076 (planned)
- **SPRINT-006 (AI MVP Polish):** BACKLOG-077, 078, 079 (planned)
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

| ID | Title | Priority | Status | Sprint | Est. Turns | Est. Tokens | Est. Time | Impl Turns | Impl Tokens | Impl Time | PR Turns | PR Tokens | PR Time | Debug Turns | Debug Tokens | Debug Time | Total Turns | Total Tokens | Total Time | File |
|----|-------|----------|--------|--------|------------|-------------|-----------|------------|-------------|-----------|----------|-----------|---------|-------------|--------------|------------|-------------|--------------|------------|------|
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
| BACKLOG-035 | Remove Orphaned Table | Critical | Pending | SPRINT-003 | 5-8 | 20-30K | ~30m | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-036 | Fix Sync Phase UI Text | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-037 | Don't Fail Sync on Disconnect | High | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-038 | Schema Mismatch contacts.name | Critical | Pending | SPRINT-003 | 10-15 | 40-60K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-039 | Schema Mismatch transactions.status | Critical | Pending | SPRINT-003 | 10-15 | 40-60K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-040 | ContactsService macOS Paths | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-041 | Create UX Engineer Agent | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-042 | Lookback Period Not Persistent | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-043 | Settings Screen Not Scrollable | Medium | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-044 | Multiple Contacts Per Role | Critical | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| BACKLOG-045 | Block Contact Deletion | Critical | Pending | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
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
| BACKLOG-058 | Split databaseService.ts | Critical | ✅ Completed | SPRINT-002 | 60-80 | 200-300K | - | ~25 | ~100K | ~2h | 2 | ~15K | ~15m | 5 | ~20K | ~30m | ~32 | ~135K | ~3h | [BACKLOG-058.md](BACKLOG-058.md) |
| BACKLOG-059 | Fix Skipped Tests (27+) | Critical | ✅ Completed | SPRINT-002 | 12-18 | 48-72K | - | 10 | ~45K | - | 1 | ~12K | - | 3 | ~8K | - | 14 | ~65K | - | [BACKLOG-059.md](BACKLOG-059.md) |
| BACKLOG-060 | Fix N+1 Query Pattern | High | ✅ Completed | SPRINT-002 | 10-15 | 40-60K | - | - | - | - | - | - | - | - | - | - | 14 | ~55K | - | [BACKLOG-060.md](BACKLOG-060.md) |
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
| BACKLOG-072 | Enforce Engineer Workflow Compliance | Critical | Pending | SPRINT-003 | 23-35 | 90-140K | ~3h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-072.md](BACKLOG-072.md) |
| BACKLOG-073 | AI MVP Phase 0 - Schema Foundation | Critical | Pending | SPRINT-004 | 22 | ~50K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-073.md](BACKLOG-073.md) |
| BACKLOG-074 | AI MVP Phase 1 - LLM Infrastructure | Critical | Pending | SPRINT-004 | 28 | ~70K | ~2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-074.md](BACKLOG-074.md) |
| BACKLOG-075 | AI MVP Phase 2 - AI Analysis Tools | High | Pending | SPRINT-005 | 28 | ~70K | ~2h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-075.md](BACKLOG-075.md) |
| BACKLOG-076 | AI MVP Phase 3 - Hybrid Pipeline | High | Pending | SPRINT-005 | 34 | ~85K | ~2.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-076.md](BACKLOG-076.md) |
| BACKLOG-077 | AI MVP Phase 4 - Feedback Loop | Medium | Pending | SPRINT-006 | 8 | ~25K | ~1h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-077.md](BACKLOG-077.md) |
| BACKLOG-078 | AI MVP Phase 5 - UI Enhancements | Medium | Pending | SPRINT-006 | 13 | ~40K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-078.md](BACKLOG-078.md) |
| BACKLOG-079 | AI MVP Phase 6 - Integration Testing | Medium | Pending | SPRINT-006 | 13 | ~40K | ~1.5h | - | - | - | - | - | - | - | - | - | - | - | - | [BACKLOG-079.md](BACKLOG-079.md) |

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
| SPRINT-003 | Process & Data Integrity | 🔄 Active | BACKLOG-072, 038, 039, 035 |
| SPRINT-004 | AI MVP Foundation | 📋 Planned | BACKLOG-073, 074 (14 tasks) |
| SPRINT-005 | AI MVP Core | 📋 Planned | BACKLOG-075, 076 |
| SPRINT-006 | AI MVP Polish | 📋 Planned | BACKLOG-077, 078, 079 |

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
