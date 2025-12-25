# Magic Audit - Claude Development Guide

This guide is for all Claude agents working on Magic Audit. Follow these standards for all development work.

---

## MANDATORY: Agent Workflow for Sprint Tasks

**CRITICAL: READ THIS BEFORE ANY SPRINT/TASK WORK**

When working on tasks from `.claude/plans/tasks/`, you MUST use the proper agent workflow. Direct implementation is PROHIBITED.

### Required Workflow

```
1. PM assigns task → 2. Engineer agent implements → 3. SR Engineer agent reviews → 4. Merge
```

### Step-by-Step

1. **DO NOT implement tasks directly.** When you see a TASK-XXX file:
   - Invoke the `engineer` agent with `subagent_type="engineer"`
   - Pass the task file path and context
   - Let the engineer agent handle implementation

2. **DO NOT merge PRs without review.** Before any PR merge:
   - Invoke the `senior-engineer-pr-lead` agent with `subagent_type="senior-engineer-pr-lead"`
   - Let the SR Engineer validate architecture, tests, and quality gates
   - Only merge after SR Engineer approval

### Example: Correct Workflow

```
User: "Implement TASK-510"

WRONG (what you've been doing):
- Read the task file
- Write the code yourself
- Create PR and merge

RIGHT (what you must do):
- Invoke Task tool with subagent_type="engineer"
- Prompt: "Implement TASK-510 from .claude/plans/tasks/TASK-510-xxx.md"
- Wait for engineer to complete and hand off to SR Engineer
- Invoke Task tool with subagent_type="senior-engineer-pr-lead" for PR review
- Only merge after SR Engineer approval
```

### Why This Matters

- **Metrics tracking**: Engineer agent tracks turns/tokens/time
- **Quality gates**: SR Engineer validates architecture and tests
- **Audit trail**: Proper handoffs create accountability
- **Consistency**: Same workflow every sprint

**FAILURE TO FOLLOW THIS WORKFLOW IS A PROCESS VIOLATION.**

---

## MANDATORY: Follow Instructions Exactly

**Do ONLY what is explicitly requested. Nothing more.**

### Rules

1. **No extras**: If asked to merge with `--merge`, do NOT add `--delete-branch` or any other flags.

2. **Ask first**: Before doing anything not explicitly requested, ASK:
   - "Should I delete the branch after merge?"
   - "Should I also push to remote?"
   - "Should I update X while I'm here?"

3. **Branch deletion**: NEVER delete branches unless explicitly asked. Integration branches (`int/*`) especially may be needed for reference.

4. **Merge command**: Use exactly `gh pr merge <PR> --merge` unless told otherwise.

### Why This Matters

Adding unrequested actions:
- Creates confusion about what was done
- Can lose work (deleted branches)
- Shows disregard for instructions
- Erodes trust

**When in doubt, ASK.**

---

## Project Overview

Magic Audit is an Electron-based desktop application for real estate transaction auditing. It features:
- Electron main/preload/renderer architecture
- React 18 with TypeScript (strict mode)
- SQLite with encryption for local storage
- Supabase for cloud sync
- Microsoft Graph and Gmail API integrations

## Git Branching Strategy

```
main (production)
  │
  └── PR (traditional merge)
        │
develop (integration/staging)
  │
  └── PR (traditional merge)
        │
feature/*, fix/*, claude/* (your work)
```

