# SPRINT-130: Support Platform - Core Ticketing MVP (Phase 1)

**Status:** Planning
**Created:** 2026-03-13
**Backlog Item:** BACKLOG-938
**Branch:** `feature/BACKLOG-938-support-platform-phase1`
**Target:** develop

---

## Sprint Goal

Build the complete core ticketing system for Keepr Support across 4 sequential phases: database foundation, agent dashboard (admin portal), customer portal (broker portal), and polish (attachments, search, participants, events). This sprint delivers a fully functional manual ticketing workflow with web form intake, agent queue management, and customer self-service.

---

## Architecture Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| Database | `supabase/migrations/20260313_support_*.sql` | 6 tables, 7 RPCs, ~25 RLS policies, storage bucket |
| Agent Dashboard | `admin-portal/app/dashboard/support/` | Internal ticket queue, detail, conversation, assignment |
| Customer Portal | `broker-portal/app/support/` | Public ticket form, customer ticket list, detail + reply |
| Shared Types | `admin-portal/lib/support-types.ts`, `broker-portal/lib/support-types.ts` | Type definitions per portal |
| Query Layer | `admin-portal/lib/support-queries.ts`, `broker-portal/lib/support-queries.ts` | Supabase query functions per portal |

---

## In-Scope

| Task ID | Title | Phase | Est. Tokens | Actual Tokens | Status |
|---------|-------|-------|-------------|---------------|--------|
| TASK-2171 | Database Schema, RLS, RPCs, Storage, RBAC | Sprint 1: Foundation | ~80K | - | Pending |
| TASK-2172 | Agent Dashboard - Ticket Queue & Navigation | Sprint 2: Agent Dashboard | ~70K | - | Pending |
| TASK-2173 | Agent Dashboard - Ticket Detail & Conversation | Sprint 2: Agent Dashboard | ~70K | - | Pending |
| TASK-2174 | Customer Portal - Ticket Submission & List | Sprint 3: Customer Portal | ~70K | - | Pending |
| TASK-2175 | Customer Portal - Ticket Detail & Reply | Sprint 3: Customer Portal | ~50K | - | Pending |
| TASK-2176 | Polish - Attachments, Search, Participants, Events | Sprint 4: Polish | ~70K | - | Pending |

**Total Estimated:** ~410K tokens

---

## Out of Scope / Deferred

- SLA engine (timestamp fields present, no automated tracking) -- Phase 2
- Email-to-ticket -- Phase 3
- Email notifications -- Phase 3
- Auto-assignment (round-robin, skill-based) -- Phase 2
- Saved views -- Phase 4
- Merge/link tickets -- Phase 4
- Collision warnings -- Phase 4
- Malware scanning -- Phase 4
- DSAR workflows -- Phase 4
- PII masking -- Phase 4
- In-app ticket submission (Electron desktop) -- Phase 5
- E2E / Playwright tests -- separate sprint (no existing Playwright setup in admin portal)
- Rich text editor -- plain text for Phase 1

---

## Execution Plan

**All tasks are SEQUENTIAL on a single branch: `feature/BACKLOG-938-support-platform-phase1`**

```
TASK-2171 (Foundation: DB + RLS + RPCs + RBAC)
    |
    v
TASK-2172 (Agent Dashboard: Queue + Nav)
    |
    v
TASK-2173 (Agent Dashboard: Detail + Conversation)
    |
    v
TASK-2174 (Customer Portal: Form + List)
    |
    v
TASK-2175 (Customer Portal: Detail + Reply)
    |
    v
TASK-2176 (Polish: Attachments + Search + Participants + Events)
```

**Why sequential:** All tasks build on prior work. The database must exist before the UI. The agent dashboard establishes shared patterns. The customer portal reuses types. Polish depends on all prior pages existing.

**Single branch strategy:** All work accumulates on `feature/BACKLOG-938-support-platform-phase1`. Each task commits to this branch. One PR at the end targeting develop.

---

## Dependency Graph

```
TASK-2171 (Foundation)
  |-- Creates: 6 tables, 7 RPCs, ~25 RLS policies, storage bucket, RBAC permissions, seed data
  |-- Required by: ALL subsequent tasks
  |
  +-> TASK-2172 (Agent Queue + Nav)
       |-- Creates: Queue page, types, queries, sidebar nav, permissions, middleware route
       |-- Required by: TASK-2173
       |
       +-> TASK-2173 (Agent Detail + Conversation)
            |-- Creates: Detail page, conversation thread, reply composer, status controls
            |-- Required by: TASK-2174 (pattern reference)
            |
            +-> TASK-2174 (Customer Form + List)
                 |-- Creates: Public form, customer list, broker portal nav
                 |-- Required by: TASK-2175
                 |
                 +-> TASK-2175 (Customer Detail + Reply)
                      |-- Creates: Customer ticket detail, reply form
                      |-- Required by: TASK-2176
                      |
                      +-> TASK-2176 (Polish)
                           |-- Creates: Attachment components, search, participants, events
                           |-- Final task - run tsc --noEmit on both portals
```

---

## Quality Gates

| Gate | When | Command | Pass Criteria |
|------|------|---------|---------------|
| RPC verification | After TASK-2171 | `mcp__supabase__execute_sql` | All 7 RPCs callable, return expected data |
| RLS verification | After TASK-2171 | `mcp__supabase__execute_sql` | Customers cannot see internal notes, agents see all |
| Type check (admin) | After TASK-2173 | `npx tsc --noEmit` in admin-portal | Zero errors |
| Type check (broker) | After TASK-2175 | `npx tsc --noEmit` in broker-portal | Zero errors |
| Type check (both) | After TASK-2176 | `npx tsc --noEmit` in both portals | Zero errors |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| RLS policy complexity (dual-audience) | High | Medium | All mutations via RPCs; RLS as defense-in-depth; test with execute_sql |
| Public form auth handling | Medium | Low | RPC handles both auth.uid() and email-only; clear branching in code |
| Large migration file | Medium | Low | Split into logical sections with clear comments |
| Broker portal middleware conflict | Low | Low | /support/* routes already pass through without auth (middleware only gates /dashboard/*) |
| Token overrun on UI tasks | Medium | Medium | Clear component structure in task files, reference existing patterns |

---

## Testing Plan

| Surface | Strategy | Owner |
|---------|----------|-------|
| Database RPCs | Verify via `mcp__supabase__execute_sql` after migration | Engineer (TASK-2171) |
| RLS policies | Test customer vs agent visibility via execute_sql | Engineer (TASK-2171) |
| Type safety | `npx tsc --noEmit` on both portals | Engineer (TASK-2173, 2175, 2176) |
| UI functionality | Manual testing by user on branch | User (post-PR) |
| State machine | Verify transitions via RPCs | Engineer (TASK-2171) |

---

## Sprint Retrospective

*To be completed after sprint close.*

### Estimation Accuracy

| Task | Est. Tokens | Actual Tokens | Variance |
|------|-------------|---------------|----------|
| TASK-2171 | ~80K | - | - |
| TASK-2172 | ~70K | - | - |
| TASK-2173 | ~70K | - | - |
| TASK-2174 | ~70K | - | - |
| TASK-2175 | ~50K | - | - |
| TASK-2176 | ~70K | - | - |
| **Total** | **~410K** | - | - |

### Issues Summary

*Aggregated from task handoffs after completion.*

### What Went Well

*TBD*

### What Didn't Go Well

*TBD*

### Lessons Learned

*TBD*
