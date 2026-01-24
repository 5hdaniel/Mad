# TASK-1181: Verify AI Feature Gating Completeness

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

**Backlog ID:** BACKLOG-462
**Sprint:** SPRINT-054 (Phase 0 - Carryover)
**Phase:** 0 - Carryover
**Branch:** `fix/task-1181-ai-gating-verification`
**Estimated Tokens:** ~15K

---

## Objective

Verify that ALL AI features are properly gated when the AI add-on is disabled (`ai_detection_enabled === false`). If any gaps are found, fix them by wrapping components with `<LicenseGate>`.

This is a QA/verification task that may result in code changes if gaps are found.

---

## Context

BACKLOG-427 (License-Aware UI Components) was completed in SPRINT-051, adding the `<LicenseGate>` component for gating features based on license. We need to verify that all AI-related features are properly hidden when the user doesn't have the AI add-on.

User requirement:
> If user doesn't have AI add-on, hide:
> - Auto-detection button
> - AI consent in settings
> - AI detections in new audit button

---

## Requirements

### Must Do:

1. **Verify Auto-Detection Button** (Dashboard)
   - Location: Dashboard main view
   - Expected: Hidden when `ai_detection_enabled === false`
   - Check: `src/components/Dashboard/Dashboard.tsx`

2. **Verify AI Consent in Settings**
   - Location: Settings -> LLM Settings / AI Features section
   - Expected: Section hidden when `ai_detection_enabled === false`
   - Check: `src/components/Settings/Settings.tsx`, `src/components/Settings/LLMSettings.tsx`

3. **Verify AI Detections in New Audit**
   - Location: AuditTransactionModal / New Transaction flow
   - Expected: AI detection options hidden when `ai_detection_enabled === false`
   - Check: `src/components/AuditTransactionModal/*.tsx`

4. **Verify AI Transaction Filters**
   - Location: Transactions list filter bar
   - Expected: AI-related filters hidden when `ai_detection_enabled === false`
   - Check: `src/components/Transactions/TransactionFilters.tsx`

5. **Fix any gaps found** by wrapping with `<LicenseGate requires="ai_addon" fallback={null}>`

### Must NOT Do:
- Change license system architecture
- Modify non-AI-related components
- Break existing functionality
- Add new features

---

## Acceptance Criteria

- [ ] Auto-detection button hidden when AI disabled
- [ ] AI consent section hidden in Settings when AI disabled
- [ ] AI detection options hidden in new audit modal when AI disabled
- [ ] AI-related filters hidden when AI disabled
- [ ] All features appear correctly when AI is enabled
- [ ] No console errors in either state
- [ ] All existing tests pass
- [ ] Document any fixes made

---

## Files to Check

| File | Feature |
|------|---------|
| `src/components/Dashboard/Dashboard.tsx` | Auto-detection button |
| `src/components/Dashboard/AIStatusCard.tsx` | AI status display |
| `src/components/Settings/Settings.tsx` | AI consent section |
| `src/components/Settings/LLMSettings.tsx` | AI settings |
| `src/components/AuditTransactionModal/*.tsx` | AI detection options |
| `src/components/Transactions/TransactionFilters.tsx` | AI filters |

## Files to Read (for context)

- `src/contexts/LicenseContext.tsx` - Understand license context
- `src/components/common/LicenseGate.tsx` - How to use LicenseGate
- `src/types/license.types.ts` - License type definitions

---

## Testing Approach

### Manual Testing (Required)

1. **Set AI disabled:**
   - In SQLite database, set user's `ai_detection_enabled` to `false`
   - OR use a test account without AI add-on

2. **Verify each feature is hidden:**
   | Location | Check |
   |----------|-------|
   | Dashboard | No auto-detection button visible |
   | Settings | No AI consent toggle visible |
   | New Audit Modal | No AI detection options |
   | Transaction Filters | No AI-related filters |

3. **Set AI enabled:**
   - Set `ai_detection_enabled` to `true`
   - Verify all features appear

4. **Check console:**
   - No errors in either state

### Unit Tests
- **Required:** Only if new LicenseGate wrappers are added
- **Existing tests:** Must continue to pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(license): complete AI feature gating verification (TASK-1181)`
- **Branch:** `fix/task-1181-ai-gating-verification`
- **Target:** `develop`

If no code changes needed (all features already gated):
- Update task file with verification results
- No PR needed - mark task as complete

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop (if fixes needed)
- [ ] Noted start time: ___
- [ ] Read task file completely

Verification:
- [ ] Auto-detection button - PASS/FAIL (details: ___)
- [ ] AI consent in Settings - PASS/FAIL (details: ___)
- [ ] AI detection in new audit - PASS/FAIL (details: ___)
- [ ] AI transaction filters - PASS/FAIL (details: ___)

Implementation (if gaps found):
- [ ] Added LicenseGate wrappers where needed
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission (if code changes):
- [ ] This summary section completed
- [ ] PR created
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] Verification complete
- [ ] PM notified
```

### Verification Results

| Feature | Status | Notes |
|---------|--------|-------|
| Auto-detection button | PENDING | |
| AI consent in Settings | PENDING | |
| AI detection in new audit | PENDING | |
| AI transaction filters | PENDING | |

### Fixes Applied (if any)

- [List any LicenseGate wrappers added]

### Metrics

- **Actual Tokens**: ~XK (Est: 15K)
- **Actual Time**: X min
- **PR**: [URL if code changes made, or "N/A - verification only"]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find more than 5 ungated AI features (may indicate architectural issue)
- The LicenseGate component needs modification
- You discover the license context is not available in certain components
- Existing tests fail after adding LicenseGate wrappers
- You encounter blockers not covered in the task file
