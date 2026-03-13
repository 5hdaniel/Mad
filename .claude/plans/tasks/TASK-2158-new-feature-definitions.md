# TASK-2158: Broker Portal Feature Key Updates + broker_portal_access Gate

**Sprint:** SPRINT-127
**Backlog:** BACKLOG-930, BACKLOG-932
**Phase:** Phase 2
**Branch:** `feature/task-2158-new-feature-definitions`
**Status:** Completed
**Estimated Effort:** ~35K tokens

---

## Summary

Update the broker portal to use the renamed feature keys (`broker_text_view`, `broker_email_view`, etc.) and add the `broker_portal_access` gate that controls org-level data visibility on submissions pages.

## Prerequisites

- TASK-2156 merged (feature keys renamed in DB, broker_portal_access feature definition exists)

---

## Scope

### 1. Broker Portal Feature Key Updates
Update `broker-portal/app/dashboard/submissions/[id]/page.tsx` to use renamed keys:
- `text_export` → `broker_text_view`
- `email_export` → `broker_email_view`
- `text_attachments` → `broker_text_attachments`
- `email_attachments` → `broker_email_attachments`

Also update `broker-portal/lib/feature-gate.ts` if it references old key names.

### 2. broker_portal_access Gate — Submission Detail Page
On `submissions/[id]/page.tsx`:
- Check `broker_portal_access` for the org that owns the submission
- If disabled, show: "Submission data not available for this organization's plan"
- If enabled, render normally (with existing broker_text_view/broker_email_view gates)

### 3. broker_portal_access Gate — Submissions List Page
On `submissions/page.tsx`:
- This page currently has NO feature gating
- Filter out submissions from orgs whose plans don't have `broker_portal_access` enabled
- This requires checking each org's features — may need to batch-fetch org features or filter server-side

### 4. NOT in Scope
- `electron/services/featureGateService.ts` does NOT need changes — it's key-agnostic (confirmed by SR review)
- No migration changes needed — TASK-2156 already renamed keys and created broker_portal_access

---

## Files to Modify

- `broker-portal/lib/feature-gate.ts` — update any hardcoded old key references
- `broker-portal/app/dashboard/submissions/[id]/page.tsx` — rename keys + add broker_portal_access gate
- `broker-portal/app/dashboard/submissions/page.tsx` — add broker_portal_access filtering

## Files NOT to Modify

- No electron/ changes
- No src/ changes
- No admin-portal/ changes
- No Supabase migrations
- NOT `electron/services/featureGateService.ts` (it's key-agnostic)

---

## Key Design Decision

When `broker_portal_access` is disabled for an org:
- The broker CANNOT see that org's submissions (filtered from list, blocked on detail)
- The broker portal itself REMAINS accessible for user management and global settings
- Only submission/data viewing pages are gated

---

## Testing Checklist

- [ ] Submission detail page uses `broker_text_view` (not `text_export`)
- [ ] Submission detail page uses `broker_email_view` (not `email_export`)
- [ ] Submission detail page uses `broker_text_attachments` / `broker_email_attachments`
- [ ] broker_portal_access disabled → detail page shows blocked message
- [ ] broker_portal_access disabled → submissions list filters out that org's submissions
- [ ] broker_portal_access enabled → everything works normally
- [ ] Team/enterprise plans have broker_portal_access enabled (default)
- [ ] Individual plans do NOT have broker_portal_access enabled
- [ ] Broker portal builds: `cd broker-portal && npx next build`
- [ ] Broker portal type-checks: `cd broker-portal && npx tsc --noEmit`
