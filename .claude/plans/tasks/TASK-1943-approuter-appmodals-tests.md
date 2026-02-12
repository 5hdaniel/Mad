# Task TASK-1943: Add Tests for AppRouter.tsx and AppModals.tsx

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

---

## Goal

Add unit test coverage for two core app infrastructure components: `AppRouter.tsx` (routing logic) and `AppModals.tsx` (modal conditional rendering). These are critical components with zero test coverage.

## Non-Goals

- Do NOT test individual modal contents (those have their own tests)
- Do NOT test route page components (test routing logic only)
- Do NOT achieve 100% coverage — focus on critical paths
- Do NOT modify source files (test-only task)

## Deliverables

1. New file: `tests/appCore/AppRouter.test.tsx` — Test routing logic per app state
2. New file: `tests/appCore/AppModals.test.tsx` — Test modal conditional rendering

## Technical Details

### AppRouter.test.tsx

Test the routing logic based on app state machine states:

- **Loading state** → renders loading/splash screen
- **Login state** → renders login page
- **Dashboard state** → renders main dashboard
- **Setup states** → renders appropriate setup flow
- **Error state** → renders error screen

Mock the app state context and verify the correct route/component renders for each state.

### AppModals.test.tsx

Test that modals render conditionally based on app state:

- Each modal only appears when its trigger condition is met
- Modals don't render when their condition is false
- Multiple modals can be active simultaneously if the design allows
- Modal close callbacks update state correctly

Note: After Phase 1, AppModals may have extracted components (TASK-1940). Write tests against the final structure on develop after Phase 1 merges.

### Testing Patterns

Follow existing test patterns in the codebase:
- Use React Testing Library
- Mock `window.api` / `window.electron` as needed
- Mock the app state machine context
- Use `@testing-library/jest-dom` matchers

## Acceptance Criteria

- [ ] `tests/appCore/AppRouter.test.tsx` exists and tests routing logic per app state
- [ ] `tests/appCore/AppModals.test.tsx` exists and tests conditional modal rendering
- [ ] Tests cover: loading, login, dashboard, setup, and error routes
- [ ] Tests cover: each modal renders only when triggered
- [ ] All new tests pass
- [ ] No existing tests broken
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

## Branch & Worktree

- **Branch:** `test/TASK-1943-approuter-appmodals-tests`
- **Worktree:** `../Mad-TASK-1943`
- **Base:** `develop` (after Phase 1 merges)
- **Target:** `develop`

## Sprint

- **Sprint:** SPRINT-076
- **Phase:** 2 (parallel with TASK-1942, after Phase 1 complete)
- **Priority:** P2 Medium
- **Estimated Tokens:** ~35K
