# Task TASK-1163: License-Aware UI Components

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

Implement UI component wrappers and conditional rendering based on user's license type (Individual, Team) and AI Detection add-on status, using the LicenseContext from TASK-1162.

## Non-Goals

- Do NOT modify database schema (that's TASK-1161)
- Do NOT modify LicenseContext (that's TASK-1162)
- Do NOT implement the upgrade flow UI
- Do NOT add new features - only gate existing ones

## Deliverables

1. New file: `src/components/common/LicenseGate.tsx`
2. Update: `src/components/TransactionDetails/TransactionDetailsHeader.tsx` (or similar)
3. Update: `src/components/Dashboard/Dashboard.tsx`
4. Update: `src/components/Transactions/TransactionFilters.tsx` (or similar)
5. Update: `src/components/AuditTransactionModal/AuditTransactionModal.tsx` (or similar)

## Acceptance Criteria

- [ ] LicenseGate component created for conditional rendering
- [ ] Export button visible ONLY for Individual license
- [ ] Submit button visible ONLY for Team license
- [ ] Auto-detection button visible ONLY with AI add-on
- [ ] AI transaction filters hidden without AI add-on
- [ ] AI section in New Audit hidden without AI add-on
- [ ] Manual transaction screen always visible (no gating)
- [ ] Unit tests for LicenseGate component
- [ ] All CI checks pass

## Implementation Notes

### LicenseGate Component

```tsx
// src/components/common/LicenseGate.tsx

import { useLicense } from '@/hooks/useLicense';

interface LicenseGateProps {
  /** Which license/feature is required */
  requires: 'individual' | 'team' | 'enterprise' | 'ai_addon';
  /** What to show if gate fails (default: null) */
  fallback?: React.ReactNode;
  /** Content to show when gate passes */
  children: React.ReactNode;
}

export function LicenseGate({ requires, fallback = null, children }: LicenseGateProps) {
  const { licenseType, aiDetectionEnabled } = useLicense();

  const hasAccess = (() => {
    switch (requires) {
      case 'individual':
        return licenseType === 'individual';
      case 'team':
        return licenseType === 'team' || licenseType === 'enterprise';
      case 'enterprise':
        return licenseType === 'enterprise';
      case 'ai_addon':
        return aiDetectionEnabled;
      default:
        return false;
    }
  })();

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

### Feature Gating Matrix

| Feature | Component Location | Gate Type | Visibility |
|---------|-------------------|-----------|------------|
| Export button | TransactionDetailsHeader | `individual` | Individual only |
| Submit button | TransactionDetailsHeader | `team` | Team only |
| Auto-detection button | Dashboard | `ai_addon` | AI add-on only |
| AI transaction filters | TransactionFilters | `ai_addon` | AI add-on only |
| AI section in New Audit | AuditTransactionModal | `ai_addon` | AI add-on only |
| Manual transaction | - | None | Always visible |

### Usage Examples

```tsx
// In TransactionDetailsHeader.tsx
import { LicenseGate } from '@/components/common/LicenseGate';

function TransactionDetailsHeader() {
  return (
    <div>
      {/* Export - Individual only */}
      <LicenseGate requires="individual">
        <Button onClick={handleExport}>Export</Button>
      </LicenseGate>

      {/* Submit - Team only */}
      <LicenseGate requires="team">
        <Button onClick={handleSubmit}>Submit for Review</Button>
      </LicenseGate>
    </div>
  );
}
```

```tsx
// In Dashboard.tsx
import { LicenseGate } from '@/components/common/LicenseGate';

function Dashboard() {
  return (
    <div>
      {/* AI Auto-detection - AI add-on only */}
      <LicenseGate requires="ai_addon">
        <AutoDetectionButton />
      </LicenseGate>
    </div>
  );
}
```

### Files to Modify

Search for and modify these specific UI elements:

1. **Export Button**: Find in transaction details header
2. **Submit Button**: May already exist from SPRINT-050 B2B work
3. **Auto-Detection Button**: In Dashboard
4. **AI Filters**: In transaction list filters (detection_status, confidence, etc.)
5. **AI Section in New Audit**: In AuditTransactionModal

### Important Details

- Use the `useLicense` hook to get license state
- Don't add loading states for individual components (LicenseContext handles that)
- Keep fallback as `null` for clean removal (don't show "upgrade" messages yet)
- Manual transactions should NOT be gated

## Integration Notes

- Imports from: `src/hooks/useLicense.ts` (from TASK-1162)
- Exports to: N/A (modifies existing components)
- Used by: End users via UI
- Depends on: TASK-1162 (License Context must exist first)

## Do / Don't

### Do:

- Use the LicenseGate wrapper component
- Keep changes minimal - only add gates, don't refactor
- Verify each feature with both license types
- Add unit tests for LicenseGate

### Don't:

- Don't modify license state logic (that's TASK-1162)
- Don't add upgrade prompts or CTAs
- Don't gate manual transaction creation
- Don't refactor components beyond adding gates

## When to Stop and Ask

- If you can't find the Export button location
- If Submit button doesn't exist yet (may need to create)
- If AI features don't have clear UI elements to gate
- If component structure is significantly different than expected

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - LicenseGate shows children when license matches
  - LicenseGate shows fallback when license doesn't match
  - LicenseGate handles all requires values
- Existing tests to update:
  - May need to mock LicenseContext in component tests

### Coverage

- Coverage impact: Target 80% coverage on LicenseGate component

### Integration / Feature Tests

- Required scenarios:
  - Individual user sees Export button, not Submit
  - Team user sees Submit button, not Export
  - AI add-on user sees auto-detection button
  - Non-AI user doesn't see AI filters

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(ui): add license-based feature gating`
- **Labels**: `feature`, `ui`, `sprint-051`
- **Depends on**: TASK-1162

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~30K-40K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new component | +5K |
| Files to modify | 4-5 existing components | +20K |
| Code volume | ~200 lines new, ~100 lines modified | +10K |
| Test complexity | Medium (component testing) | +5K |

**Confidence:** Medium

**Risk factors:**
- Component locations may require exploration
- Existing component structure may vary
- May need to search for AI feature locations

**Similar past tasks:** TASK-958 (dismissible notification banners, actual: ~15K tokens)

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
- [ ] src/components/common/LicenseGate.tsx
- [ ] src/components/common/__tests__/LicenseGate.test.tsx

Files modified:
- [ ] TransactionDetailsHeader (or equivalent) - Export/Submit gates
- [ ] Dashboard - Auto-detection gate
- [ ] TransactionFilters (or equivalent) - AI filters gate
- [ ] AuditTransactionModal - AI section gate

Features implemented:
- [ ] LicenseGate component
- [ ] Export button gated to Individual
- [ ] Submit button gated to Team
- [ ] Auto-detection gated to AI add-on
- [ ] AI filters gated to AI add-on
- [ ] AI section gated to AI add-on

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

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~35K | ~XK | +/-X% |
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
