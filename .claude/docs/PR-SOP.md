# Pull Request Standard Operating Procedure

This document outlines the standard procedure for creating, reviewing, and merging pull requests in Magic Audit. All agents and contributors should follow this SOP.

## Quick Reference

| PR Type | Target Branch | Merge Type | Required Checks |
|---------|---------------|------------|-----------------|
| Feature | `develop` | Traditional | Tests, Security |
| Bug Fix | `develop` | Traditional | Tests, Security |
| Hotfix | `main` + `develop` | Traditional | Tests, Builds, Security |
| Release | `main` (from develop) | Traditional | All checks |

**CRITICAL: Always use traditional merges (not squash) to preserve commit history.**

---

## Phase 0: Target Branch Verification

Before creating a PR, verify you're targeting the correct branch:

| Your Branch Type | Target Branch |
|------------------|---------------|
| `feature/*` | `develop` |
| `fix/*` | `develop` |
| `claude/*` | `develop` |
| `hotfix/*` | `main` AND `develop` |
| `develop` (release) | `main` |

```bash
# Check your current branch
git branch --show-current

# Verify target branch is up to date
git fetch origin
git log --oneline HEAD..origin/develop  # Should be empty or show expected commits
```

---

## Phase 1: Branch Preparation

### 1.1 Sync Branch
Ensure your branch is up-to-date with the target branch:

```bash
git fetch origin
git merge origin/develop  # or origin/main for hotfixes
```

Resolve any merge conflicts before proceeding.

### 1.2 Dependencies
Verify clean dependency installation:

```bash
rm -rf node_modules
npm install

# Rebuild native modules if needed
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

---

## Phase 2: Code Cleanup

### 2.1 Remove Debug Code
Search for and remove:
- [ ] `console.log` statements (except structured logging)
- [ ] `console.warn` / `console.error` (unless intentional)
- [ ] Commented-out code blocks
- [ ] Unused imports
- [ ] Dead code / unreachable code
- [ ] TODO comments that should be resolved

```bash
# Find console statements
grep -rn "console\." src/ --include="*.ts" --include="*.tsx"
```

### 2.2 Style & Formatting
- [ ] Run Prettier/formatter
- [ ] Verify naming conventions (camelCase for variables, PascalCase for components)
- [ ] Check file structure alignment with project standards

```bash
npm run lint -- --fix
```

### 2.3 Structured Error Logging
Ensure proper logging:
- [ ] Use appropriate log levels (error, warn, info, debug)
- [ ] Include context in log messages (function name, relevant IDs)
- [ ] No sensitive data in logs (tokens, passwords, PII)

---

## Phase 3: Security & Documentation

### 3.1 Security Scan
- [ ] No hardcoded secrets, API keys, or tokens
- [ ] No sensitive data in error messages or logs
- [ ] Input validation on user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention in React components

```bash
# Check for potential secrets
grep -rn "password\|secret\|api_key\|token" src/ --include="*.ts" --include="*.tsx" | grep -v "type\|interface"
```

### 3.2 Documentation Updates
If applicable, update:
- [ ] README.md
- [ ] Code comments for complex logic
- [ ] Type definitions
- [ ] .env.example for new environment variables

---

## Phase 4: Testing

### 4.1 Mock Data & Fixtures
- [ ] Test mocks match current API/schema
- [ ] Fixtures are up-to-date
- [ ] No hardcoded test data that could become stale

### 4.2 Automated Tests
- [ ] Unit tests for new functions/utilities
- [ ] Integration tests for new features
- [ ] Component tests for UI changes
- [ ] Target coverage: 40-80%

### 4.3 Test Suite Execution
Run the full test suite locally:

```bash
npm test
```

All tests must pass. No skipped tests without justification.

---

## Phase 5: Static Analysis

### 5.1 Type Check
```bash
npm run type-check
```
- [ ] No TypeScript errors
- [ ] No `any` types without justification

### 5.2 Lint Check
```bash
npm run lint
```
- [ ] No lint errors (warnings acceptable with justification)

### 5.3 Performance Check
Review for:
- [ ] Unnecessary re-renders in React components
- [ ] Missing memoization for expensive computations
- [ ] O(n²) or worse algorithmic complexity
- [ ] Large bundle size additions
- [ ] Inefficient database queries

---

## Phase 6: PR Creation

### 6.1 Commit History
- [ ] Commits are atomic and focused
- [ ] Commit messages follow conventional format:
  - `feat:` - New feature
  - `fix:` - Bug fix
  - `docs:` - Documentation
  - `refactor:` - Code refactoring
  - `test:` - Adding tests
  - `chore:` - Maintenance

### 6.2 Create PR

```bash
git push -u origin your-branch-name

