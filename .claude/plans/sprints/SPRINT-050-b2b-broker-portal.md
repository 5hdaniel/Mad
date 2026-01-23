# SPRINT-050: B2B Broker Portal Demo

**Created**: 2026-01-22
**Updated**: 2026-01-23
**Status**: Completed
**Completed**: 2026-01-23
**Goal**: Working demo of agent submission + broker review (full round-trip workflow)
**Duration**: 10 days (special demo sprint)
**Branch Strategy**: `project/b2b-portal`

---

## Sprint Overview

This sprint pivots Magic Audit from B2C to B2B by building:
1. **Broker Review Portal** - Next.js web app on Vercel
2. **Transaction Cloud Submission** - Desktop to Supabase
3. **Organization & Role Model** - Multi-tenant architecture
4. **Status Sync** - Agent sees broker feedback in desktop app

### Demo Scenario (End-to-End)

```
1. Agent A (desktop app) completes a transaction audit
2. Agent A clicks "Submit for Review"
3. Files + data upload to Supabase
4. Broker (web portal) sees new submission in dashboard
5. Broker opens submission, reviews messages + attachments
6. Broker clicks "Request Changes" with notes: "Missing inspection report"
7. Agent A sees status change + notes in desktop app
8. Agent A adds missing document, resubmits
9. Broker approves resubmission
10. Transaction archived for compliance
```

---

## Phase Structure

### Phase 1: Foundation (Days 1-2)
**Goal**: Supabase infrastructure ready for development

| Backlog | Title | Est. Tokens | Priority |
|---------|-------|-------------|----------|
| BACKLOG-387 | Supabase Schema (orgs, members, submissions, messages, attachments) | ~25K | P0 |
| BACKLOG-388 | RLS Policies + Storage Bucket | ~20K | P0 |
| BACKLOG-389 | Demo Seed Data (org + users) | ~10K | P0 |

**Phase 1 Total**: ~55K tokens

### Phase 2A: Desktop Submission (Days 3-7)
**Goal**: Agent can submit transactions for broker review

| Backlog | Title | Est. Tokens | Priority |
|---------|-------|-------------|----------|
| BACKLOG-390 | Desktop - Local Schema Changes | ~15K | P0 |
| BACKLOG-391 | Desktop - Submit for Review UI (detail page) | ~25K | P0 |
| BACKLOG-392 | Desktop - Bulk Submit UI (list page) | ~20K | P1 |
| BACKLOG-393 | Desktop - Attachment Upload Service | ~30K | P0 |
| BACKLOG-394 | Desktop - Transaction Push Service | ~35K | P0 |
| BACKLOG-395 | Desktop - Status Sync + Review Notes Display | ~25K | P0 |

**Phase 2A Total**: ~150K tokens

### Phase 2B: Broker Portal (Days 3-7)
**Goal**: Broker can review and action submissions

| Backlog | Title | Est. Tokens | Priority |
|---------|-------|-------------|----------|
| BACKLOG-396 | Portal - Next.js Setup + Vercel Deploy | ~25K | P0 |
| BACKLOG-397 | Portal - Supabase Auth (OAuth) | ~20K | P0 |
| BACKLOG-398 | Portal - Dashboard + Submission List | ~30K | P0 |
| BACKLOG-399 | Portal - Submission Detail View | ~35K | P0 |
| BACKLOG-400 | Portal - Review Actions (Approve/Reject/Changes) | ~25K | P0 |
| BACKLOG-401 | Portal - Message & Attachment Viewer | ~30K | P1 |

**Phase 2B Total**: ~165K tokens

### Phase 3: Integration & Polish (Days 8-10)
**Goal**: End-to-end demo ready

- End-to-end testing
- Demo data setup
- Bug fixes
- Demo rehearsal

**Phase 3 Total**: ~50K tokens (contingency)

---

## Dependency Graph

