# SPRINT-071: Security Vulnerability Fixes

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint ID** | SPRINT-071 |
| **Branch** | `sprint/071-security-fixes` |
| **Base** | `develop` |
| **Status** | Planning |
| **Created** | 2026-02-05 |

## Sprint Goals

Address all security vulnerabilities identified in the security review, prioritized by severity:
- **P0 (Critical)**: Must fix before any deployment
- **P1 (High)**: Required for this sprint
- **P2 (Medium)**: Important hardening measures
- **P3 (Low)**: Best practice improvements

## Task Summary

| Task ID | Title | Priority | Status | Estimated Tokens |
|---------|-------|----------|--------|------------------|
| TASK-1900 | Upgrade Next.js to 14.2.35 | P0 | Pending | ~5K |
| TASK-1901 | Fix npm audit vulnerabilities | P1 | Pending | ~8K |
| TASK-1902 | Implement strict CSP headers | P2 | Pending | ~12K |
| TASK-1903 | Audit debug logging for sensitive data | P3 | Pending | ~6K |

## Phase 1: Critical Fixes (P0)

### TASK-1900: Upgrade Next.js to 14.2.35

**Priority:** P0 - Critical
**Issue:** CRITICAL-001 - Next.js Authorization Bypass (CVE with CVSS 9.1)

Current version 14.2.21 has multiple critical and high severity vulnerabilities:
- Authorization Bypass in Middleware (CVSS 9.1)
- Denial of Service with Server Components (CVSS 7.5)
- Multiple image optimization vulnerabilities

**Acceptance Criteria:**
- [ ] Next.js upgraded to 14.2.35
- [ ] eslint-config-next upgraded to match
- [ ] All tests pass
- [ ] Application builds successfully
- [ ] Manual smoke test of auth flow

## Phase 2: High Priority Fixes (P1)

### TASK-1901: Fix npm audit vulnerabilities

**Priority:** P1 - High
**Issue:** HIGH-001-004 - Dependabot vulnerabilities

Fix remaining npm audit issues:
- glob package command injection vulnerability
- Any transitive dependency issues

**Acceptance Criteria:**
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] All tests pass
- [ ] No breaking changes to functionality

## Phase 3: Medium Priority Hardening (P2)

### TASK-1902: Implement strict CSP headers

**Priority:** P2 - Medium
**Issue:** MEDIUM-004 - CSP unsafe-inline

Implement Content Security Policy headers in next.config.mjs:
- Remove unsafe-inline where possible
- Add nonce-based script loading for inline scripts
- Configure proper source allowlists

**Acceptance Criteria:**
- [ ] CSP headers configured in next.config.mjs
- [ ] No CSP violations in browser console
- [ ] Application functions correctly with strict CSP

## Phase 4: Low Priority Improvements (P3)

### TASK-1903: Audit debug logging for sensitive data

**Priority:** P3 - Low
**Issue:** LOW-001 - Debug logging audit

Review all console.log, console.error, and logging statements for:
- User credentials or tokens
- PII (email, names, phone numbers)
- Internal system details that could aid attackers

**Acceptance Criteria:**
- [ ] All log statements reviewed
- [ ] Sensitive data redacted or removed from logs
- [ ] Logging patterns documented

## Dependency Graph

```
TASK-1900 (Next.js upgrade)
    |
    v
TASK-1901 (npm audit) -- depends on Next.js being upgraded first
    |
    v
TASK-1902 (CSP headers) -- independent, can run after 1901
    |
    v
TASK-1903 (Logging audit) -- independent, can run after 1902
```

**Execution Order:** Sequential (each task modifies shared config files)

## Notes on Excluded Items

The following items from the original security review are **NOT applicable** to this broker-portal project:

| Original Issue | Reason for Exclusion |
|----------------|---------------------|
| CRITICAL-002: Session Tokens in Plaintext | Electron-specific (safeStorage) - this is a Next.js web app |
| HIGH-003: Service Role Key Fallback | Electron supabaseService.ts - not present in broker-portal |
| MEDIUM-001: shell:openExternal URL validation | Electron-specific - not applicable to Next.js |

These issues should be addressed in the main Magic Audit Electron application, not here.

## SR Engineer Technical Review

**Status:** Pending

Before implementation, SR Engineer should:
1. Verify Next.js 14.2.35 compatibility with current codebase
2. Check for any breaking changes in the upgrade path
3. Confirm CSP implementation approach for Next.js 14
4. Identify any shared file conflicts

---

## Completion Checklist

- [ ] All P0 tasks completed and merged
- [ ] All P1 tasks completed and merged
- [ ] P2 tasks completed (if time permits)
- [ ] P3 tasks completed (if time permits)
- [ ] `npm audit` shows clean results
- [ ] Application tested in development
- [ ] Branch ready for user functional testing
