# TASK-2129: Broker Portal Feature Gate Enforcement

**Backlog ID:** BACKLOG-926
**Sprint:** SPRINT-122
**Phase:** Phase 1 - All Tasks (Parallel with TASK-2127, TASK-2128)
**Depends On:** TASK-2126 (SPRINT-121 -- schema + RPCs must be merged first)
**Branch:** `feature/task-2129-broker-feature-gates`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~20K (service category x 0.5 = ~10K base, +10K for UI gating = ~25K adjusted)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add server-side feature gate enforcement to the broker portal so that gated features (export buttons, attachment sections, call log tab) are not rendered when the organization's plan does not include them. Use the `get_org_features` RPC to fetch the org's feature set server-side and conditionally render UI elements.

## Non-Goals

- Do NOT modify the Supabase schema -- that is SPRINT-118 TASK-2126
- Do NOT build admin portal UI -- that is TASK-2127
- Do NOT build desktop app enforcement -- that is TASK-2128
- Do NOT add billing/payment flows
- Do NOT add client-side feature flag caching (server components check on each render)
- Do NOT modify any `electron/`, `src/`, or `admin-portal/` files

## Deliverables

1. New file: `broker-portal/lib/feature-gate.ts` -- Feature gate utility (server-side)
2. Update: Submission detail page(s) -- Conditionally render export and attachment sections
3. Update: Any pages that show call log data -- Conditionally render based on feature flag
4. New file: `broker-portal/components/ui/FeatureGated.tsx` -- Wrapper component for gated sections

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/lib/feature-gate.ts` (new)
- `broker-portal/components/ui/FeatureGated.tsx` (new)
- `broker-portal/app/dashboard/submissions/[id]/page.tsx` (conditionally render exports/attachments)
- Other broker-portal pages that display gated features (identify during planning)

### Files this task must NOT modify:

- Any `admin-portal/` files -- Owned by TASK-2127
- Any `electron/` or `src/` files -- Owned by TASK-2128
- Any `supabase/` files -- Schema is already done (TASK-2126)
- `broker-portal/middleware.ts` -- No middleware changes needed

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `getOrgFeatures(orgId)` utility function exists in `broker-portal/lib/feature-gate.ts`
- [ ] `isFeatureEnabled(features, key)` helper returns boolean for a given feature key
- [ ] Submission detail page does NOT render export buttons when `text_export` / `email_export` is disabled
- [ ] Submission detail page does NOT render attachment sections when `text_attachments` / `email_attachments` is disabled
- [ ] Call log section (if it exists in broker portal) is hidden when `call_log` is disabled
- [ ] `FeatureGated` wrapper component conditionally renders children based on feature access
- [ ] Feature checks happen server-side in server components (no client-side exposure of gating logic)
- [ ] When a feature is gated, the UI section is simply not rendered (no upgrade prompt -- broker users contact their admin)
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass (type-check, lint, build in broker-portal)

## Implementation Notes

### Feature Gate Utility

```typescript
// broker-portal/lib/feature-gate.ts
import { createClient } from '@/lib/supabase/server';

export interface OrgFeatures {
  org_id: string;
  plan_name: string;
  plan_tier: string;
  features: Record<string, {
    enabled: boolean;
    value: string;
    value_type: string;
    name: string;
    source: string;
  }>;
}

export async function getOrgFeatures(orgId: string): Promise<OrgFeatures> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_org_features', {
    p_org_id: orgId,
  });

  if (error) {
    // Fail-open: if we can't check features, allow everything
    console.error('Failed to fetch org features:', error);
    return {
      org_id: orgId,
      plan_name: 'unknown',
      plan_tier: 'unknown',
      features: {},
    };
  }

  return data as OrgFeatures;
}

export function isFeatureEnabled(features: OrgFeatures, featureKey: string): boolean {
  const feature = features.features[featureKey];
  if (!feature) return true; // Unknown feature = allow (fail-open)
  return feature.enabled;
}

export function getFeatureValue(features: OrgFeatures, featureKey: string): string | null {
  const feature = features.features[featureKey];
  if (!feature) return null;
  return feature.value;
}
```

### FeatureGated Wrapper Component

```tsx
// broker-portal/components/ui/FeatureGated.tsx

interface FeatureGatedProps {
  features: OrgFeatures;
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode; // Optional: show something when gated (default: nothing)
}

