# BACKLOG-945: Add Microsoft Clarity Analytics to Admin Portal

**Type:** feature
**Area:** admin-portal
**Priority:** low
**Status:** Pending
**Created:** 2026-03-13
**Estimated Effort:** ~8K tokens

---

## Summary

The broker portal already has Microsoft Clarity integrated via a `ClarityAnalytics` component (`@microsoft/clarity`). The admin portal has no analytics tracking at all. Add the same Clarity integration pattern to the admin portal using a separate Clarity project ID (different audience: internal team vs external customers).

---

## Scope

This is a small, self-contained task:

1. **Copy the `ClarityAnalytics` component** from `broker-portal/components/analytics/ClarityAnalytics.tsx` to `admin-portal/components/analytics/ClarityAnalytics.tsx`
2. **Add the component to the root layout** (`admin-portal/app/layout.tsx`) with the same conditional rendering pattern used in broker portal
3. **Add the `@microsoft/clarity` dependency** to admin-portal's `package.json`
4. **Add the env var** `NEXT_PUBLIC_CLARITY_PROJECT_ID` to admin-portal's `.env.local.example` (with a comment noting it should be a separate project from broker portal)
5. **Update CSP headers** in `admin-portal/next.config.mjs` to allow Clarity script/connect sources (same domains as broker portal: `https://www.clarity.ms`, `https://scripts.clarity.ms`, `https://*.clarity.ms`)

---

## Reference Implementation

Broker portal integration (the pattern to replicate):

**Component:** `broker-portal/components/analytics/ClarityAnalytics.tsx`
```tsx
'use client';
import { useEffect } from 'react';
export default function ClarityAnalytics({ projectId }: { projectId: string }) {
  useEffect(() => {
    import('@microsoft/clarity').then((module) => {
      module.default.init(projectId);
    });
  }, [projectId]);
  return null;
}
```

**Layout usage:** `broker-portal/app/layout.tsx`
```tsx
{process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
  <ClarityAnalytics projectId={process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID} />
)}
```

---

## Files Affected

| Location | Change |
|----------|--------|
| `admin-portal/components/analytics/ClarityAnalytics.tsx` | New file (copy from broker-portal) |
| `admin-portal/app/layout.tsx` | Add ClarityAnalytics import and conditional render |
| `admin-portal/package.json` | Add `@microsoft/clarity` dependency |
| `admin-portal/next.config.mjs` | Add Clarity domains to CSP headers (if CSP exists) |
| `admin-portal/.env.local.example` | Add `NEXT_PUBLIC_CLARITY_PROJECT_ID` |

---

## Acceptance Criteria

1. Admin portal renders the Clarity tracking script when `NEXT_PUBLIC_CLARITY_PROJECT_ID` is set
2. No tracking script is loaded when the env var is absent (graceful no-op)
3. Admin portal builds and type-checks (`npm run build` in admin-portal)
4. CSP headers permit Clarity script and connection domains
5. No impact on broker portal's existing Clarity integration

---

## Notes

- Use a **separate Clarity project ID** for admin portal. The admin portal tracks internal team behavior (support agents, admins), while the broker portal tracks external customer behavior. Mixing them would pollute both datasets.
- The env var name is the same (`NEXT_PUBLIC_CLARITY_PROJECT_ID`) but each portal has its own `.env.local` with its own value.
- No Vercel deployment config changes needed -- the env var just needs to be set in the Vercel project settings for the admin portal.
