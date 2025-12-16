# SR Engineer Release Readiness Checklist

This checklist defines what the SR Engineer must verify before any production release. These are the questions a senior engineer asks to ensure the codebase is stable, maintainable, and ready for signing/notarizing.

---

## 1. Code Quality & Durability

### Type Safety Assessment

Ask yourself:
- Have all type checks passed?
- Is the codebase type-safe?
- Are there `any` types that create risk?

**Verification Checklist**
- [ ] `npm run type-check` passes with zero errors
- [ ] TypeScript strict mode enabled
- [ ] No `any` types without documented justification
- [ ] No `@ts-ignore` without justification comment
- [ ] JSDoc types used where TypeScript isn't (if applicable)
- [ ] Stricter ESLint rules considered for type-like safety
- [ ] Large IPC/service surface area has type coverage

### Test Coverage Assessment

Ask yourself:
- What test coverage is missing?
- Are critical paths adequately tested?
- Are there areas with zero coverage?

**Coverage Targets**
| Area | Target | Priority |
|------|--------|----------|
| Global (statements) | > 50% | Minimum |
| Core utilities | > 80% | High |
| Migrations | > 90% | Critical |
| UI components | > 40% | Medium |
| IPC handlers | > 60% | High |
| Auth flows | > 80% | Critical |
| Export/sync flows | > 70% | High |
| Encryption/decryption | > 90% | Critical |

**Verification Checklist**
- [ ] `npm test -- --coverage` shows acceptable coverage
- [ ] Critical paths meet higher thresholds
- [ ] No critical path has zero coverage
- [ ] Coverage not decreasing from previous release
- [ ] Gap analysis documented with BACKLOG items

### Test Results

Ask yourself:
- Have all test checks passed?
- Are there flaky tests?
- Are there skipped tests?

**Verification Checklist**
- [ ] All tests pass (`npm test`)
- [ ] Tests pass consistently (run 3x, no flakiness)
- [ ] No skipped tests without documented justification
- [ ] Test execution time reasonable (not degraded)
- [ ] Integration tests cover multi-step flows
- [ ] Chaos testing considered for timeouts/retries/cancellation

### State Management Assessment

Ask yourself:
- Is state management maintainable?
- Are there signs of state explosion?
- Should state be modularized?

**Verification Checklist**
- [ ] Frontend state not suffering from "state explosion"
- [ ] useState variables organized logically
- [ ] Complex state uses reducers or state machines
- [ ] State isolated by concern (auth, UI, data)
- [ ] Context or state library considered if App.jsx has too many useState
- [ ] State changes predictable and traceable

### Database Migrations

Ask yourself:
- Are migrations additive and safe?
- Can we rollback if something goes wrong?
- Are migrations tested against production-like data?

**Verification Checklist**
- [ ] Migrations are additive (no destructive changes without migration path)
- [ ] Migrations are indexed (numbered, ordered)
- [ ] Rollback tested or rollback plan documented
- [ ] Smoke tests run against production-like snapshots
- [ ] Migration performance acceptable for large databases
- [ ] Backup before migration enforced

---

## 2. Build Quality

### Type & Lint Checks

- [ ] `npm run type-check` passes (zero errors)
- [ ] `npm run lint` passes (zero errors, warnings reviewed)
- [ ] Build warnings investigated and acceptable

### Build Verification

- [ ] `npm run build` completes without errors
- [ ] Output files generated correctly
- [ ] Assets bundled properly
- [ ] No development-only code in production build

### Package Size Analysis

Ask yourself:
- Is the package size reasonable for the functionality?
- Is it too small (something missing)?
- Is it too large (bloat)?

**Size Investigation**
- [ ] Run `npm pack --dry-run` to check size
- [ ] Compare to previous release
- [ ] If concerning, analyze bundle:
  - Duplicate dependencies?
  - Unused code not tree-shaken?
  - Large assets that should be lazy-loaded?
  - Source maps in production?

---

## 3. QA Perspective Tasks

Ask yourself:
- What QA tasks are required before release?
- Has the app been manually tested on all platforms?
- Are edge cases covered?

### Platform Testing

**macOS**
- [ ] Fresh install tested
- [ ] Upgrade from previous version tested
- [ ] App launches correctly
- [ ] Full Disk Access permission flow works
- [ ] Keychain access works
- [ ] Apple Silicon (arm64) tested
- [ ] Intel (x64) tested
- [ ] Menu bar functions work
- [ ] Notifications work

**Windows**
- [ ] Fresh install tested
- [ ] Upgrade from previous version tested
- [ ] App launches correctly
- [ ] Credential Manager access works
- [ ] Windows Defender doesn't flag app
- [ ] Admin elevation handled properly
- [ ] System tray functions work
- [ ] Notifications work

### Functional Testing

- [ ] All user flows manually verified
- [ ] Auth flows tested (login, logout, token refresh)
- [ ] Data sync flows tested
- [ ] Export flows tested
- [ ] Scanning/import flows tested
- [ ] Edge cases tested (offline, slow network, large data)

### Performance Testing

- [ ] App startup time acceptable
- [ ] Memory usage stable (no leaks over time)
- [ ] CPU usage reasonable when idle
- [ ] Large dataset handling tested
- [ ] Database operations meet performance budgets
- [ ] IPC throughput acceptable
- [ ] Performance not regressed from previous release

### Platform Dependencies

