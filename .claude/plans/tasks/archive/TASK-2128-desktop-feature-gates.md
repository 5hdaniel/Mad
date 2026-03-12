# TASK-2128: Desktop App Feature Gate Enforcement (Electron)

> **[COMPLETED 2026-03-11]** All 7 bugs fixed via TASK-2153 rework. PR #1124 merged to develop.
> User tested and verified feature gates work.

**Backlog ID:** BACKLOG-925
**Sprint:** SPRINT-126 (moved from SPRINT-122)
**Phase:** Phase 1 -- Rework via TASK-2153, then merged
**Status:** Completed -- PR #1124 merged 2026-03-11
**Depends On:** TASK-2126 (SPRINT-121 -- schema + RPCs must be merged first)
**Branch:** `feature/task-2128-desktop-feature-gates`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~25K (service category x 0.5 = ~12.5K base, +15K for IPC/caching = ~30K adjusted)
**Rework Task:** TASK-2153 (SPRINT-126 Phase 1)

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

Create a `FeatureGateService` in the Electron main process that checks feature flags via the `check_feature_access` and `get_org_features` RPCs, caches results locally, and exposes feature access checks to the renderer process via IPC. Add gate checks before gated actions (text export, email export, attachment inclusion, call log access) with graceful degradation showing upgrade prompts.

## Non-Goals

- Do NOT modify the Supabase schema -- that is SPRINT-118 TASK-2126
- Do NOT build admin portal UI -- that is TASK-2127
- Do NOT build broker portal enforcement -- that is TASK-2129
- Do NOT add billing/payment flows
- Do NOT block basic app functionality (sync, view messages) -- only gate premium features
- Do NOT modify any `admin-portal/` or `broker-portal/` files

## Deliverables

1. New file: `electron/services/featureGateService.ts` -- Feature gate service with caching
2. New file: `electron/services/__tests__/featureGateService.test.ts` -- Unit tests
3. Update: `electron/preload.ts` -- Expose feature gate IPC channels
4. New file: `src/hooks/useFeatureGate.ts` -- React hook for feature access checks
5. New file: `src/components/common/UpgradePrompt.tsx` -- Reusable upgrade prompt component
6. Update: Export-related components to check feature gates before export actions
7. Update: `electron/main.ts` or handler registration -- Register feature gate IPC handlers

## File Boundaries

### Files to modify (owned by this task):

- `electron/services/featureGateService.ts` (new)
- `electron/services/__tests__/featureGateService.test.ts` (new)
- `electron/preload.ts` (add feature gate channels)
- `electron/main.ts` or IPC handler registration file (register handlers)
- `src/hooks/useFeatureGate.ts` (new)
- `src/components/common/UpgradePrompt.tsx` (new)
- Export-related components that need gate checks (identify during planning)

### Files this task must NOT modify:

- Any `admin-portal/` files -- Owned by TASK-2127
- Any `broker-portal/` files -- Owned by TASK-2129
- Any `supabase/` files -- Schema is already done (TASK-2126)
- `electron/services/syncOrchestratorService.ts` -- Do not modify sync flow
- `electron/services/databaseService.ts` -- Do not modify DB schema

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `FeatureGateService` exists with `checkFeature(orgId, featureKey)` and `getAllFeatures(orgId)` methods
- [ ] Feature flags are cached locally with configurable TTL (default 5 minutes)
- [ ] Cache survives app restart (persist to SQLite or file)
- [ ] When offline, cached feature flags are used as fallback
- [ ] IPC channel `feature-gate:check` returns feature access result to renderer
- [ ] IPC channel `feature-gate:get-all` returns all features for current org to renderer
- [ ] `useFeatureGate` hook provides `isAllowed(featureKey)` and `loading` state
- [ ] `UpgradePrompt` component shows friendly message when feature is gated
- [ ] Text export action checks `text_export` feature flag before proceeding
- [ ] Email export action checks `email_export` feature flag before proceeding
- [ ] Attachment inclusion checks `text_attachments` / `email_attachments` flags
- [ ] Call log access checks `call_log` feature flag
- [ ] Gated actions show `UpgradePrompt` instead of proceeding when blocked
- [ ] Feature gate checks do not block app startup or core functionality
- [ ] Unit tests cover cache behavior, fallback, and gate check logic
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### FeatureGateService

```typescript
// electron/services/featureGateService.ts

interface FeatureAccess {
  allowed: boolean;
  value: string;
  source: 'plan' | 'override' | 'default';
}

interface FeatureCache {
  features: Record<string, FeatureAccess>;
  fetchedAt: number;
  orgId: string;
}

class FeatureGateService {
  private cache: FeatureCache | null = null;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  async checkFeature(orgId: string, featureKey: string): Promise<FeatureAccess> {
    // 1. Check in-memory cache
    // 2. If cache miss or expired, fetch from Supabase RPC
    // 3. If offline, fall back to persisted cache
    // 4. If no cache at all, return default (allowed: true for basic features)
  }

  async getAllFeatures(orgId: string): Promise<Record<string, FeatureAccess>> {
    // Fetch via get_org_features RPC, cache result
  }

  private async fetchFromSupabase(orgId: string): Promise<void> {
    // Call get_org_features RPC
    // Update in-memory and persisted cache
  }

  private persistCache(): void {
    // Write cache to SQLite or file for offline fallback
  }

  private loadPersistedCache(): void {
    // Load cache from SQLite or file on startup
  }
}
```

### IPC Channels

```typescript
// In preload.ts, add to the api object:
featureGate: {
  check: (featureKey: string) => ipcRenderer.invoke('feature-gate:check', featureKey),
  getAll: () => ipcRenderer.invoke('feature-gate:get-all'),
}
```

