# SPRINT-050: B2B Broker Portal - Dependency Graph

## Visual Dependency Flow

```
                              SPRINT-050: B2B Broker Portal
                              ═══════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 1: FOUNDATION                               │
│                              (Days 1-2)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────────┐                                                  │
│    │   BACKLOG-387       │                                                  │
│    │   Supabase Schema   │◄───────── BLOCKS ALL OTHER WORK                 │
│    │   (orgs, members,   │                                                  │
│    │    submissions)     │                                                  │
│    └──────────┬──────────┘                                                  │
│               │                                                             │
│               ▼                                                             │
│    ┌─────────────────────┐                                                  │
│    │   BACKLOG-388       │                                                  │
│    │   RLS Policies +    │                                                  │
│    │   Storage Bucket    │                                                  │
│    └──────────┬──────────┘                                                  │
│               │                                                             │
│               ▼                                                             │
│    ┌─────────────────────┐                                                  │
│    │   BACKLOG-389       │                                                  │
│    │   Demo Seed Data    │                                                  │
│    │   (org + users)     │                                                  │
│    └──────────┬──────────┘                                                  │
│                               │                                             │
│                               ▼                                             │
│                     ╔═════════════════╗                                    │
│                     ║  PHASE 1 DONE   ║                                    │
│                     ╚════════╤════════╝                                    │
│                              │                                             │
└──────────────────────────────┼─────────────────────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │                                          │
          ▼                                          ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│    PHASE 2A: DESKTOP SUBMISSION     │  │    PHASE 2B: BROKER PORTAL          │
│           (Days 3-7)                │  │           (Days 3-7)                │
├─────────────────────────────────────┤  ├─────────────────────────────────────┤
│                                     │  │                                     │
│ ┌───────────────────┐               │  │ ┌───────────────────┐               │
│ │   BACKLOG-390     │               │  │ │   BACKLOG-396     │               │
│ │   Local Schema    │               │  │ │   Next.js Setup   │               │
│ │   Changes         │               │  │ │   + Vercel        │               │
│ └─────────┬─────────┘               │  │ └─────────┬─────────┘               │
│           │                         │  │           │                         │
│           ▼                         │  │           ▼                         │
│ ┌───────────────────┐               │  │ ┌───────────────────┐               │
│ │   BACKLOG-393     │               │  │ │   BACKLOG-397     │               │
│ │   Attachment      │               │  │ │   Supabase Auth   │               │
│ │   Upload Service  │               │  │ │   (OAuth)         │               │
│ └─────────┬─────────┘               │  │ └─────────┬─────────┘               │
│           │                         │  │           │                         │
│           ▼                         │  │           ▼                         │
│ ┌───────────────────┐               │  │ ┌───────────────────┐               │
│ │   BACKLOG-394     │               │  │ │   BACKLOG-398     │               │
│ │   Transaction     │               │  │ │   Dashboard +     │               │
│ │   Push Service    │               │  │ │   Submission List │               │
│ └─────────┬─────────┘               │  │ └─────────┬─────────┘               │
│           │                         │  │           │                         │
│     ┌─────┴─────┐                   │  │           ▼                         │
│     │           │                   │  │ ┌───────────────────┐               │
│     ▼           ▼                   │  │ │   BACKLOG-399     │               │
│ ┌────────┐ ┌────────┐               │  │ │   Submission      │               │
│ │  391   │ │  392   │               │  │ │   Detail View     │               │
│ │ Submit │ │ Bulk   │               │  │ └─────────┬─────────┘               │
│ │ UI     │ │ Submit │               │  │           │                         │
│ │(detail)│ │ (list) │               │  │     ┌─────┴─────┐                   │
│ └────┬───┘ └────┬───┘               │  │     │           │                   │
│      │          │                   │  │     ▼           ▼                   │
│      └────┬─────┘                   │  │ ┌────────┐ ┌────────┐               │
│           │                         │  │ │  400   │ │  401   │               │
│           ▼                         │  │ │ Review │ │ Viewer │               │
│ ┌───────────────────┐               │  │ │Actions │ │(msg+   │               │
│ │   BACKLOG-395     │               │  │ │        │ │attach) │               │
│ │   Status Sync +   │               │  │ └────────┘ └────────┘               │
│ │   Review Notes    │               │  │                                     │
│ └───────────────────┘               │  │                                     │
│                                     │  │                                     │
└──────────────────────┬──────────────┘  └──────────────────┬──────────────────┘
                       │                                    │
                       └────────────────┬───────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────────────┐
                    │       PHASE 3: INTEGRATION            │
                    │           (Days 8-10)                 │
                    ├───────────────────────────────────────┤
                    │  • End-to-end testing                 │
                    │  • Demo data verification             │
                    │  • Bug fixes                          │
                    │  • Demo rehearsal                     │
                    └───────────────────────────────────────┘
```