```
                           LEGEND
                    ────────────────────
                    --> Hard dependency (must complete first)
                    ... Soft dependency (recommended order)
                    |   Independent (parallel safe)


    PHASE 1 - FOUNDATION (Sequential)
    ==================================

    ┌─────────────┐
    │ BACKLOG-387 │  Supabase Schema
    │  (schema)   │  Creates all tables
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-388 │  RLS Policies + Storage
    │   (rls)     │  Depends on tables existing
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-389 │  Demo Seed Data
    │   (seed)    │  Depends on policies in place
    └─────────────┘
           │
           ▼

    PHASE 2A - DESKTOP (Sequential, touches same codebase)
    ======================================================

    ┌─────────────┐
    │ BACKLOG-390 │  Local Schema Changes
    │  (schema)   │  submission_status fields
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-393 │  Attachment Upload Service
    │  (service)  │  Supabase Storage integration
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-394 │  Transaction Push Service
    │  (service)  │  Uses attachment service
    └──────┬──────┘
           │
           ├──────────────────────────────────┐
           ▼                                  ▼
    ┌─────────────┐                    ┌─────────────┐
    │ BACKLOG-391 │                    │ BACKLOG-392 │
    │ Submit UI   │                    │ Bulk Submit │
    │ (detail pg) │                    │  (list pg)  │
    └──────┬──────┘                    └──────┬──────┘
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
                   ┌─────────────┐
                   │ BACKLOG-395 │
                   │ Status Sync │
                   └─────────────┘


    PHASE 2B - BROKER PORTAL (Can run parallel to 2A after 388)
    ===========================================================

    ┌─────────────┐
    │ BACKLOG-396 │  Next.js Setup
    │  (setup)    │  Creates broker-portal/
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-397 │  Supabase Auth
    │   (auth)    │  OAuth integration
    └──────┬──────┘
           │
           ├──────────────────────────────────┐
           ▼                                  ▼
    ┌─────────────┐                    ┌─────────────┐
    │ BACKLOG-398 │                    │ BACKLOG-401 │
    │  Dashboard  │                    │ Msg Viewer  │
    │  + List     │                    │ (component) │
    └──────┬──────┘                    └──────┬──────┘
           │                                  │
           ▼                                  │
    ┌─────────────┐                           │
    │ BACKLOG-399 │  ◄────────────────────────┘
    │   Detail    │  (uses message viewer)
    │    View     │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ BACKLOG-400 │
    │   Review    │
    │  Actions    │
    └─────────────┘
```

---

## Parallel Execution Strategy

### Phase 1: Sequential (Required)

Schema must be complete before RLS, RLS before seed data.

```
TIME -->
[387 Schema] --> [388 RLS] --> [389 Seed]
```

### Phase 2: Two Parallel Tracks

After Phase 1 completes, Desktop and Portal can be developed in parallel.

```
TIME -->

Track A (Desktop) - project/b2b-portal-desktop worktree:
    [390] --> [393] --> [394] --> [391] --> [395]
                                      |
                                      └--> [392] (parallel with 391)

Track B (Portal) - project/b2b-portal-web worktree:
    [396] --> [397] --> [398] --> [399] --> [400]
                   |
                   └--> [401] (parallel with 398)
```

**Worktree Setup:**
```bash
# After Phase 1 merges to project/b2b-portal:

# Desktop track
git worktree add ../Mad-b2b-desktop -b project/b2b-portal-desktop project/b2b-portal

# Portal track
git worktree add ../Mad-b2b-web -b project/b2b-portal-web project/b2b-portal
```

### Phase 3: Integration

Merge both tracks back to `project/b2b-portal`, then integration testing.

---

## Branch Strategy

```
develop
    │
    └── project/b2b-portal (main integration branch)
            │
            ├── project/b2b-portal-desktop (Phase 2A work)
            │       └── feature/TASK-XXX-*
            │
            └── project/b2b-portal-web (Phase 2B work)
                    └── feature/TASK-XXX-*
```

**Merge Flow:**
1. Feature branches merge to their phase branch (via PR)
2. Phase branches merge to `project/b2b-portal` (via PR)
3. After demo, `project/b2b-portal` merges to `develop` (via PR)

---

## File Conflict Matrix

| File/Area | Backlog Items | Resolution |
|-----------|---------------|------------|
| `supabase/migrations/*.sql` | 387, 388, 389 | Sequential - different migration files |
| `electron/services/databaseService.ts` | 390 | Only 390 modifies |
| `electron/services/supabaseStorageService.ts` | 393 | New file - no conflict |
| `electron/services/submissionService.ts` | 394 | New file - no conflict |
| `src/components/TransactionDetails*.tsx` | 391, 395 | Sequential in Track A |
| `src/components/Transactions.tsx` | 392 | Only 392 modifies |
| `broker-portal/*` | 396-401 | Isolated - Track B only |

---

## Technical Notes

### SR Engineer Requirements (From Plan Review)

**Schema Additions:**
- Add `version` and `parent_submission_id` to `transaction_submissions` (for resubmission tracking)
- Add `submission_comments` table (for broker feedback threads)
- Add `invited_email`, `invitation_token` to `organization_members` (for invite flow)

**Acceptable for Demo:**
| Item | Status | Production Migration |
|------|--------|---------------------|
| Service key for desktop submission | Acceptable | Must migrate to proper Supabase Auth |
| Polling instead of realtime | Acceptable | Add Supabase Realtime subscriptions |
| No chunked uploads | Acceptable | Add for large attachments |
| Basic error handling | Acceptable | Add comprehensive retry logic |

