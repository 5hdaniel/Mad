# TASK-2098: Dynamic Contact Source Selection in Onboarding and Sync

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

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

**Backlog ID:** BACKLOG-825
**Sprint:** SPRINT-106
**Branch:** `feature/task-2098-dynamic-contact-source`
**Estimated Tokens:** ~60K

---

## Objective

Add a contact source selection step to onboarding and make the sync system respect user preferences for which contact sources to sync. Currently, the sync bundles macOS Contacts and Outlook under a single `'contacts'` type with no way to sync them independently or let users choose which sources they use.

---

## Context

Discovered during SPRINT-105 (BACKLOG-823 fix):

1. **Single sync type for multiple sources:** `useAutoRefresh` pushes a single `'contacts'` sync type that runs BOTH macOS Contacts (Phase 1) and Outlook contacts (Phase 2) sequentially. No way to request just one source.

2. **Redundant gating:** The hook gated contacts sync behind `(isMacOS && hasPermissions) || emailConnected`, but the SyncOrchestratorService has its own internal guards. This caused contacts sync to be skipped entirely when both conditions were false -- even though one source might work independently.

3. **No user choice:** Users are never asked which contact sources they use. The system assumes macOS Contacts + Outlook.

The preference system already exists:
- `electron/utils/preferenceHelper.ts` -- `isContactSourceEnabled()` checks Supabase preferences
- `contactSources.direct.macosContacts` / `contactSources.direct.outlookContacts` -- boolean toggles
- Defaults to `true` (fail-open) if preferences not set
- Settings UI: `src/components/settings/MacOSContactsImportSettings.tsx`

**Dependency:** BACKLOG-823 / TASK-2092 must be merged first (fixes the syncExternal call) -- already DONE.

---

## Requirements

### Must Do:
1. **Create new onboarding step:** `src/components/onboarding/steps/ContactSourceStep.tsx` with multi-select card buttons:
   - macOS Contacts App (icon: address book) -- macOS only
   - Outlook / Microsoft 365 (icon: Outlook logo)
   - "I'll set this up later" skip option
2. **Add step to onboarding flows:**
   - `src/components/onboarding/flows/macosFlow.ts` -- Add `contact-source` step after `email-connect`
   - `src/components/onboarding/flows/windowsFlow.ts` -- Add `contact-source` step (Outlook only on Windows)
3. **Save preferences to Supabase:**
   ```json
   {
     "contactSources": {
       "direct": {
         "macosContacts": true/false,
         "outlookContacts": true/false
       }
     }
   }
   ```
4. **Update SyncOrchestratorService** to read source preferences and only run phases for enabled sources
5. **Update `useAutoRefresh` hook** to pass source preferences (or remove redundant gating, letting the orchestrator decide)
6. Add step type to `src/components/onboarding/types/steps.ts`

### Must NOT Do:
- Do NOT add Gmail contacts support (future backlog item)
- Do NOT change the existing preference storage format -- use the existing `contactSources.direct` structure
- Do NOT modify the MacOSContactsImportSettings in the Settings page (it already works correctly)
- Do NOT change the underlying sync APIs (syncExternal, Outlook sync)

---

## Acceptance Criteria

- [ ] New "Where do you save your contacts?" step appears in macOS onboarding after email connection
- [ ] Windows onboarding shows the step with Outlook only (no macOS Contacts option)
- [ ] Selected sources are saved to `contactSources.direct` preferences in Supabase
- [ ] Skipping the step defaults to all available sources enabled (fail-open)
- [ ] Sync only runs phases for enabled contact sources
- [ ] Disabling a source in onboarding is reflected in the next sync cycle
- [ ] Settings page toggles still work and are consistent with onboarding selection
- [ ] All existing tests pass
- [ ] All CI checks pass

---

## Files to Create

- `src/components/onboarding/steps/ContactSourceStep.tsx` -- New onboarding step

## Files to Modify

- `src/components/onboarding/flows/macosFlow.ts` -- Add `contact-source` step
- `src/components/onboarding/flows/windowsFlow.ts` -- Add `contact-source` step
- `src/services/SyncOrchestratorService.ts` -- Read source preferences, conditionally run phases
- `src/hooks/useAutoRefresh.ts` -- Remove redundant gating or pass source preferences
- `src/components/onboarding/types/steps.ts` -- Add new step type

## Files to Read (for context)

- `electron/utils/preferenceHelper.ts` -- `isContactSourceEnabled()` implementation
- `src/components/settings/MacOSContactsImportSettings.tsx` -- Existing settings UI for reference
- `src/services/SyncOrchestratorService.ts` -- Current phase structure
- `src/hooks/useAutoRefresh.ts` -- Current contacts sync gating
- `src/components/onboarding/steps/` -- Existing onboarding step patterns

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  - ContactSourceStep renders correctly on macOS (shows both sources)
  - ContactSourceStep renders correctly on Windows (shows Outlook only)
  - Skip option defaults to all sources enabled
  - SyncOrchestratorService respects disabled sources
- **Existing tests to update:**
  - SyncOrchestratorService tests -- mock preferences for source-specific sync
  - Onboarding flow tests -- account for new step

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(onboarding): add contact source selection step and parameterized sync`
- **Branch:** `feature/task-2098-dynamic-contact-source`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] src/components/onboarding/steps/ContactSourceStep.tsx

Files modified:
- [ ] src/components/onboarding/flows/macosFlow.ts
- [ ] src/components/onboarding/flows/windowsFlow.ts
- [ ] src/services/SyncOrchestratorService.ts
- [ ] src/hooks/useAutoRefresh.ts
- [ ] src/components/onboarding/types/steps.ts

Features implemented:
- [ ] Contact source selection onboarding step
- [ ] Multi-select card UI with platform-appropriate options
- [ ] Preference saving to Supabase
- [ ] Source-aware sync orchestration
- [ ] Skip/default behavior (fail-open)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~60K vs Actual ~XK

### Notes

**Deviations from plan:**
<If you deviated, explain what and why>

**Issues encountered:**
<Document any challenges>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

---

## Guardrails

**STOP and ask PM if:**
- The SyncOrchestratorService phase structure does not cleanly support skipping individual phases
- The preference read in the orchestrator requires async calls that change the sync flow significantly
- The onboarding flow framework does not support platform-conditional step content (showing different options per platform)
- The `contactSources.direct` preference format needs to change to support future sources (Gmail)
- You encounter blockers not covered in the task file
