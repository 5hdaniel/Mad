# BACKLOG-938: Support Platform — Core Ticketing MVP (Phase 1)

**Priority:** High
**Type:** Feature
**Area:** Service
**Status:** In Progress
**Created:** 2026-03-13

---

## Summary

Build the core ticketing system for `support.keeprcompliance.com`. Phase 1 delivers web form intake, agent dashboard, customer portal, and manual ticket management — no email integration, no SLA engine, no auto-assignment.

---

## Context & Decision History

### Why Build (Not Buy)

Evaluated Zendesk/Freshdesk (~$7K/year, 3-4 weeks integration) vs custom build (~8-14 weeks with Claude agents). Chose build because:
- Full control over UX and data (no vendor lock-in)
- Deep integration with existing Keepr user/org/plan model
- Zero licensing cost
- Claude agents reduce effort from ~40 weeks (human estimate) to ~8-14 weeks
- Existing codebase provides significant leverage (RBAC, auth, audit logs, Supabase patterns)

### Why M365/Graph for Email (Phase 3)

- Already have Graph API integration in codebase (`electron/outlookService.ts`)
- Rate limiting already implemented (`electron/utils/apiRateLimit.ts`)
- No additional vendor cost (included in M365 license)
- SPF/DKIM/DMARC already configured for domain
- Replaces original plan to use Resend/Postmark

### Why Extend Admin Portal (Not Standalone App)

- Admin portal has: AuthProvider, PermissionsProvider, RBAC middleware, audit logging, Supabase SSR, sidebar layout
- Customer portal goes in broker portal (customers already authenticate there)
- Saves 2-3 sprints of infrastructure that would be rebuilt from scratch

---

## Architecture

- **Agent dashboard**: `admin-portal/app/dashboard/support/`
- **Customer portal**: `broker-portal/app/support/`
- **Database**: Same Supabase project, 6 new tables, 7 RPCs, ~25 RLS policies
- **Storage**: `support-attachments` Supabase Storage bucket

---

## Linked Documents

| Document | Purpose |
|----------|---------|
| [FEATURE-support-tool.md](../../features/FEATURE-support-tool.md) | Full feature plan with all phases, schema details, architecture |
| [REQUIREMENTS-support-ticketing-v1.md](../../features/REQUIREMENTS-support-ticketing-v1.md) | Original stakeholder requirements (preserved verbatim) |

---

## Phase 1 Sprint Plan

| Sprint | Scope | Tasks | Est. Sessions |
|--------|-------|-------|---------------|
| **Sprint 1: Foundation** | DB schema (6 tables), RLS policies, RPCs (7), storage bucket, RBAC permissions, seed categories | 5 tasks | 1-2 |
| **Sprint 2: Agent Dashboard** | Ticket queue, ticket detail, conversation thread, reply composer, status/assignment controls | 5 tasks | 1-2 |
| **Sprint 3: Customer Portal** | Ticket submission form, customer ticket list, detail + reply, broker portal navigation | 5 tasks | 1-2 |
| **Sprint 4: Polish** | Attachments (both portals), full-text search, participants/CC, events timeline, E2E tests | 6 tasks | 1-2 |

**Total: 21 tasks, ~4-8 sessions**

---

## Phase 1 Scope

### Included
- Web form ticket submission (broker portal)
- Agent ticket queue with filtering (admin portal)
- Ticket detail with conversation thread
- Internal notes (agent-only, hidden from customers)
- Status state machine (New → Assigned → In Progress → Pending → Resolved → Closed)
- Manual assignment
- File attachments (upload/download via Supabase Storage)
- CC/Participants model
- Immutable audit log (ticket events)
- Full-text search on tickets
- 7 categories with subcategories
- 4 priority levels
- RBAC (5 new permission keys extending existing system)

### Explicitly Deferred
- SLA engine (timestamp fields present but no automated tracking) → Phase 2
- Email-to-ticket → Phase 3
- Email notifications → Phase 3
- Auto-assignment (round-robin, skill-based) → Phase 2
- Saved views → Phase 4
- Merge/link tickets → Phase 4
- Collision warnings → Phase 4
- Malware scanning → Phase 4
- DSAR workflows → Phase 4
- PII masking → Phase 4
- In-app ticket submission (Electron desktop) → Phase 5

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS policy complexity | High | All mutations via RPCs; dedicated testing |
| Customer auth | Low | Public form (no auth required); auto-fills if logged in |
| No malware scanning Phase 1 | Medium | File type whitelist + size limits |

---

## Related Items

| Item | Relationship |
|------|-------------|
| BACKLOG-744 | Account management (partially complete) |
| BACKLOG-837 | Admin portal (complete — foundation) |
| BACKLOG-850 | RBAC system (complete — extending) |
| BACKLOG-838 | Impersonation (complete) |
| BACKLOG-866 | Broker portal impersonation (complete) |

---

## How to Use This Document

**Before starting any sprint work on this feature:**

1. Read this backlog item for context and scope boundaries
2. Read `FEATURE-support-tool.md` for full technical details and schema
3. Read `REQUIREMENTS-support-ticketing-v1.md` for original stakeholder requirements
4. Check the Change Log in FEATURE-support-tool.md for any updates since you last read it

**The stakeholder requirements are the source of truth for "what."**
**The feature plan is the source of truth for "how."**
**This backlog item is the source of truth for "why" and "what's in/out of scope."**
