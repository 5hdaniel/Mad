# SPRINT-Q: Email Caching + Feature Requests (2026-03-25)

**Sprint ID (Supabase):** `1ada79cd-455b-4b3b-8146-1b16cc35267f`
**Date:** 2026-03-25
**Status:** Active
**Project:** Identity & Provisioning (`20addf00-7581-44c7-8419-1e31180dbad5`)
**Integration Branch:** `int/sprint-q`
**Base Branch:** `develop` (v2.11.1)

---

## Sprint Goal

Wire up the email cache duration setting so it actually controls email fetch depth, pre-cache emails after onboarding with a Force Re-cache button, show +N badges on contact cards for multiple emails/phones, enable CI efficiency improvements (husky pre-push hooks, merge queue evaluation), and address three user feature requests from support tickets (audit summary changes, search UX, master PDF export).

---

## In-Scope Items

| # | Task | Backlog | Title | Area | Type | Priority | Est. Tokens | Phase |
|---|------|---------|-------|------|------|----------|-------------|-------|
| 1 | TASK-2321 | BACKLOG-1360 | Show +N badge on contact cards | desktop (src/) | feature | medium | ~25K | 1 (Parallel) |
| 2 | TASK-2322 | BACKLOG-1361 | Wire up email cache duration setting | desktop (electron/ + src/) | bug | high | ~30K | 1 (Parallel) |
| 3 | TASK-2323 | BACKLOG-1357 | CI efficiency: husky pre-push hook + merge queue | ci/tooling | chore | high | ~15K | 1 (Parallel) |
| 4 | TASK-2324 | BACKLOG-1362 | Pre-cache emails + Force Re-cache button | desktop (electron/ + src/) | feature | high | ~40K | 2 (After TASK-2322) |
| 5 | TASK-2325 | BACKLOG-1363 | Audit Summary: remove prices, add contacts | desktop (src/ + electron/) | feature | medium | ~30K | 3 (Parallel) |
| 6 | TASK-2326 | BACKLOG-1364 | Search UX: toggle street search / clearer Add Manually | desktop (src/) | feature | medium | ~20K | 3 (Parallel) |
| 7 | TASK-2327 | BACKLOG-1365 | Master text + email export to PDF | desktop (electron/ + src/) | feature | high | ~50K | 3 (Parallel) |

**Total Estimated Tokens:** ~210K

---

## Out of Scope / Deferred

- Auto-assign default roles (BACKLOG-1355 / TASK-2320 from SPRINT-P — stays in SPRINT-P)
- Edit/delete internal comments (BACKLOG-1344 / TASK-2315 — stays in SPRINT-P)
- CI health dashboard (medium effort from BACKLOG-1357 body — larger effort, future sprint)
- Platform-aware test utilities (from BACKLOG-1357 — separate effort)

---

## Dependency Graph

```
Phase 1 (Parallel — no shared files between tasks)
├── TASK-2321: +N badge on contact cards (src/components/contact/, electron/services/db/transactionContactDbService.ts)
├── TASK-2322: Wire up email cache duration (electron/services/emailSyncService.ts, electron/handlers/emailSyncHandlers.ts, src/components/settings/)
└── TASK-2323: CI efficiency / husky pre-push (.husky/, package.json, .github/)

Phase 2 (Sequential — depends on Phase 1 / TASK-2322)
└── TASK-2324: Pre-cache emails + Force Re-cache (electron/services/emailSyncService.ts, electron/handlers/, src/components/settings/)
    └── BLOCKED BY: TASK-2322 (needs the wired-up cache duration setting)

Phase 3 (Parallel — independent feature requests, no shared files)
├── TASK-2325: Audit Summary changes (src/components/transactionDetailsModule/, electron/utils/exportUtils.ts)
├── TASK-2326: Search UX improvements (src/components/StartNewAuditModal.tsx, src/components/shared/ContactSearchList.tsx)
└── TASK-2327: Master PDF export (electron/services/ new export service, src/components/ new export UI)
```

### Why This Grouping?

**Phase 1 tasks are parallel-safe:**
- TASK-2321 touches contact card UI and the transactionContactDbService SQL — isolated from email settings
- TASK-2322 touches email sync service and email settings — isolated from contacts
- TASK-2323 touches CI config / husky — no overlap with any src/ or electron/ production code

**Phase 2 is sequential:**
- TASK-2324 needs the email cache duration setting wired up (from TASK-2322) to know how far back to pre-cache

**Phase 3 tasks are parallel-safe:**
- TASK-2325 modifies audit summary view — isolated
- TASK-2326 modifies search/add-manually UX — different components from 2325
- TASK-2327 creates new export service and UI — no overlap with 2325/2326

---

## Branch Strategy

**All branches from `int/sprint-q`, all PRs target `int/sprint-q`.**

After all sprint work is merged to `int/sprint-q`, one final PR from `int/sprint-q` to `develop`.

| Task | Branch Name | Target |
|------|-------------|--------|
| TASK-2321 | `feature/task-2321-contact-badge` | `int/sprint-q` |
| TASK-2322 | `fix/task-2322-email-cache-setting` | `int/sprint-q` |
| TASK-2323 | `chore/task-2323-ci-husky-prepush` | `int/sprint-q` |
| TASK-2324 | `feature/task-2324-email-precache` | `int/sprint-q` |
| TASK-2325 | `feature/task-2325-audit-summary-contacts` | `int/sprint-q` |
| TASK-2326 | `feature/task-2326-search-ux-manual-add` | `int/sprint-q` |
| TASK-2327 | `feature/task-2327-master-pdf-export` | `int/sprint-q` |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TASK-2324 scope creep (background sync complexity) | Medium | Medium | Strict non-goals: no retry logic, no progress UI beyond spinner |
| TASK-2327 PDF generation library selection | Medium | High | Investigate existing deps first; pdfkit or jspdf likely candidates |
| TASK-2322/2324 shared file conflict | Low | Medium | Sequential execution enforced by dependency |
| TASK-2326 unclear user pain point | Medium | Low | Investigation-first approach; may defer if UX is already adequate |
| Phase 3 feature requests need user feedback | Medium | Medium | Create task files with clear scope; flag for user review before implementation |

---

## Testing & Quality Plan

| Task | Unit Tests | Manual Testing | CI Gates |
|------|-----------|----------------|----------|
| TASK-2321 | Update transactionContactDbService tests for count subquery | Verify +N badge renders on contacts with multiple emails/phones | type-check, lint, test |
| TASK-2322 | Test that emailSyncService reads durationMonths from preferences | Change setting, trigger email fetch, verify date range matches | type-check, lint, test |
| TASK-2323 | N/A (config change) | Push without running tests locally, verify hook blocks push | CI passes with new config |
| TASK-2324 | Test pre-cache trigger after email connection | Connect email, verify background cache starts; click Force Re-cache | type-check, lint, test |
| TASK-2325 | Test export output includes contacts, excludes prices | Generate audit summary, verify no Sale/List Price, contacts present | type-check, lint, test |
| TASK-2326 | Test search toggle/manual-add flow | Try add-manually path, verify clearer UX | type-check, lint, test |
| TASK-2327 | Test PDF generation with mock data | Export combined PDF, verify summary + emails + texts | type-check, lint, test |

---

## Completion Tracking

| Task | Status | PR | Merged |
|------|--------|----|--------|
| TASK-2321 | Pending | | |
| TASK-2322 | Pending | | |
| TASK-2323 | Pending | | |
| TASK-2324 | Pending (blocked by 2322) | | |
| TASK-2325 | Pending | | |
| TASK-2326 | Pending | | |
| TASK-2327 | Pending | | |
