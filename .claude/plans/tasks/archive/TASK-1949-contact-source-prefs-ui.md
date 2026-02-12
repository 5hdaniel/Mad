# Task TASK-1949: Contact Source Preferences UI

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

## Goal

Add a "Contact Sources" section in Settings that lets users toggle which contact sources are imported (direct) and which are auto-discovered from conversations (inferred). Persist these preferences using the existing `preferences:update` IPC pattern.

## Non-Goals

- Do NOT wire preferences to actual import/extraction pipelines (TASK-1950, TASK-1951 handle that)
- Do NOT add message filtering UI (TASK-1952)
- Do NOT refactor the existing Settings component structure
- Do NOT add new IPC channels -- use existing `preferences:update` and `preferences:get`

## Deliverables

1. Update: `src/components/Settings.tsx` -- add Contact Sources section
2. No new files required (uses existing preferences infrastructure)

## Acceptance Criteria

- [ ] "Contact Sources" section appears in Settings under the existing "Contacts" heading (line ~795)
- [ ] Two subsections render: "Import From" (direct) and "Auto-discover from conversations" (inferred)
- [ ] "Import From" subsection has toggles for: Outlook Contacts, Gmail Contacts, macOS/iPhone Contacts
- [ ] "Auto-discover" subsection has toggles for: Outlook emails, Gmail emails, Messages/SMS
- [ ] Each toggle is a checkbox-style toggle switch (matching existing `autoSyncOnLogin` pattern)
- [ ] Provider-specific toggles are disabled (greyed out) when that provider is not connected
  - Gmail toggles disabled if `connections.google?.connected !== true`
  - Outlook toggles disabled if `connections.microsoft?.connected !== true`
  - macOS Contacts toggle always enabled on macOS (uses local Contacts API)
  - Messages/SMS toggle always enabled on macOS
- [ ] Default values: Direct imports ON, inferred sources OFF
- [ ] Preferences persist via `window.api.preferences.update(userId, { contactSources: {...} })`
- [ ] Preferences load on mount via `window.api.preferences.get(userId)`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All CI checks pass

## Implementation Notes

### Preferences Schema

Store under a `contactSources` key in the preferences object:

```typescript
// In the preferences object (synced via Supabase)
{
  contactSources: {
    direct: {
      outlookContacts: true,    // default: true
      gmailContacts: true,      // default: true
      macosContacts: true,      // default: true
    },
    inferred: {
      outlookEmails: false,     // default: false
      gmailEmails: false,       // default: false
      messages: false,          // default: false
    },
  }
}
```

### Loading Preferences (follow existing pattern)

In `loadPreferences()` (around line 160), add after the `autoDownload` loading block:

```typescript
// Load contact source preferences
if (result.preferences?.contactSources) {
  const cs = result.preferences.contactSources;
  if (cs.direct) {
    if (typeof cs.direct.outlookContacts === 'boolean') setOutlookContactsEnabled(cs.direct.outlookContacts);
    if (typeof cs.direct.gmailContacts === 'boolean') setGmailContactsEnabled(cs.direct.gmailContacts);
    if (typeof cs.direct.macosContacts === 'boolean') setMacosContactsEnabled(cs.direct.macosContacts);
  }
  if (cs.inferred) {
    if (typeof cs.inferred.outlookEmails === 'boolean') setOutlookEmailsInferred(cs.inferred.outlookEmails);
    if (typeof cs.inferred.gmailEmails === 'boolean') setGmailEmailsInferred(cs.inferred.gmailEmails);
    if (typeof cs.inferred.messages === 'boolean') setMessagesInferred(cs.inferred.messages);
  }
}
```

### Toggle Handler (follow handleAutoSyncToggle pattern)

```typescript
const handleContactSourceToggle = async (
  category: 'direct' | 'inferred',
  key: string,
  currentValue: boolean,
  setter: React.Dispatch<React.SetStateAction<boolean>>
): Promise<void> => {
  const newValue = !currentValue;
  setter(newValue);
  try {
    await window.api.preferences.update(userId, {
      contactSources: {
        [category]: {
          [key]: newValue,
        },
      },
    });
  } catch {
    // Silently handle - preference will still be applied locally for this session
  }
};
```

### UI Layout

Place the Contact Sources section INSIDE the existing "Contacts" section (around line 795-802), before the `MacOSContactsImportSettings` component. The section should use the same visual style as other settings sections.

