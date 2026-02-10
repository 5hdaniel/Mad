# SPRINT-073: Outlook Contacts Import — Desktop App

**Status:** completed
**Created:** 2026-02-07
**Branch From:** develop
**Target:** develop

## Goal

Import Outlook contacts into the Electron desktop app's existing `external_contacts` SQLite table, with a new "outlook" source pill in the UI.

## Backlog Items

- BACKLOG-629: Import Outlook Contacts to Desktop App

## Tasks

| Task | Description | Status | Depends On |
|------|-------------|--------|------------|
| TASK-1920 | Add Contacts.Read scope + fetch contacts via Graph API | completed (PR #762) | — |
| TASK-1921 | Import contacts to external_contacts table + "Email" source pill | completed (PR #763) | TASK-1920 |

## SR Engineer Review

**Reviewer:** SR Engineer (agent a961d7e)
**Verdict:** APPROVED WITH REQUIRED CHANGES
**Risk Level:** MEDIUM

### Key Findings

1. **Architecture correct** — right auth service, right patterns, right DB service
2. **Re-consent risk** — existing users' refresh tokens won't gain Contacts.Read automatically. Must handle 403 gracefully and prompt reconnect.
3. **No DB migration needed** — `external_contacts.source` is `TEXT DEFAULT 'macos'` with no CHECK constraint
4. **Task breakdown appropriate** — 2 sequential tasks, no file overlaps

### Required Changes (Applied)

- Added 403/scope-check handling to TASK-1920
- Added `$top=250` pagination parameter
- Added type cast and function signature updates to TASK-1921
- Added source-scoped sync isolation (don't reuse fullSync)
- Added "reconnect required" UI handling
- Added testing acceptance criteria to both tasks

## Notes

- All work in the Electron desktop app (`src/` and `electron/`), NOT `broker-portal/`
- Reuses existing Microsoft Graph email integration
- Sequential execution: TASK-1920 first, then TASK-1921
