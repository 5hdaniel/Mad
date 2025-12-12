# Magic Audit - Claude Development Guide

This guide is for all Claude agents working on Magic Audit. Follow these standards for all development work.

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

Co-Authored-By: Claude <co-author>
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

### DO:
- Keep business logic in services/hooks
- Use typed interfaces for IPC communication
- Isolate platform-specific code

### DON'T:
- Add business logic to App.tsx or entry files
- Scatter `window.api`/`window.electron` calls in components
- Create files over ~300 lines without splitting

## Common Commands

```bash
# Development
npm run dev              # Start Electron in dev mode
npm run build            # Build for production

# Testing
npm test                 # Run all tests
npm run type-check       # TypeScript check
npm run lint             # ESLint check

# Native modules (after npm install or Node.js update)
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

## Key Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **PR SOP** | `.claude/docs/PR-SOP.md` | Complete PR checklist (all phases) |
| **Senior Engineer** | `.claude/agents/senior-engineer-pr-lead.md` | Architecture standards, advanced reviews |
| **This Guide** | `CLAUDE.md` | Quick start, branching, workflow |

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
