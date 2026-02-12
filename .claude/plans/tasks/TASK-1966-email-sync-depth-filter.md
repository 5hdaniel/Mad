# Task TASK-1966: Email Sync Depth Filter UI

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Add a user-facing filter control for email sync lookback depth in the email connections settings section. Replace the hardcoded 90-day constant with a configurable preference. Default behavior (3 months / ~90 days) remains unchanged.

## Non-Goals

- Do NOT change the 9-month overall scan lookback (line 289 in transactionService.ts) — that's a separate concern
- Do NOT modify iMessage import lookback (already has its own preference)
- Do NOT add per-account sync depth (single global setting is sufficient)
- Do NOT trigger a re-sync when the setting changes (takes effect on next sync)

## Deliverables

1. Update: `electron/constants.ts` — add `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS = 3`
2. Update: `electron/services/transactionService.ts` (lines 410-412) — replace hardcoded 90-day constant with preference value
3. Update: Email connections settings component (find the UI that shows Gmail/Outlook connections) — add lookback filter control
4. Update: `electron/services/__tests__/incrementalSync.integration.test.ts` — update tests for configurable lookback

## Acceptance Criteria

- [ ] `DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS = 3` constant in `electron/constants.ts`
- [ ] Hardcoded 90-day value in `transactionService.ts:411` replaced with preference-based value
- [ ] `emailSync.lookbackMonths` preference stored in Supabase user preferences
- [ ] UI control in email connections settings (dropdown or similar) matching TASK-1952/BACKLOG-634 pattern
- [ ] Options: 1 month, 3 months (default), 6 months, 12 months
- [ ] Changing the setting takes effect on next sync (no immediate re-sync)
- [ ] All CI checks pass

## Implementation Notes

### Current State

1. **First-sync cap:** 90 days hardcoded in `transactionService.ts:410-412`:
   ```typescript
   // Cap first sync to 90 days
   const ninetyDaysAgo = new Date();
   ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
   ```

2. **Overall scan lookback:** 9 months from user prefs in `transactionService.ts:289`

3. **iMessage import:** `lookbackMonths` preference stored in Supabase (`messageImportHandlers.ts:97-98`) — this is the pattern to follow

### Pattern Reference (TASK-1952 / BACKLOG-634)

The iMessage import filter uses a similar pattern:
- Preference stored in Supabase user preferences
- UI control in settings
- Default value from constants
- Service reads preference and applies

### Constant

```typescript
// electron/constants.ts
export const DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS = 3;
```

### Service Change

```typescript
// Replace hardcoded 90 days with:
const lookbackMonths = userPreferences?.emailSyncLookbackMonths ?? DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS;
const lookbackDate = new Date();
lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths);
```

### UI Control

Add to the email connections settings section (find the component that shows Gmail/Outlook connection status). Pattern:
```tsx
<Select value={lookbackMonths} onValueChange={handleLookbackChange}>
  <SelectItem value="1">1 month</SelectItem>
  <SelectItem value="3">3 months (default)</SelectItem>
  <SelectItem value="6">6 months</SelectItem>
  <SelectItem value="12">12 months</SelectItem>
</Select>
```

### Supabase Preference

Store as `emailSync.lookbackMonths` (number) in user preferences, following the existing pattern for other preferences.

## Integration Notes

- Follow the iMessage import lookback pattern (TASK-1952/BACKLOG-634)
- The 9-month overall scan lookback (line 289) is a SEPARATE setting — do not touch it
- No dependency on other 080B tasks

## Do / Don't

### Do:
- Follow the existing iMessage import filter pattern exactly
- Extract the magic number `90` to the constant
- Default to 3 months (matching current behavior)

### Don't:
- Do NOT trigger a re-sync when the setting changes
- Do NOT modify the 9-month overall lookback
- Do NOT add complex date validation

## When to Stop and Ask

- If the email connections settings UI doesn't exist or is structured very differently than expected
- If the Supabase preferences schema doesn't support adding new fields easily
- If `transactionService.ts` has been significantly refactored since the plan was written

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes
- Update: `electron/services/__tests__/incrementalSync.integration.test.ts` — verify configurable lookback
- Verify: Default value produces same behavior as current 90-day hardcode

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(email): add configurable email sync depth filter`
- **Labels:** `feature`, `email`, `settings`
- **Depends on:** None

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~35K
**Token Cap:** 140K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] electron/constants.ts (new constant)
- [ ] electron/services/transactionService.ts (preference-based lookback)
- [ ] src/ email connections settings component (UI control)
- [ ] electron/services/__tests__/incrementalSync.integration.test.ts

Features implemented:
- [ ] DEFAULT_EMAIL_SYNC_LOOKBACK_MONTHS constant
- [ ] Configurable lookback replacing hardcoded 90 days
- [ ] Settings UI with 1/3/6/12 month options
- [ ] Supabase preference storage

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Default behavior unchanged (3 months)
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>
- Test coverage: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
