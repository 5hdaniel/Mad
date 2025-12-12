# MagicAudit Technical Debt & Backlog

**Generated:** December 12, 2025
**Codebase Size:** ~60K LOC (source) + ~34K LOC (tests) = ~94K LOC total
**Tech Stack:** Electron 35 + React 18 + TypeScript (strict) + SQLite

---

## Executive Summary

| Category | Status | Score |
|----------|--------|-------|
| **Test Coverage** | Moderate | 66% |
| **Code Complexity** | Poor | 11 files over 500 LOC |
| **Security** | Good foundation, critical fixes needed | 7.6/10 |
| **Performance** | Multiple O(n^2) patterns | Needs work |
| **Dependencies** | Clean, 2 deprecated | 9/10 |

---

## 1. Test Coverage Analysis

### Overall Coverage: 66%

| Category | Files | Tested | Coverage |
|----------|-------|--------|----------|
| Electron Services | 35 | 29 | **82%** |
| Electron Handlers | 11 | 7 | **63%** |
| Electron Utils | 7 | 7 | **100%** |
| React Components | 53 | 24 | **45%** |
| React Hooks | 4 | 4 | **100%** |
| React Contexts | 3 | 3 | **100%** |
| React Utils | 3 | 3 | **100%** |

### Missing Tests - Services (6 files)
- `addressVerificationService.ts`
- `connectionStatusService.ts`
- `contactsService.ts`
- `enhancedExportService.ts`
- `transactionExtractorService.ts`

### Missing Tests - Handlers (4 files)
- `backup-handlers.ts`
- `device-handlers.ts`
- `driver-handlers.ts`
- `sync-handlers.ts`

### Missing Tests - Components (29 files)
**High Priority:**
- `Login.tsx`
- `OnboardingWizard.tsx`
- `Dashboard.tsx`
- `ConversationList.tsx`
- `ContactDetails.tsx`
- `ContactList.tsx`

**Medium Priority:**
- `ExportModal.tsx`
- `ManualTransactionModal.tsx`
- `MicrosoftLogin.tsx`
- `Profile.tsx`
- `TransactionDetails.tsx`
- `TransactionList.tsx`
- `UpdateNotification.tsx`

**Lower Priority:**
- `AndroidComingSoon.tsx`
- `BulkActionBar.tsx`
- `ContactSelectModal.tsx`
- `ExportComplete.tsx`
- `FieldWithFeedback.tsx`
- `PermissionsScreen.tsx`
- `SetupProgressIndicator.tsx`
- `SystemHealthMonitor.tsx`
- `SystemSettingsMockup.tsx`
- `WelcomeTerms.tsx`
- `ConversationList/` subdirectory (5 files)

---

## 2. Code Complexity Issues

### Files Exceeding 500 LOC (Industry Standard Max)

| File | Lines | Issue |
|------|-------|-------|
| `electron/services/databaseService.ts` | **3,068** | God object, 80+ methods |
| `electron/auth-handlers.ts` | **3,194** | Duplicated OAuth flows |
| `src/components/Transactions.tsx` | **2,500** | 45+ hooks, 19 nesting levels |
| `src/components/Contacts.tsx` | **1,634** | 24 hooks, inline components |
| `electron/transaction-handlers.ts` | **1,187** | 17 IPC handlers in one function |
| `electron/system-handlers.ts` | **1,104** | Single 975-line function |
| `src/components/AuditTransactionModal.tsx` | **1,017** | 12 useState |
| `electron/services/appleDriverService.ts` | **821** | Large service |
| `src/components/PermissionsScreen.tsx` | **863** | Single component |
| `src/components/OnboardingWizard.tsx` | **802** | Complex flows |
| `src/components/TransactionDetails.tsx` | **787** | Too much responsibility |

### Code Duplication Found
- `formatDate()` duplicated in 3 files
- `formatCurrency()` duplicated instead of imported
- OAuth flows duplicated between Google/Microsoft (1,134 combined lines)

---

## 3. Security Vulnerabilities

### CRITICAL (Fix Immediately)

1. **Command Injection via exec()** - `electron/main.ts:424`
   - Uses `exec()` with string interpolation for osascript
   - Fix: Use `execFile()` instead

2. **Unsafe process.env.HOME** - Multiple locations
   - `electron/main.ts:363, 380, 459, 792, 898, 1274`
   - `electron/services/permissionService.ts:95, 140`
   - `electron/services/contactsService.ts:95, 167`
   - Fix: Use `os.homedir()` with validation

3. **Missing Authorization Checks** - IPC handlers
   - Handlers accept userId but don't verify ownership
   - Fix: Add authorization middleware

### HIGH Priority

4. **Unvalidated chatId in get-messages** - `electron/main.ts:789`
5. **Token Storage Persists to Database** - Despite "session-only" comment
6. **Path Construction with User Data** - `electron/main.ts:1029-1039`
7. **Missing Rate Limiting** - Most IPC handlers

### MEDIUM Priority

8. **Hardcoded OAuth Redirect URI** - `electron/services/googleAuthService.ts:62`
9. **Information Disclosure in Errors** - Various handlers
10. **webSecurity Not Explicit** - `electron/main.ts:118-132`
11. **Missing Schema Validation** - Complex objects use generic sanitization
12. **No CSRF Protection** - IPC handlers

---

## 4. Performance Issues

### O(n^2) Patterns Found

| Location | Issue | Impact |
|----------|-------|--------|
| `electron/main.ts:514-634` | N+1 query in get-conversations | 500ms+ for 100+ conversations |
| `electron/services/transactionService.ts:513-548` | Nested loops + .find() | 1-3s for 1000 emails |
| `electron/main.ts:1290-1605` | Export handler nested iterations | Freezes on large exports |