- [ ] macOS Full Disk Access requirement documented
- [ ] Native sqlite rebuilds documented
- [ ] Health checks added for platform dependencies
- [ ] Installer-time validations reduce user friction

---

## 4. Code Hygiene

Ask yourself:
- Has the codebase been cleaned and readied for release?
- Is there debug code that shouldn't ship?
- Are there incomplete features?

### Cleanup Checklist

- [ ] No debug `console.log` statements
- [ ] No `console.warn`/`console.error` unless intentional
- [ ] No commented-out code blocks
- [ ] No TODO/FIXME comments for this release
- [ ] No hardcoded test data
- [ ] No development-only features enabled
- [ ] Feature flags set to production values
- [ ] Dead code removed

**Verification Commands:**
```bash
# Find console statements
grep -rn "console\." src/ --include="*.ts" --include="*.tsx"

# Find TODOs
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx"
```

### Documentation

- [ ] README accurate and current
- [ ] CHANGELOG updated with this release
- [ ] API documentation current
- [ ] Inline comments accurate

---

## 5. Signing & Notarizing Readiness

Ask yourself:
- Is the codebase ready for signing and notarizing?
- Are certificates valid and accessible?
- Is the build pipeline configured?

### macOS Code Signing

- [ ] Apple Developer certificate valid
- [ ] Certificate not expiring soon (> 30 days)
- [ ] Signing identity accessible in keychain
- [ ] Entitlements file correct
- [ ] Hardened runtime enabled
- [ ] All binaries will be signed
- [ ] Hardened runtime exceptions documented

### macOS Notarization

- [ ] App ID registered with Apple
- [ ] Notarization credentials configured
- [ ] Previous notarization issues resolved
- [ ] Stapling configured

### Windows Code Signing

- [ ] Code signing certificate valid
- [ ] Certificate not expiring soon (> 30 days)
- [ ] EV certificate for SmartScreen reputation (if applicable)
- [ ] Signing integrated in build pipeline

### Build Pipeline

- [ ] CI/CD configured for release builds
- [ ] Signing integrated
- [ ] Notarization integrated (macOS)
- [ ] Artifacts uploaded to correct location
- [ ] Release workflow tested

---

## 6. Release Versioning

Ask yourself:
- Is the codebase ready for a new release?
- What should the new release version be?
- Is the CHANGELOG complete?

### Version Decision

**Semantic Versioning Rules:**
- MAJOR (X.0.0): Breaking changes, incompatible API changes
- MINOR (X.Y.0): New features, backwards compatible
- PATCH (X.Y.Z): Bug fixes, backwards compatible

**Document changes:**
```markdown
| Change | Type | Impact |
|--------|------|--------|
| [description] | feature/fix/breaking | major/minor/patch |
```

### Version Checklist

- [ ] Version number decided based on changes
- [ ] package.json updated
- [ ] CHANGELOG.md updated
- [ ] Release notes written
- [ ] Known issues documented
- [ ] Upgrade instructions (if breaking changes)

---

## 7. Operational Readiness

### Logging & Monitoring

- [ ] Electron logging configured
- [ ] Log retention policy defined
- [ ] Redaction policies for sensitive data
- [ ] Log review routines established (especially auth/export)

### Performance Guardrails

- [ ] Performance budgets defined for key operations
- [ ] Benchmark tests for database operations
- [ ] IPC throughput benchmarks
- [ ] Regression detection in place

### Incident Response

- [ ] Rollback plan documented
- [ ] Support team notified of release
- [ ] Monitoring in place
- [ ] Incident playbooks exist for common issues

---

## 8. Final Checks

### Pre-Release

- [ ] All sections above completed
- [ ] All BLOCK issues resolved
- [ ] Security checklist completed (SR-SECURITY-CHECKLIST.md)
- [ ] Risk register reviewed
- [ ] Stakeholders notified

### Release Artifacts

- [ ] macOS DMG built, signed, notarized
- [ ] Windows NSIS installer built, signed
- [ ] All installers tested
- [ ] Installers uploaded to distribution
- [ ] Auto-update server configured (if applicable)
- [ ] SBOM generated

### Post-Release

- [ ] Monitoring confirms successful deployment
- [ ] Initial user feedback collected
- [ ] Hotfix path clear if issues arise

---

## 9. Release Decision

### Summary

| Category | Status | Notes |
|----------|--------|-------|
| Type Safety | PASS/FAIL | |
| Test Coverage | PASS/FAIL | X% overall |
| Test Results | PASS/FAIL | X/Y tests |
| Code Quality | PASS/FAIL | |
| Build | PASS/FAIL | |
| QA (macOS) | PASS/FAIL | |
| QA (Windows) | PASS/FAIL | |
| Code Hygiene | PASS/FAIL | |
| Signing Ready | PASS/FAIL | |
| Security | PASS/FAIL | (see security checklist) |

### Gaps & Risks

```markdown
| Gap | Severity | Accepted Risk? | Remediation |
|-----|----------|----------------|-------------|
| [description] | [Critical/High/Medium/Low] | [Yes/No] | [BACKLOG-XXX] |
```

### Decision

- [ ] **APPROVED FOR RELEASE** - All checks pass
- [ ] **APPROVED WITH KNOWN ISSUES** - Risks documented and accepted
- [ ] **BLOCKED** - Critical issues must be resolved

### Sign-off

```
Version: X.Y.Z
SR Engineer: _________________
Date: _________
Notes: _________________________________________________
```