```tsx
{/* Contact Sources */}
<div className="mb-4">
  <h4 className="text-sm font-medium text-gray-700 mb-3">Contact Sources</h4>

  {/* Import From (direct) */}
  <div className="mb-3">
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
      Import From
    </p>
    <div className="space-y-2">
      {/* Outlook Contacts toggle */}
      {/* Gmail Contacts toggle */}
      {/* macOS/iPhone Contacts toggle */}
    </div>
  </div>

  {/* Auto-discover from conversations (inferred) */}
  <div className="mb-3">
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
      Auto-discover from conversations
    </p>
    <div className="space-y-2">
      {/* Outlook emails toggle */}
      {/* Gmail emails toggle */}
      {/* Messages/SMS toggle */}
    </div>
  </div>
</div>
```

### Disabled State Logic

Outlook toggles: `disabled={loadingPreferences || !connections.microsoft?.connected}`
Gmail toggles: `disabled={loadingPreferences || !connections.google?.connected}`
macOS Contacts: `disabled={loadingPreferences}` (always available on macOS)
Messages/SMS: `disabled={loadingPreferences}` (always available on macOS)

Show a subtle "(not connected)" label next to disabled provider toggles.

### PreferencesResult Interface Update

Update the `PreferencesResult` interface at the top of Settings.tsx to include the new shape:

```typescript
interface PreferencesResult {
  success: boolean;
  error?: string;
  preferences?: {
    export?: { defaultFormat?: string };
    scan?: { lookbackMonths?: number };
    sync?: { autoSyncOnLogin?: boolean };
    updates?: { autoDownload?: boolean };
    contactSources?: {
      direct?: {
        outlookContacts?: boolean;
        gmailContacts?: boolean;
        macosContacts?: boolean;
      };
      inferred?: {
        outlookEmails?: boolean;
        gmailEmails?: boolean;
        messages?: boolean;
      };
    };
  };
}
```

## Integration Notes

- Uses existing preference infrastructure: `window.api.preferences.update` / `window.api.preferences.get`
- The `preferences:update` handler in `electron/preference-handlers.ts` already does deep merge, so partial updates work
- Preferences are stored in Supabase via `supabaseService.syncPreferences`
- TASK-1950 will read `contactSources.direct.*` to gate direct imports
- TASK-1951 will read `contactSources.inferred.*` to gate inferred contacts
- TASK-1952 is independent (message filtering, not contact source selection)

## Do / Don't

### Do:

- Follow the exact toggle switch pattern used for `autoSyncOnLogin` (lines 487-503)
- Use `loadingPreferences` to disable toggles during load
- Use the deep merge behavior of `preferences:update` (only send changed keys)
- Check `connections.google?.connected` and `connections.microsoft?.connected` for disabled state

### Don't:

- Do NOT create new IPC channels
- Do NOT modify `electron/preference-handlers.ts`
- Do NOT add platform detection here (macOS toggles should render everywhere but the import components handle platform-specific behavior)
- Do NOT add `useState` for more than 6 new state variables (one per toggle)

## When to Stop and Ask

- If the Settings.tsx file structure has changed significantly from what's documented here
- If the `preferences:update` deep merge doesn't work as expected
- If the `connections` state shape doesn't have `.connected` boolean

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (UI-only change, no new logic worth unit testing)
- The toggle save/load uses existing tested preference infrastructure

### Coverage

- Coverage impact: Not enforced (UI toggle component)

### Integration / Feature Tests

- Required scenarios:
  - Visual: All toggles render in Settings
  - Disabled state: Gmail toggles disabled when Gmail not connected
  - Persistence: Toggle a value, close/reopen Settings, verify it persists

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(settings): add contact source preferences UI`
- **Labels**: `feature`, `settings`, `contacts`
- **Depends on**: None (Phase 1 task)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file (Settings.tsx) | +10K |
| Code volume | ~100 lines new JSX + ~40 lines state/handlers | +5K |
| Test complexity | Low (no new tests) | +0K |
| Complexity | Following existing patterns exactly | -5K |

**Confidence:** High

**Risk factors:**
- Settings.tsx is already large (~1040 lines), need to add within existing section
- Deep merge of nested preferences object should work but worth verifying

**Similar past tasks:** TASK-1948 (auto-download toggle, similar pattern)

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
- [ ] (none)

Files modified:
- [ ] src/components/Settings.tsx

Features implemented:
- [ ] Contact Sources section with 6 toggles
- [ ] Disabled state for unconnected providers
- [ ] Preference save/load via existing IPC

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
