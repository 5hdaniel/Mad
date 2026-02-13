# TASK-1983: Personalized welcome back message on Dashboard

**Backlog ID:** BACKLOG-691
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `feature/task-1983-welcome-back-message`
**Estimated Tokens:** ~10K (ui x 1.0)

---

## Objective

When a user logs in for the 2nd time (or any subsequent login), the Dashboard greeting should change from the generic "Welcome to Magic Audit" to a personalized message like "Welcome back, Madison!" using the user's display name.

---

## Context

- `src/components/Dashboard.tsx` line 178-183 currently shows:
  ```tsx
  <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to Magic Audit</h1>
  <p className="text-lg text-gray-600">Transaction compliance made simple</p>
  ```
- The Dashboard component does not currently receive user information as props
- `src/components/WelcomeTerms.tsx` already has the pattern: `const displayName = user?.display_name || user?.email?.split("@")[0] || "there";`
- The app state machine likely tracks whether the user has logged in before (terms accepted = not first login)
- User data including `display_name` is available from the auth/user context

---

## Requirements

### Must Do:
1. Determine if this is the user's first login or a return visit. Options:
   - Check if terms have been accepted (first login goes through WelcomeTerms first, so if they are on Dashboard they have already accepted)
   - Check a `last_login_at` timestamp or similar from user preferences
   - Simplest: if the user has accepted terms, they are a return user (the very first visit shows WelcomeTerms, not Dashboard)
2. Get the user's display name (from auth context, app state, or props)
3. Change the Dashboard greeting:
   - First visit after terms acceptance: "Welcome to Magic Audit" (current behavior -- but this may never show since WelcomeTerms handles first visit)
   - Return visits: "Welcome back, {displayName}!" (e.g., "Welcome back, Madison!")
4. Keep the subtitle: "Transaction compliance made simple"
5. Fallback if no display name: "Welcome back!" (no name)

### Must NOT Do:
- Modify the WelcomeTerms component
- Add a new database table or schema
- Change the authentication flow
- Add a new API call on every Dashboard render

---

## Acceptance Criteria

- [ ] Dashboard shows "Welcome back, {name}!" when user has logged in before
- [ ] Display name is derived from user profile (display_name, or email username as fallback)
- [ ] If no display name available, shows "Welcome back!" without a name
- [ ] Subtitle "Transaction compliance made simple" still shows
- [ ] No additional API calls or performance impact
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/Dashboard.tsx` - Add user prop or context consumption, conditional greeting text

## Files to Read (for context)

- `src/components/Dashboard.tsx` - Current greeting and component interface
- `src/components/WelcomeTerms.tsx` - Display name extraction pattern
- `src/appCore/AppShell.tsx` - Where Dashboard is rendered, what props are available
- `src/appCore/state/types.ts` - User state structure
- `src/appCore/state/machine/selectors/userDataSelectors.ts` - User data selectors

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests unless a utility function is extracted
- **Existing tests to update:** `src/components/__tests__/Dashboard.test.tsx` if it asserts on greeting text

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(dashboard): show personalized welcome back message`
- **Branch:** `feature/task-1983-welcome-back-message`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 10K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- User display name is not accessible from Dashboard without significant plumbing
- The app state machine does not distinguish first vs return visits
- Adding the user prop to Dashboard would require changes to many parent components
- You encounter blockers not covered in the task file
