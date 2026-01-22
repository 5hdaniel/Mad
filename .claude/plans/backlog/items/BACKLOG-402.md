# BACKLOG-402: File Size Limits per Plan Tier

**Priority:** P2 (Post-Demo)
**Category:** storage / billing
**Created:** 2026-01-22
**Status:** Backlog
**Sprint:** TBD

---

## Summary

Implement file size limits for attachment uploads based on organization plan tier.

---

## Problem Statement

Currently, there are no file size limits on uploads to Supabase Storage. This could lead to:
- Storage cost overruns
- Abuse by free-tier users
- Slow upload experiences without feedback

---

## Proposed Solution

### Plan-Based Limits

| Plan | Per-File Limit | Per-Submission Limit |
|------|----------------|---------------------|
| Free/Trial | 25 MB | 100 MB |
| Pro | 100 MB | 500 MB |
| Enterprise | 500 MB | Unlimited |

### Implementation

1. **Desktop App**: Check file size before upload, show error if exceeds limit
2. **Supabase Storage Policy**: Add size check in RLS policy (if supported)
3. **Portal**: Display limit in UI, show progress with remaining quota

```typescript
// Before upload
const org = await getOrganization(orgId);
const maxFileSize = getMaxFileSize(org.plan); // returns bytes

if (file.size > maxFileSize) {
  throw new Error(`File exceeds ${formatBytes(maxFileSize)} limit for ${org.plan} plan`);
}
```

### UI Feedback

- Show file size next to each attachment
- Warning when approaching limit
- Upgrade prompt when limit exceeded

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/submissionService.ts` | Add size validation before upload |
| `broker-portal/components/AttachmentUpload.tsx` | Add size validation |
| `shared/constants/plans.ts` | Define limits per plan |

---

## Acceptance Criteria

- [ ] Free/trial users cannot upload files > 25MB
- [ ] Pro users cannot upload files > 100MB
- [ ] Clear error message shows limit and current plan
- [ ] Upgrade CTA shown when limit exceeded
- [ ] Existing large files still accessible (grandfathered)

---

## Related Items

- BACKLOG-403: Malware Scanning
- SPRINT-050: B2B Broker Portal (parent feature)