## Detailed Dependencies Matrix

| Backlog ID | Title | Depends On | Blocks |
|------------|-------|------------|--------|
| **BACKLOG-387** | Supabase Schema | *None* | 388, 389, 390, 393, 394, 396 |
| **BACKLOG-388** | RLS Policies + Storage | 387 | 389, 393 (storage upload) |
| **BACKLOG-389** | Demo Seed Data | 387, 388 | *None* |
| **BACKLOG-390** | Desktop Local Schema | 387 | 391, 392, 395 |
| **BACKLOG-391** | Submit UI (Detail) | 390, 393, 394 | 395 |
| **BACKLOG-392** | Bulk Submit UI | 390, 393, 394 | 395 |
| **BACKLOG-393** | Attachment Upload | 387, 388 | 391, 392, 394 |
| **BACKLOG-394** | Transaction Push | 387, 393 | 391, 392 |
| **BACKLOG-395** | Status Sync | 390, 391 or 392 | *None* |
| **BACKLOG-396** | Next.js Setup | 387 (schema types) | 397, 398 |
| **BACKLOG-397** | Supabase Auth | 396 | 398, 399, 400 |
| **BACKLOG-398** | Dashboard + List | 396, 397 | 399 |
| **BACKLOG-399** | Submission Detail | 398 | 400, 401 |
| **BACKLOG-400** | Review Actions | 399 | *None* |
| **BACKLOG-401** | Message Viewer | 399 | *None* |

## Critical Path

The **critical path** (longest chain determining minimum time) is:

```
387 → 393 → 394 → 391 → 395
      ↘
       388
```

**Desktop Track:** Schema → Upload Service → Push Service → Submit UI → Status Sync

**Portal Track:** (Can run in parallel after 387)
```
387 → 396 → 397 → 398 → 399 → 400
```

## Parallel Execution Opportunities

### After Phase 1 Complete (Day 2)

| Track A: Desktop | Track B: Portal |
|------------------|-----------------|
| BACKLOG-390 (Local Schema) | BACKLOG-396 (Next.js Setup) |
| BACKLOG-393 (Upload Service) | BACKLOG-397 (Auth) |
| BACKLOG-394 (Push Service) | BACKLOG-398 (Dashboard) |
| BACKLOG-391/392 (Submit UI) | BACKLOG-399 (Detail View) |
| BACKLOG-395 (Status Sync) | BACKLOG-400/401 (Actions/Viewer) |

### Same-Day Parallel (Within Tracks)

- **Day 3-4:** 390 + 396 (completely independent)
- **Day 4-5:** 393 + 397 (both need schema, no conflicts)
- **Day 5-6:** 394 + 398 (data flow established)
- **Day 6-7:** 391 + 399 (UI implementations)
- **Day 7:** 395 + 400 + 401 (final features)

## Execution Order (Recommended)

### Sequential Order (If Single Developer)

1. BACKLOG-387 - Supabase Schema
2. BACKLOG-388 - RLS Policies
3. BACKLOG-389 - Demo Seed Data
4. BACKLOG-390 - Local Schema
5. BACKLOG-393 - Attachment Upload
6. BACKLOG-394 - Transaction Push
7. BACKLOG-396 - Next.js Setup
8. BACKLOG-397 - Auth
9. BACKLOG-391 - Submit UI
10. BACKLOG-398 - Dashboard
11. BACKLOG-399 - Detail View
12. BACKLOG-392 - Bulk Submit (if time)
13. BACKLOG-400 - Review Actions
14. BACKLOG-395 - Status Sync
15. BACKLOG-401 - Viewer (if time)

### Priority Order (If Cutting Scope)

**Must Have (Demo Fails Without):**
1. 387 - Schema
2. 388 - RLS
3. 389 - Seed Data
4. 390 - Local Schema
5. 393 - Upload
6. 394 - Push
7. 396 - Next.js
8. 397 - Auth
9. 391 - Submit UI (detail only)
10. 398 - Dashboard
11. 399 - Detail View
12. 400 - Review Actions
13. 395 - Status Sync

**Nice to Have:**
14. 392 - Bulk Submit
15. 401 - Full Viewer

## Risk Dependencies

| Risk | Related Items | Mitigation |
|------|---------------|------------|
| Schema needs iteration | 387 blocks everything | Review with SR Engineer before coding |
| RLS blocks uploads | 388 → 393 | Test policies early |
| Auth issues | 397 → 398, 399, 400 | Use simple OAuth, test early |
| Integration failures | 395 ↔ 400 | Test end-to-end on Day 6 |