**Must Document:**
- Desktop auth migration path (service key -> user JWT)
- Storage path conventions: `{org_id}/{submission_id}/{filename}`
- RLS policy testing procedures

### Database Schema Summary

**New Tables:**
1. `organizations` - Broker firms
2. `organization_members` - User-org junction with roles
3. `transaction_submissions` - Cloud copy of submitted transactions
4. `submission_messages` - Communications for review
5. `submission_attachments` - Documents in Supabase Storage
6. `submission_comments` - Broker feedback (SR addition)

**Local SQLite Changes:**
```sql
ALTER TABLE transactions ADD COLUMN submission_status TEXT DEFAULT 'not_submitted';
ALTER TABLE transactions ADD COLUMN submission_id TEXT;
ALTER TABLE transactions ADD COLUMN submitted_at TEXT;
ALTER TABLE transactions ADD COLUMN last_review_notes TEXT;
```

### Monorepo Structure

```
Mad/
├── electron/              # Desktop main process (unchanged)
├── src/                   # Desktop renderer (unchanged)
├── broker-portal/         # NEW: Next.js web app (isolated)
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json       # Own dependencies
├── shared/                # NEW: Shared TypeScript types only
│   └── types/
│       └── submissions.ts
├── supabase/              # Database migrations
└── electron-builder.yml   # Only bundles electron/ + src/
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Auth complexity (service key vs JWT) | HIGH | Keep for demo, document migration path |
| RLS policies blocking legitimate access | HIGH | Test with both agent and broker users |
| Two-database consistency | MEDIUM | Local is source of truth, cloud is snapshot |
| Attachment upload failures | MEDIUM | Retry logic, progress indication |
| Parallel track divergence | MEDIUM | Daily merges to integration branch |

---

## Success Criteria

### Must Have (Demo Day)
- [ ] Agent can submit transaction from desktop app
- [ ] Attachments upload to Supabase Storage
- [ ] Broker sees submission in web portal
- [ ] Broker can view messages and attachments
- [ ] Broker can approve, reject, or request changes
- [ ] Agent sees status update and review notes
- [ ] Resubmission workflow works

### Should Have
- [ ] Bulk submit from transaction list
- [ ] Professional portal UI
- [ ] Submission history in portal

### Nice to Have
- [ ] Realtime status updates (vs polling)
- [ ] Email notifications

---

## Verification Plan

### Desktop App
- [ ] Submit transaction with 2+ messages and 1+ attachment
- [ ] Verify data appears in Supabase tables
- [ ] Verify files in Supabase Storage
- [ ] Check status updates sync back
- [ ] Test resubmission flow

### Broker Portal
- [ ] Login with Google/Microsoft
- [ ] View submission list (empty state, populated)
- [ ] Open submission detail
- [ ] View messages and attachments
- [ ] Approve a submission
- [ ] Reject with notes
- [ ] Request changes with notes
- [ ] Verify status change visible to agent

### Integration
- [ ] Full demo scenario (10 steps above)
- [ ] Multiple agents, one broker
- [ ] Edge cases: large attachments, many messages

---

## Estimated Effort

| Phase | Est. Tokens | Days |
|-------|-------------|------|
| Phase 1: Foundation | ~55K | 2 |
| Phase 2A: Desktop | ~150K | 5 |
| Phase 2B: Portal | ~165K | 5 |
| Phase 3: Polish | ~50K | 3 |
| **Total** | **~420K** | **10** |

Note: Phase 2A and 2B run in parallel, so actual timeline is ~10 days total.

---

## SR Engineer Review Checklist

Before execution, SR Engineer must validate:

- [ ] Dependency graph is accurate
- [ ] File conflict matrix is complete
- [ ] Parallel execution groups are safe
- [ ] Token estimates are reasonable
- [ ] Database schema changes are properly sequenced
- [ ] No hidden dependencies missed
- [ ] Monorepo setup won't break Electron build
- [ ] RLS policies tested with test users

---

## Deferred Items

| Item | Reason |
|------|--------|
| SSO (SAML) | Post-demo enterprise feature |
| SCIM provisioning | Post-demo enterprise feature |
| Billing & payments | Post-demo |
| Full license lifecycle | Post-demo |
| Retention enforcement | Post-demo |
| Chunked uploads | Only needed for very large files |
| Email notifications | Polling is acceptable for demo |

---

## Related Documentation

- **Architecture Plan**: `/Users/daniel/.claude/plans/composed-giggling-aurora.md`
- **Supabase Migrations**: `supabase/migrations/`
- **Existing Auth**: `electron/services/supabaseService.ts`