### useFeatureGate Hook

```typescript
// src/hooks/useFeatureGate.ts
export function useFeatureGate() {
  const [features, setFeatures] = useState<Record<string, FeatureAccess>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.featureGate.getAll().then(result => {
      setFeatures(result.features);
      setLoading(false);
    });
  }, []);

  const isAllowed = useCallback((featureKey: string): boolean => {
    return features[featureKey]?.enabled ?? true; // Default to allowed if unknown
  }, [features]);

  return { isAllowed, features, loading };
}
```

### UpgradePrompt Component

```tsx
// src/components/common/UpgradePrompt.tsx
interface UpgradePromptProps {
  featureName: string;
  description?: string;
}

export function UpgradePrompt({ featureName, description }: UpgradePromptProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
      <LockIcon className="h-8 w-8 text-gray-400 mb-3" />
      <h3 className="text-lg font-medium text-gray-900">{featureName}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {description || 'This feature is not available on your current plan.'}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        Contact your administrator to upgrade.
      </p>
    </div>
  );
}
```

### Gate Check Integration Points

Identify during planning phase. Likely locations:
- Export button handlers in transaction detail views
- Attachment export options
- Call log tab/section rendering
- iPhone sync attachment download logic

### Cache Persistence

For offline support, persist the feature cache. Options (choose during planning):
1. **SQLite table** -- Add a `feature_cache` table to the local DB (preferred, atomic)
2. **JSON file** -- Write to `~/Library/Application Support/keepr/feature-cache.json`

### Important Details

- The `check_feature_access` and `get_org_features` RPCs exist from TASK-2126
- The org_id comes from the current user's organization membership
- Feature gate checks should NEVER block app startup -- they run async after authentication
- Default behavior when no cache and offline: allow all features (fail-open, not fail-closed)
- This is a soft enforcement layer -- the real enforcement is server-side in the RPCs

## Integration Notes

- **Depends on:** TASK-2126 (schema -- RPCs must exist)
- **Independent of:** TASK-2127 (admin UI), TASK-2129 (broker enforcement)
- **Uses:** Supabase client in main process for RPC calls
- **Uses:** Existing IPC pattern from preload.ts
- **Uses:** Existing service initialization pattern

## Do / Don't

### Do:
- Follow existing IPC patterns in `electron/preload.ts`
- Follow existing service patterns in `electron/services/`
- Cache aggressively -- feature flags change rarely
- Fail-open when offline or no cache (don't block users)
- Use worker thread if Supabase call is slow (check existing patterns)
- Write unit tests for cache logic and fallback behavior

### Don't:
- Do NOT block app startup waiting for feature flag fetch
- Do NOT fail-closed (block access) when offline with no cache
- Do NOT call Supabase RPCs on every feature check -- use the cache
- Do NOT modify admin-portal or broker-portal files
- Do NOT modify sync orchestrator or database service
- Do NOT add new database tables to the local SQLite (use existing patterns for cache)

## When to Stop and Ask

- If `check_feature_access` or `get_org_features` RPCs don't exist (TASK-2126 not merged)
- If there's no clear pattern for how the app gets the current org_id
- If the preload.ts IPC pattern has changed significantly
- If export components are structured differently than expected
- If you're unsure where to integrate gate checks (too many or too few touch points)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- `featureGateService.test.ts`:
  - Cache hit returns cached value
  - Cache miss triggers Supabase fetch
  - Expired cache triggers refresh
  - Offline fallback uses persisted cache
  - No cache + offline = fail-open (allow all)
  - `checkFeature` returns correct boolean
  - `getAllFeatures` returns complete feature set

### Coverage

- Coverage impact: New service should have >80% coverage
- Existing test coverage must not decrease

### Integration / Feature Tests

- Manual verification:
  - Feature flags load after login
  - Gated feature shows UpgradePrompt when blocked
  - Gated feature works normally when allowed
  - Offline mode uses cached flags

### CI Requirements

This task's PR MUST pass:
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(electron): add feature gate service with caching and upgrade prompts`
- **Labels**: `electron`, `sprint-119`
- **Depends on**: TASK-2126 (schema must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service` + `ipc`

**Estimated Tokens:** ~25K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new files (service, test, hook, component) | +15K |
| Files to modify | ~3 files (preload, main, export components) | +5K |
| Test complexity | Unit tests for cache logic | +5K |
| IPC multiplier | x 1.5 | Applied to IPC portion |
| Service multiplier | x 0.5 | Applied to service portion |

**Confidence:** Medium

**Risk factors:**
- IPC integration complexity with preload bridge
- Number of export components to gate-check is unclear
- Cache persistence approach needs exploration

**Similar past tasks:** TASK-2102 (sentry instrumentation, ~25K), TASK-2109 (session validator)

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
- [ ] electron/services/featureGateService.ts
- [ ] electron/services/__tests__/featureGateService.test.ts
- [ ] src/hooks/useFeatureGate.ts
- [ ] src/components/common/UpgradePrompt.tsx

Files modified:
- [ ] electron/preload.ts
- [ ] electron/main.ts (or IPC handler registration)
- [ ] Export components (list specific files during planning)

Features implemented:
- [ ] FeatureGateService with caching
- [ ] IPC channels for feature gate
- [ ] useFeatureGate React hook
- [ ] UpgradePrompt component
- [ ] Gate checks on export actions
- [ ] Offline fallback behavior
- [ ] Unit tests

Verification:
- [ ] npm test passes
- [ ] npm run type-check passes
- [ ] npm run lint passes
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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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
