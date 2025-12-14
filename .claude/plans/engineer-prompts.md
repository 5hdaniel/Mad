# Engineer Assignment Prompts

## Overview

These are the exact prompts to be given to engineers for each task in the onboarding refactor sprint. Each prompt is self-contained and provides everything needed to execute the task.

---

## 🚨 ENGINEER GUARDRAILS (READ FIRST)

Every engineer MUST follow these guardrails. PRs will be REJECTED if these are not followed.

### 1. Setup Requirements (MANDATORY - DO NOT SKIP)

⚠️ **WARNING**: If you skip this step or branch from the wrong place, your PR will be REJECTED.

```bash
# Step 1: Fetch and branch from the integration branch (NOT main, NOT develop)
git fetch origin claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
git checkout -b <your-branch-name> origin/claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
```

**If Claude Code auto-created a branch for you**, you MUST rebase it:
```bash
git fetch origin claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
git rebase origin/claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
```

### 2. Verify You're On The Correct Base (REQUIRED)

Run this command and verify the files exist:
```bash
ls -la src/components/onboarding/
```

**You MUST see these files** (depending on which task you're doing):
- `types.ts` - Required for TASK-102 and later
- `steps/index.ts` - Required for TASK-103 and later

**If these files are MISSING:**
1. STOP - you branched from the wrong place
2. Delete your branch: `git checkout main && git branch -D <your-branch-name>`
3. Re-run Step 1 above

### 3. Read the Task File First

Before writing ANY code:
1. Read the full task file in `.claude/plans/tasks/TASK-XXX-*.md`
2. Read any referenced addenda in `.claude/plans/addendum-*.md`
3. Understand the acceptance criteria
4. Note the specific values, names, and patterns specified

### 4. Follow the Plan Exactly

**DO NOT deviate from the plan without documenting it.**

If the task file specifies:
- Specific type names → use those exact names
- Specific step IDs → use those exact IDs
- Specific file locations → create files in those exact locations
- Specific function signatures → implement those exact signatures

If you believe a deviation is necessary:
1. Document it clearly in your Implementation Summary
2. Explain WHY you deviated
3. Flag it with "⚠️ DEVIATION FROM PLAN:" prefix
4. The PM will review and decide if it's acceptable

### 5. Before Opening PR (REQUIRED)

You MUST complete ALL of these before opening your PR:

#### A. Update the Implementation Summary

Go to the task file's "Implementation Summary (Engineer-Owned)" section and:

1. Check all completed boxes: `- [ ]` → `- [x]`
2. Add completion date
3. Add a "### Notes" section with:
   - Any deviations from plan (with reasoning)
   - Issues or challenges encountered
   - Design decisions you made and why
   - Anything the reviewer should pay attention to

#### B. Verify Your Work

```bash
npm run type-check  # Must pass
npm run lint        # Must pass
npm test            # Must pass (if tests exist)
```

#### C. Self-Review Checklist

Before opening PR, verify:
- [ ] All acceptance criteria in task file are met
- [ ] Implementation Summary is complete with notes
- [ ] No deviations from plan (or deviations are documented)
- [ ] All specified names/IDs/patterns match the plan exactly
- [ ] Code compiles and lints cleanly

### 6. PR Requirements

- **Target branch:** `claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J`
- **Title format:** `feat(onboarding): <description from task>`
- **PR will be REJECTED if:**
  - Implementation Summary is not complete
  - Deviations exist without documentation
  - CI checks fail
  - Acceptance criteria not met

### 7. When to Stop and Ask

STOP and ask the PM before proceeding if:
- Requirements are ambiguous or contradictory
- You need to deviate from the plan significantly
- You encounter a blocker not covered in the task file
- The specified approach won't work for technical reasons
- You're unsure about a design decision

**It's better to ask than to assume.**

---

## Phase 1: Foundation

### TASK-101: Type Definitions ✅ COMPLETED

*This task has been completed and merged.*

---

### TASK-102: Step Registry ✅ COMPLETED

*This task has been completed and merged.*

---

### TASK-103: Flow Definitions

```
You are assigned Task TASK-103 – "Create Flow Definitions".

## Setup
Base branch: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
Your branch: feat/103-flow-definitions

git fetch origin claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
git checkout -b feat/103-flow-definitions origin/claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J

## Task Files (READ THESE FIRST)
- .claude/plans/tasks/TASK-103-flow-definitions.md

## Context
TASK-102 must be merged first. You'll have access to:
- src/components/onboarding/types.ts
- src/components/onboarding/steps/index.ts

## Deliverables
- Create: src/components/onboarding/flows/macosFlow.ts
- Create: src/components/onboarding/flows/windowsFlow.ts
- Create: src/components/onboarding/flows/index.ts

## Instructions

### CRITICAL: Use these EXACT step IDs

macOS flow order (use these exact IDs):
['phone-type', 'secure-storage', 'email-connect', 'permissions']

Windows flow order (use these exact IDs):
['phone-type', 'email-connect', 'apple-driver']

### Platform Validation
getFlowSteps(platform) must:
1. Return ordered OnboardingStep[] for the platform
2. Validate each step supports the platform
3. Throw descriptive error if step doesn't support platform:
   "Step 'X' does not support platform 'Y'. Supported: [Z].
    Either remove from flow or add platform to step."

## Verification
- npm run type-check passes
- npm run lint passes

## ⚠️ BEFORE OPENING PR

1. Update `.claude/plans/tasks/TASK-103-flow-definitions.md`:
   - Complete the Implementation Summary section
   - Check all boxes [x]
   - Add Notes section with any deviations/decisions

2. Self-review:
   - [ ] Step IDs match EXACTLY as specified above
   - [ ] All acceptance criteria met
   - [ ] Implementation Summary complete
   - [ ] CI passes

PR target: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
PR title: feat(onboarding): add platform flow definitions with validation
```

---

## Phase 2: Shell Components

### TASK-104: OnboardingShell

```
You are assigned Task TASK-104 – "Create OnboardingShell Layout Wrapper".

## Setup
Base branch: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
Your branch: feat/104-onboarding-shell

git fetch origin claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
git checkout -b feat/104-onboarding-shell origin/claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J

## Task Files (READ THESE FIRST)
- .claude/plans/tasks/TASK-104-onboarding-shell.md

## Deliverables
- Create: src/components/onboarding/shell/OnboardingShell.tsx
- Create: src/components/onboarding/shell/index.ts

## Instructions
Create a layout wrapper with these EXACT styles (match existing screens):
- Background: `bg-gradient-to-br from-slate-50 to-blue-50`
- Container: `min-h-screen flex items-center justify-center p-4`
- Inner wrapper: `max-w-xl w-full`
- Card: `bg-white rounded-2xl shadow-xl p-8`

Props:
- progressSlot?: React.ReactNode (above card)
- navigationSlot?: React.ReactNode (below card content)
- children: React.ReactNode (inside card)

This is a LAYOUT component only. No business logic.

## Verification
- npm run type-check passes
- npm run lint passes

## ⚠️ BEFORE OPENING PR

1. Update `.claude/plans/tasks/TASK-104-onboarding-shell.md`
2. Complete Implementation Summary with notes
3. Verify styles match existing onboarding screens exactly

PR target: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
PR title: feat(onboarding): add OnboardingShell layout wrapper
```

---

### TASK-105: ProgressIndicator

```
You are assigned Task TASK-105 – "Create Unified ProgressIndicator".

## Setup
Base branch: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
Your branch: feat/105-progress-indicator

git fetch origin claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
git checkout -b feat/105-progress-indicator origin/claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J

## Task Files (READ THESE FIRST)
- .claude/plans/tasks/TASK-105-progress-indicator.md

## Deliverables
- Create: src/components/onboarding/shell/ProgressIndicator.tsx
- Update: src/components/onboarding/shell/index.ts

## Instructions
Create a progress indicator that reads from step metadata.

Props:
- steps: OnboardingStep[] (from flow)
- currentIndex: number
- viewingIndex?: number (for back navigation)

Visual specs (MUST match existing SetupProgressIndicator.tsx):
- Circle: `w-8 h-8 rounded-full`
- Completed: `bg-green-500 text-white` + checkmark SVG
- Current: `bg-blue-500 text-white` + `ring-2 ring-offset-2 ring-blue-500`
- Pending: `bg-gray-200 text-gray-500`
- Connecting line: `h-0.5 mx-1 max-w-[48px]`
- Labels: `text-xs` below circles

KEY: Labels come from `step.meta.progressLabel` (single source of truth)

## Verification
- npm run type-check passes
- npm run lint passes

## ⚠️ BEFORE OPENING PR

1. Update `.claude/plans/tasks/TASK-105-progress-indicator.md`
2. Complete Implementation Summary with notes
3. Visually compare with existing SetupProgressIndicator.tsx

PR target: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
PR title: feat(onboarding): add unified ProgressIndicator component
```

---

### TASK-106: NavigationButtons

```
You are assigned Task TASK-106 – "Create NavigationButtons Component".

## Setup
Base branch: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
Your branch: feat/106-navigation-buttons

git fetch origin claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
git checkout -b feat/106-navigation-buttons origin/claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J

## Task Files (READ THESE FIRST)
- .claude/plans/tasks/TASK-106-navigation-buttons.md
- .claude/plans/addendum-01-state-persistence.md

## Deliverables
- Create: src/components/onboarding/shell/NavigationButtons.tsx
- Update: src/components/onboarding/shell/index.ts

## Instructions
Create configurable navigation buttons.

Props:
- showBack: boolean
- showNext: boolean
- skipConfig?: SkipConfig | false
- backLabel?: string (default: "Back")
- nextLabel?: string (default: "Continue")
- nextDisabled?: boolean
- isStepComplete?: boolean (per Addendum 01 - disables Next until step complete)
- onBack?: () => void
- onNext?: () => void
- onSkip?: () => void

Button styles (MUST match existing):
- Back: `bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200`
- Next: `bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600`
- Skip: `text-sm text-gray-500 hover:text-gray-700 underline` (centered above buttons)
- All: `flex-1 px-4 py-3 transition-colors`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

## Verification
- npm run type-check passes
- npm run lint passes

## ⚠️ BEFORE OPENING PR

1. Update `.claude/plans/tasks/TASK-106-navigation-buttons.md`
2. Complete Implementation Summary with notes
3. Test all button combinations render correctly

PR target: claude/fix-onboarding-flow-01QTesyUwNYxSQs4qSx8MZ1J
PR title: feat(onboarding): add NavigationButtons component
```

---

## Phase 3: Step Extraction

*Note: Phase 3 tasks can run in parallel after Phase 2 is complete.*

### TASK-107 through TASK-112

See individual task files in `.claude/plans/tasks/` for full prompts.

Each step extraction follows this pattern:
1. Read the task file AND the addendum
2. Create step file in `src/components/onboarding/steps/`
3. Register in step registry
4. Use EXACT step IDs from the plan
5. Complete Implementation Summary before PR

---

## Phase 4: Integration

### TASK-113 through TASK-116

See individual task files in `.claude/plans/tasks/` for full prompts.

These must run sequentially: 113 → 114 → 115 → 116

---

## Sprint Completion Checklist

When all tasks are complete:

1. [ ] All task branches merged to integration branch
2. [ ] All Implementation Summaries completed
3. [ ] Integration branch CI is green
4. [ ] Manual testing of full flows complete
5. [ ] Old components marked deprecated
6. [ ] All tests passing
7. [ ] Integration branch merged to main