export function FeatureGated({ features, featureKey, children, fallback = null }: FeatureGatedProps) {
  if (!isFeatureEnabled(features, featureKey)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
```

### Integration in Submission Detail Page

```tsx
// In broker-portal/app/dashboard/submissions/[id]/page.tsx
// 1. Fetch org features alongside submission data
const orgFeatures = await getOrgFeatures(submission.organization_id);

// 2. Wrap gated sections
<FeatureGated features={orgFeatures} featureKey="text_export">
  <ExportButton type="text" ... />
</FeatureGated>

<FeatureGated features={orgFeatures} featureKey="email_export">
  <ExportButton type="email" ... />
</FeatureGated>

<FeatureGated features={orgFeatures} featureKey="text_attachments">
  <AttachmentSection type="text" ... />
</FeatureGated>
```

### Pattern Reference

Look at existing broker portal pages:
- `broker-portal/app/dashboard/submissions/[id]/page.tsx` for server component patterns
- `broker-portal/lib/` for utility file patterns
- `broker-portal/components/` for component patterns

### Important Details

- The broker portal uses Next.js server components -- feature checks happen on the server, not in client JavaScript
- The `get_org_features` RPC exists from TASK-2126
- The authenticated user's org_id should be derivable from the Supabase session or the submission's `organization_id`
- Fail-open: if the RPC call fails, render everything (don't block users due to a feature check error)
- No upgrade prompts in broker portal -- brokers contact their admin to upgrade

## Integration Notes

- **Depends on:** TASK-2126 (schema -- `get_org_features` RPC must exist)
- **Independent of:** TASK-2127 (admin UI), TASK-2128 (desktop enforcement)
- **Uses:** Supabase server client for RPC calls
- **Uses:** Existing broker portal server component patterns

## Do / Don't

### Do:
- Follow existing broker portal server component patterns
- Check features server-side (in server components, NOT in client components)
- Fail-open when RPC call fails
- Use the `FeatureGated` wrapper for clean conditional rendering
- Keep the feature gate utility simple and reusable

### Don't:
- Do NOT expose feature gate logic in client-side JavaScript
- Do NOT show upgrade prompts in the broker portal (unlike desktop app)
- Do NOT modify admin-portal or electron files
- Do NOT cache features in middleware (check per-request in server components)
- Do NOT block page rendering if feature check fails -- show everything

## When to Stop and Ask

- If `get_org_features` RPC does not exist (TASK-2126 not merged)
- If the broker portal does not have a submissions detail page or export functionality
- If the broker portal page structure differs significantly from expectations
- If you cannot determine the org_id from the server component context
- If the broker portal has no existing export or attachment sections to gate

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (broker portal currently has no test infrastructure)
- If test setup exists, add tests for `isFeatureEnabled` and `getFeatureValue` helpers

### Coverage

- Coverage impact: N/A for broker portal

### Integration / Feature Tests

- Manual verification:
  - Submission page renders normally when all features enabled
  - Export buttons hidden when `text_export` / `email_export` disabled
  - Attachment sections hidden when `text_attachments` / `email_attachments` disabled
  - Page still loads when RPC call fails (fail-open)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check` or `npx tsc --noEmit` in broker-portal)
- [ ] Lint checks (`npm run lint` in broker-portal)
- [ ] Build succeeds (`npm run build` in broker-portal)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker): add server-side feature gate enforcement`
- **Labels**: `broker-portal`, `sprint-119`
- **Depends on**: TASK-2126 (schema must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (utility, wrapper component) | +5K |
| Files to modify | 2-4 pages (small conditional rendering changes) | +10K |
| Code volume | ~100 lines new, ~30 lines modified per page | +5K |
| Test complexity | None (manual testing) | 0K |
| Service multiplier | x 0.5 | Applied |

**Confidence:** Medium-High

**Risk factors:**
- Number of broker portal pages with gated features is unclear
- Server component data fetching pattern may vary

**Similar past tasks:** TASK-2124 (broker portal impersonation session, ~35K -- but that was more complex)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] broker-portal/lib/feature-gate.ts
- [ ] broker-portal/components/ui/FeatureGated.tsx

Files modified:
- [ ] broker-portal/app/dashboard/submissions/[id]/page.tsx
- [ ] (other pages with gated features -- list during planning)

Features implemented:
- [ ] getOrgFeatures utility function
- [ ] isFeatureEnabled / getFeatureValue helpers
- [ ] FeatureGated wrapper component
- [ ] Export button gating
- [ ] Attachment section gating
- [ ] Call log gating (if applicable)

Verification:
- [ ] npm run type-check passes (in broker-portal/)
- [ ] npm run lint passes (in broker-portal/)
- [ ] npm run build passes (in broker-portal/)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