### Startup Time Issues

1. **Database integrity check on every open** - `databaseService.ts:209-216`
2. **3-pass secure delete during migration** - `databaseService.ts:410-413`
3. **Synchronous file operations** - Multiple locations
4. **CSP header rebuilt on every request** - `electron/main.ts:69-114`

### React Performance Issues

- **Zero useMemo/useCallback usage** across all components
- Filter computations run on every render
- No pagination for large result sets

### Memory Leak Patterns

- Continuous polling without backoff in `deviceDetectionService.ts`
- setInterval without cleanup in `auditService.ts`, `updateService.ts`
- String concatenation in data handlers

---

## 5. Dependency Issues

### Deprecated Packages (2)
- `electron-rebuild@3.2.9` - Replace with `@electron/rebuild`
- `eslint@8.57.1` - EOL, upgrade to v9+

### Duplicate Database Package
- Both `better-sqlite3-multiple-ciphers` and `sqlite3` in dependencies
- `sqlite3` appears unused - candidate for removal

### Version Recommendations
- `popper.js@1.16.1` deprecated - used by react-joyride (transitive)

---

## 6. DevOps Recommendations

1. **Enable production sourcemaps conditionally** - `vite.config.js:17`
2. **Add npm audit to CI pipeline**
3. **Implement dependency update automation**
4. **Add pre-commit test coverage gates**

---

# PRIORITIZED BACKLOG

## P0 - Critical (Do This Week)

| # | Task | Category | Effort |
|---|------|----------|--------|
| 1 | Replace exec() with execFile() for osascript | Security | 1h |
| 2 | Use os.homedir() instead of process.env.HOME | Security | 2h |
| 3 | Add authorization middleware to IPC handlers | Security | 4h |
| 4 | Validate chatId ownership in get-messages | Security | 1h |
| 5 | Fix N+1 query in get-conversations handler | Performance | 2h |

## P1 - High (This Sprint)

| # | Task | Category | Effort |
|---|------|----------|--------|
| 6 | Add tests for backup-handlers.ts | Testing | 3h |
| 7 | Add tests for sync-handlers.ts | Testing | 3h |
| 8 | Add tests for contactsService.ts | Testing | 2h |
| 9 | Fix O(n^2) in transactionService.ts | Performance | 2h |
| 10 | Remove database integrity check on every open | Performance | 30m |
| 11 | Reduce secure delete to 1 pass | Performance | 30m |
| 12 | Split databaseService.ts (3,068 lines) | Code Quality | 8h |
| 13 | Add rate limiting to expensive IPC handlers | Security | 3h |
| 14 | Replace electron-rebuild with @electron/rebuild | Dependencies | 30m |

## P2 - Medium (Next Sprint)

| # | Task | Category | Effort |
|---|------|----------|--------|
| 15 | Add tests for Login.tsx | Testing | 2h |
| 16 | Add tests for OnboardingWizard.tsx | Testing | 3h |
| 17 | Add tests for Dashboard.tsx | Testing | 2h |
| 18 | Add tests for ConversationList.tsx | Testing | 2h |
| 19 | Split Transactions.tsx (2,500 lines) | Code Quality | 6h |
| 20 | Split Contacts.tsx (1,634 lines) | Code Quality | 4h |
| 21 | Split auth-handlers.ts (extract common OAuth) | Code Quality | 4h |
| 22 | Add useMemo/useCallback to React components | Performance | 4h |
| 23 | Add pagination to database queries | Performance | 4h |
| 24 | Pre-compute CSP headers as constants | Performance | 30m |
| 25 | Implement schema validation (Zod) | Security | 4h |
| 26 | Use random port for OAuth redirects | Security | 2h |

## P3 - Low (Backlog)

| # | Task | Category | Effort |
|---|------|----------|--------|
| 27 | Add tests for remaining 20+ components | Testing | 20h |
| 28 | Add tests for device-handlers.ts | Testing | 2h |
| 29 | Add tests for driver-handlers.ts | Testing | 2h |
| 30 | Split system-handlers.ts 975-line function | Code Quality | 3h |
| 31 | Extract shared formatDate/formatCurrency utils | Code Quality | 1h |
| 32 | Optimize export handler with streaming | Performance | 4h |
| 33 | Add exponential backoff to device polling | Performance | 2h |
| 34 | Upgrade ESLint to v9 | Dependencies | 2h |
| 35 | Remove unused sqlite3 dependency | Dependencies | 30m |
| 36 | Disable sourcemaps in production | DevOps | 15m |
| 37 | Implement audit logging for sensitive operations | Security | 4h |
| 38 | Add token revocation on logout | Security | 2h |

---

## Estimated Total Effort

| Priority | Tasks | Hours |
|----------|-------|-------|
| P0 Critical | 5 | ~10h |
| P1 High | 9 | ~22h |
| P2 Medium | 12 | ~38h |
| P3 Low | 12 | ~43h |
| **Total** | **38** | **~113h** |

---

## Quick Wins (< 1 hour each)

1. Remove database integrity check (30m)
2. Reduce secure delete passes (30m)
3. Replace electron-rebuild (30m)
4. Pre-compute CSP headers (30m)
5. Disable production sourcemaps (15m)
6. Remove unused sqlite3 dependency (30m)

---

## Metrics to Track

- Test coverage % (target: 80%)
- Max file size LOC (target: < 500)
- IPC handler response time P95
- App startup time (target: < 3s)
- Memory usage at idle
- Security scan findings