### Branch Naming

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/dark-mode` |
| `fix/` | Bug fixes | `fix/login-crash` |
| `hotfix/` | Urgent production fixes | `hotfix/security-patch` |
| `claude/` | AI-assisted development | `claude/refactor-auth` |

### Merge Policy

**CRITICAL: Always use traditional merges (not squash) to preserve commit history.**

### Integration Branch Rules (MANDATORY)

Integration branches (`int/*`) collect related feature work before merging to develop.

**Before starting any new sprint:**
```bash
git branch -a | grep "int/"
```

**If integration branches exist with unmerged work:**

| Option | When to Use |
|--------|-------------|
| Base new sprint on the int/* branch | When existing work is related or foundational |
| Merge int/* to develop first | When existing work is complete and tested |
| Sync both branches regularly | When parallel work is truly needed |

**Never branch new sprint work from develop when develop is behind an active int/* branch.**

This prevents fixes from being lost (as happened with the onboarding fix in `int/ai-polish` when `int/cost-optimization` branched from stale develop).

### Bug Fix Workflow (MANDATORY)

**Before investigating any reported bug:**
```bash
# Check for existing fix branches that may address this issue
git branch -a | grep "fix/"
```

If an existing fix branch seems related:
1. Check its commits: `git log fix/<branch-name> --oneline -5`
2. Compare to develop: `git diff develop...fix/<branch-name> --stat`
3. If it contains the fix, **merge it** instead of starting over

**After creating a fix branch:**

A fix is NOT complete until it's merged. The workflow is:
1. Create branch → 2. Commit fix → 3. Push → 4. Create PR → 5. **Merge to develop**

Do NOT move on to other work until the fix is merged. Unmerged fix branches become orphaned and the same bug gets "fixed" multiple times.

**Cleanup:** After merging, delete the local fix branch:
```bash
git branch -d fix/<branch-name>
```

## Starting New Work

### Step 1: Create Feature Branch

```bash
# Always start from develop
git checkout develop
git pull origin develop

# Create your feature branch
git checkout -b feature/your-feature-name
```

### Step 2: Make Changes

Follow these guidelines:
- Write TypeScript with strict mode compliance
- Add tests for new functionality
- Keep commits atomic and well-described
- Run checks before committing:

```bash
npm run type-check    # TypeScript compilation
npm run lint          # ESLint checks
npm test              # Run test suite
```

### Step 3: Commit Changes

```bash
git add .
git commit -m "feat: add feature description

Detailed explanation if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
"
```

### Commit Message Format

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

### Step 4: Push and Create PR

```bash
git push -u origin feature/your-feature-name

# Create PR targeting develop
gh pr create --base develop --title "feat: your feature" --body "Description..."
```

### Step 5: Wait for CI

Required checks:
- Test & Lint (macOS/Windows, Node 18/20)
- Security Audit
- Build Application

### Step 6: Merge

After CI passes, merge with traditional merge (not squash):

```bash
gh pr merge <PR-NUMBER> --merge
```

## Code Standards

### TypeScript
- Strict mode enabled
- No `any` types without justification
- Proper error handling with typed errors

### React
- Functional components with hooks
- Proper dependency arrays in useEffect
- Memoization for expensive computations

### Electron
- Clear IPC boundaries (main/preload/renderer)
- No direct `window.api` calls in components - use service abstractions
- Encryption at all data layers

### Testing
- Jest + React Testing Library
- Target 40-80% coverage
- No flaky tests

## Architecture Boundaries

**Full reference:** `.claude/docs/shared/architecture-guardrails.md`

### Entry File Line Budgets

| File | Max Lines |
|------|-----------|
| `App.tsx` | **70** |
| `AppShell.tsx` | 150 |
| `AppRouter.tsx` | 250 |
| `useAppStateMachine.ts` | 300 |

### DO:
- Keep business logic in services/hooks
- Use typed interfaces for IPC communication
- Isolate platform-specific code
- Keep `App.tsx` purely compositional (~70 lines max)

### DON'T:
- Add business logic to App.tsx or entry files
- Scatter `window.api`/`window.electron` calls in components
- Exceed entry file line budgets without extraction

## Common Commands

```bash
# Development
npm run dev              # Start Electron in dev mode
npm run build            # Build for production

# Testing
npm test                 # Run all tests
npm run type-check       # TypeScript check
npm run lint             # ESLint check

# Native modules (REQUIRED after npm install or Node.js update)
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

### Native Module Errors

If you see this error, rebuild native modules:
```
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 133.
```

**Symptoms**: Database fails to initialize, app stuck on loading/onboarding screens in an infinite loop.

**Fix (try in order)**:

1. Standard rebuild:
```bash
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

2. If that doesn't work (common on Windows without Python), use prebuild-install:
```powershell
# Clear prebuild cache and download correct Electron binary
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\npm-cache\_prebuilds"
Remove-Item -Recurse -Force "node_modules\better-sqlite3-multiple-ciphers\build"
cd node_modules/better-sqlite3-multiple-ciphers
npx prebuild-install --runtime=electron --target=35.7.5 --arch=x64 --platform=win32
```
(Replace `35.7.5` with your Electron version from `npx electron --version`)

**When to rebuild**:
- After `npm install`
- After upgrading Node.js
- After pulling changes with dependency updates
- After switching branches with different dependencies

## Key Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Docs Index** | `.claude/docs/INDEX.md` | Master index of all documentation |
| **PR SOP** | `.claude/docs/PR-SOP.md` | Complete PR checklist (all phases) |
| **Senior Engineer** | `.claude/agents/senior-engineer-pr-lead.md` | Architecture standards, advanced reviews |
| **This Guide** | `CLAUDE.md` | Quick start, branching, workflow |

### Shared References (Canonical Sources)

| Topic | Location |
|-------|----------|
| Plan-First Protocol | `.claude/docs/shared/plan-first-protocol.md` |
| Metrics Templates | `.claude/docs/shared/metrics-templates.md` |
| Architecture Guardrails | `.claude/docs/shared/architecture-guardrails.md` |
| Git Branching | `.claude/docs/shared/git-branching.md` |
| Effect Safety Patterns | `.claude/docs/shared/effect-safety-patterns.md` |
| Native Module Fixes | `.claude/docs/shared/native-module-fixes.md` |

## Getting Help

- **PR preparation/review**: Follow `.claude/docs/PR-SOP.md`
- **Architecture questions**: Use the senior-engineer-pr-lead agent
- **Complex PR reviews**: Use the senior-engineer-pr-lead agent
- **Code exploration**: Use the Explore agent

## Quick Reference

| Task | Target Branch | Merge Type |
|------|---------------|------------|
| New feature | `develop` | Traditional |
| Bug fix | `develop` | Traditional |
| Hotfix | `main` + `develop` | Traditional |
| Release | `main` (from develop) | Traditional |