gh pr create --base develop --title "type: description" --body "..."
```

### 6.3 PR Description Template

```markdown
## Summary
- Bullet points describing what this PR does

## Changes
- List of specific changes made

## Test Plan
- [ ] How to test this change
- [ ] What was tested

## Screenshots (if UI changes)
[Add screenshots here]

## Checklist
- [ ] Tests pass locally
- [ ] Type check passes
- [ ] Lint check passes
- [ ] Documentation updated (if needed)
```

---

## Phase 7: CI Verification

Wait for all CI checks to pass:

| Check | Required | Description |
|-------|----------|-------------|
| Test & Lint (macOS) | Yes | Unit tests + linting |
| Test & Lint (Windows) | Yes | Cross-platform verification |
| Security Audit | Yes | npm audit |
| Build Application | Yes | Vite + Electron build |
| Package Application | Main only | Creates DMG/NSIS |

```bash
# Monitor CI status
gh pr checks <PR-NUMBER>
```

---

## Phase 8: Merge

### Pre-Merge Checklist
- [ ] All CI checks pass
- [ ] No merge conflicts
- [ ] PR approved (if reviews required)
- [ ] Target branch is correct

### Merge Command

```bash
# ALWAYS use traditional merge (--merge), NEVER squash
gh pr merge <PR-NUMBER> --merge --delete-branch
```

### Post-Merge
- [ ] Verify merge completed successfully
- [ ] Delete local branch: `git branch -d your-branch-name`
- [ ] Pull latest changes: `git checkout develop && git pull`

---

## Hotfix Procedure

For urgent production fixes:

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/description

# 2. Make fix and test

# 3. Create PR to main
gh pr create --base main --title "hotfix: description"

# 4. After merge to main, also merge to develop
git checkout develop
git pull origin develop
git merge origin/main
git push origin develop
```

---

## Review Checklist (for reviewers)

When reviewing PRs, verify:

- [ ] **Phase 0**: Correct target branch
- [ ] **Phase 1**: Branch is synced, no conflicts
- [ ] **Phase 2**: No debug code, proper formatting
- [ ] **Phase 3**: No security issues, docs updated
- [ ] **Phase 4**: Adequate test coverage
- [ ] **Phase 5**: Type check + lint pass
- [ ] **Phase 6**: Clear PR description
- [ ] **Phase 7**: CI passes

### Review Output Format

```
## PR Review Summary
**Branch**: source → target
**Merge Type**: Traditional (required)
**Status**: APPROVED / CHANGES REQUESTED / BLOCKED
**Risk Level**: LOW / MEDIUM / HIGH

## Checklist Results
[✓/✗/⚠️ for each phase]

## Issues Found
[List any blockers or recommendations]
```

---

## Common Issues & Fixes

### Native Module Mismatch
```bash
npm rebuild better-sqlite3-multiple-ciphers
npx electron-rebuild
```

### Merge Conflicts
```bash
git fetch origin
git merge origin/develop
# Resolve conflicts in editor
git add .
git commit
```

### CI Failures
1. Check the failing job logs on GitHub Actions
2. Run the failing check locally
3. Fix and push

---

## Questions?

- **Architecture decisions**: Consult senior-engineer-pr-lead agent
- **CI/CD issues**: Check `.github/workflows/ci.yml`
- **Branching strategy**: See `CLAUDE.md`
