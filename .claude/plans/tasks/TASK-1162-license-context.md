# Task TASK-1162: License Context Provider

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Create a React Context provider that loads and manages license state from the database, providing license information throughout the application via a `useLicense` hook.

## Non-Goals

- Do NOT modify database schema (that's TASK-1161)
- Do NOT implement UI gating components (that's TASK-1163)
- Do NOT create upgrade flow UI
- Do NOT modify existing authentication flow

## Deliverables

1. New file: `src/contexts/LicenseContext.tsx`
2. New file: `src/hooks/useLicense.ts`
3. Update: `src/App.tsx` (or appropriate root to add LicenseProvider)

## Acceptance Criteria

- [ ] LicenseContext provides license state to entire app
- [ ] useLicense hook returns license state and computed flags
- [ ] License loaded from local SQLite on app start
- [ ] License syncs with Supabase when user is authenticated
- [ ] Computed flags: `canExport`, `canSubmit`, `canAutoDetect`
- [ ] Organization info included for team users
- [ ] Hook works correctly in all components
- [ ] Unit tests for useLicense hook
- [ ] All CI checks pass

## Implementation Notes

### LicenseContext Interface

```typescript
// src/contexts/LicenseContext.tsx

interface LicenseState {
  // Core license info
  licenseType: 'individual' | 'team' | 'enterprise';
  aiDetectionEnabled: boolean;

  // Organization info (if team)
  organizationId: string | null;
  organizationName: string | null;
  userRole: 'agent' | 'broker' | 'admin' | 'it_admin' | null;

  // Computed flags for easy use
  canExport: boolean;      // true for individual
  canSubmit: boolean;      // true for team
  canAutoDetect: boolean;  // true if aiDetectionEnabled

  // Loading state
  isLoading: boolean;
  error: Error | null;

  // Actions
  refreshLicense: () => Promise<void>;
}

const LicenseContext = React.createContext<LicenseState | null>(null);
```

### useLicense Hook

```typescript
// src/hooks/useLicense.ts

export function useLicense(): LicenseState {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
```

### LicenseProvider Implementation

```typescript
// src/contexts/LicenseContext.tsx

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LicenseState>({
    licenseType: 'individual',
    aiDetectionEnabled: false,
    organizationId: null,
    organizationName: null,
    userRole: null,
    canExport: true,
    canSubmit: false,
    canAutoDetect: false,
    isLoading: true,
    error: null,
    refreshLicense: async () => { /* implemented below */ }
  });

  // Load license from local database on mount
  useEffect(() => {
    loadLocalLicense();
  }, []);

  // Sync with Supabase when authenticated
  // (integrate with existing auth flow)

  return (
    <LicenseContext.Provider value={state}>
      {children}
    </LicenseContext.Provider>
  );
}
```

### Data Flow

```
App Start
    |
    v
Load from local SQLite (users table)
    |
    v
Set initial license state
    |
    v
If authenticated, fetch from Supabase profiles
    |
    v
If Supabase has newer data, update local
    |
    v
If team user, fetch organization details
    |
    v
Provide via LicenseContext
```

### IPC Calls Needed

You'll need to add IPC handlers to fetch license data:

```typescript
// In electron handlers
'license:getLocal': () => {
  // Return license data from local SQLite users table
},
'license:syncWithSupabase': async () => {
  // Fetch from Supabase profiles, update local if needed
}
```

### Important Details

- Local SQLite is the primary source (supports offline mode)
- Supabase sync happens when online and authenticated
- Computed flags (`canExport`, `canSubmit`, `canAutoDetect`) simplify UI code
- Organization info fetched separately for team users

## Integration Notes

- Imports from: `src/types/database.ts` (license types from TASK-1161)
- Exports to: Used by all components via useLicense hook
- Used by: TASK-1163 (License-Aware UI Components)
- Depends on: TASK-1161 (License Schema must exist first)

## Do / Don't

### Do:

- Use existing patterns from other contexts (AuthContext, etc.)
- Handle loading and error states properly
- Memoize context value to prevent unnecessary re-renders
- Add TypeScript types for all interfaces

### Don't:

- Don't modify authentication flow
- Don't create UI components (that's TASK-1163)
- Don't add database schema changes (that's TASK-1161)
- Don't hardcode license values

## When to Stop and Ask

- If existing context patterns are significantly different
- If the database service doesn't have license fields (schema task incomplete)
- If there are authentication state dependencies unclear
- If Supabase sync requires significant auth flow changes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - useLicense hook returns correct state
  - Computed flags calculated correctly
  - Error handling for missing context
- Existing tests to update:
  - None expected

### Coverage

- Coverage impact: Target 60% coverage on new code

### Integration / Feature Tests

- Required scenarios:
  - License loads on app start
  - License state accessible via useLicense

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(license): add LicenseContext and useLicense hook`
- **Labels**: `feature`, `context`, `sprint-051`
- **Depends on**: TASK-1161

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (context, hook) | +10K |
| Files to modify | 1-2 files (App.tsx, IPC handlers) | +8K |
| Code volume | ~200-300 lines | +7K |
| Test complexity | Medium (context testing) | +5K |

**Confidence:** Medium

**Risk factors:**
- Integration with existing auth/state patterns
- IPC handler creation may require more work

**Similar past tasks:** TASK-929 (AppStateContext, actual: ~15K tokens)

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
- [ ] src/contexts/LicenseContext.tsx
- [ ] src/hooks/useLicense.ts
- [ ] src/contexts/__tests__/LicenseContext.test.tsx (or similar)

Files modified:
- [ ] src/App.tsx (add LicenseProvider)
- [ ] electron/handlers/ (license IPC handlers)

Features implemented:
- [ ] LicenseContext with state
- [ ] useLicense hook
- [ ] Local license loading
- [ ] Supabase sync (if authenticated)
- [ ] Computed flags

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

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
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

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
