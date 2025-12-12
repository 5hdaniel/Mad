# MagicAudit TODO Backlog

**Last Updated:** December 12, 2025
**Total Tasks:** 67
**Estimated Effort:** ~150 hours

---

## P0 - Critical (This Week)

### Security - Critical Fixes
- [ ] **SEC-001** Replace `exec()` with `execFile()` for osascript command injection fix
  - File: `electron/main.ts:424`
  - Effort: 1h

- [ ] **SEC-002** Replace `process.env.HOME` with `os.homedir()` + validation
  - Files: `electron/main.ts:363,380,459,792,898,1274`
  - Files: `electron/services/permissionService.ts:95,140`
  - Files: `electron/services/contactsService.ts:95,167`
  - Effort: 2h

- [ ] **SEC-003** Add authorization middleware to verify user owns requested data
  - All IPC handlers in `electron/*-handlers.ts`
  - Effort: 4h

- [ ] **SEC-004** Validate chatId ownership before returning messages
  - File: `electron/main.ts:787-844`
  - Effort: 1h

### Performance - Critical Fixes
- [ ] **PERF-001** Fix N+1 query pattern in get-conversations handler
  - File: `electron/main.ts:514-634`
  - Batch fetch participants with single query
  - Effort: 2h

---

## P1 - High Priority (This Sprint)

### Testing - Missing Handler Tests
- [ ] **TEST-001** Add tests for `backup-handlers.ts`
  - Create: `electron/__tests__/backup-handlers.test.ts`
  - Effort: 3h

- [ ] **TEST-002** Add tests for `sync-handlers.ts`
  - Create: `electron/__tests__/sync-handlers.test.ts`
  - Effort: 3h

- [ ] **TEST-003** Add tests for `device-handlers.ts`
  - Create: `electron/__tests__/device-handlers.test.ts`
  - Effort: 2h

- [ ] **TEST-004** Add tests for `driver-handlers.ts`
  - Create: `electron/__tests__/driver-handlers.test.ts`
  - Effort: 2h

### Testing - Missing Service Tests
- [ ] **TEST-005** Add tests for `contactsService.ts`
  - Create: `electron/services/__tests__/contactsService.test.ts`
  - Effort: 2h

- [ ] **TEST-006** Add tests for `connectionStatusService.ts`
  - Create: `electron/services/__tests__/connectionStatusService.test.ts`
  - Effort: 2h

- [ ] **TEST-007** Add tests for `addressVerificationService.ts`
  - Create: `electron/services/__tests__/addressVerificationService.test.ts`
  - Effort: 2h

- [ ] **TEST-008** Add tests for `enhancedExportService.ts`
  - Create: `electron/services/__tests__/enhancedExportService.test.ts`
  - Effort: 2h

- [ ] **TEST-009** Add tests for `transactionExtractorService.ts`
  - Create: `electron/services/__tests__/transactionExtractorService.test.ts`
  - Effort: 2h

### Performance - High Priority
- [ ] **PERF-002** Fix O(n²) nested loops in transaction email analysis
  - File: `electron/services/transactionService.ts:513-548`
  - Use Map instead of .find() in loop
  - Effort: 2h

- [ ] **PERF-003** Remove database integrity check on every open
  - File: `electron/services/databaseService.ts:209-216`
  - Move to startup-only or after crash detection
  - Effort: 30m

- [ ] **PERF-004** Reduce secure delete from 3 passes to 1 pass
  - File: `electron/services/databaseService.ts:410-413`
  - Effort: 30m

### Security - High Priority
- [ ] **SEC-005** Add rate limiting to expensive IPC handlers
  - Use existing `rateLimitService.ts`
  - Apply to: get-conversations, get-messages, export handlers
  - Effort: 3h

- [ ] **SEC-006** Sanitize contactName before path construction
  - File: `electron/main.ts:1029-1039`
  - Use existing sanitizeFilename utility
  - Effort: 30m

### Code Quality - High Priority
- [ ] **REFACTOR-001** Split `databaseService.ts` (3,068 lines) into modules
  - Create: `userDatabaseService.ts`
  - Create: `contactDatabaseService.ts`
  - Create: `transactionDatabaseService.ts`
  - Create: `communicationDatabaseService.ts`
  - Create: `sessionDatabaseService.ts`
  - Target: <500 lines each
  - Effort: 8h

### Dependencies
- [ ] **DEP-001** Replace `electron-rebuild` with `@electron/rebuild`
  - File: `package.json`
  - Effort: 30m

---

## P2 - Medium Priority (Next Sprint)

### Testing - Core Components
- [ ] **TEST-010** Add tests for `Login.tsx`
  - Create: `src/components/__tests__/Login.test.tsx`
  - Effort: 2h

- [ ] **TEST-011** Add tests for `OnboardingWizard.tsx`
  - Create: `src/components/__tests__/OnboardingWizard.test.tsx`
  - Effort: 3h

- [ ] **TEST-012** Add tests for `Dashboard.tsx`
  - Create: `src/components/__tests__/Dashboard.test.tsx`
  - Effort: 2h

- [ ] **TEST-013** Add tests for `ConversationList.tsx`
  - Create: `src/components/__tests__/ConversationList.test.tsx`
  - Effort: 2h

- [ ] **TEST-014** Add tests for `ContactDetails.tsx`
  - Create: `src/components/__tests__/ContactDetails.test.tsx`
  - Effort: 2h

- [ ] **TEST-015** Add tests for `ContactList.tsx`
  - Create: `src/components/__tests__/ContactList.test.tsx`
  - Effort: 2h

- [ ] **TEST-016** Add tests for `ExportModal.tsx`
  - Create: `src/components/__tests__/ExportModal.test.tsx`
  - Effort: 2h

- [ ] **TEST-017** Add tests for `MicrosoftLogin.tsx`
  - Create: `src/components/__tests__/MicrosoftLogin.test.tsx`
  - Effort: 2h

- [ ] **TEST-018** Add tests for `Profile.tsx`
  - Create: `src/components/__tests__/Profile.test.tsx`
  - Effort: 2h

- [ ] **TEST-019** Add tests for `TransactionDetails.tsx`
  - Create: `src/components/__tests__/TransactionDetails.test.tsx`
  - Effort: 2h

- [ ] **TEST-020** Add tests for `TransactionList.tsx`
  - Create: `src/components/__tests__/TransactionList.test.tsx`
  - Effort: 2h

### Code Quality - Component Refactoring
- [ ] **REFACTOR-002** Split `Transactions.tsx` (2,500 lines)
  - Extract: `TransactionFilters.tsx`
  - Extract: `TransactionBulkActions.tsx`
  - Extract: `TransactionModals.tsx`
  - Extract: `useTransactionState.ts` hook
  - Target: <500 lines each
  - Effort: 6h

- [ ] **REFACTOR-003** Split `Contacts.tsx` (1,634 lines)
  - Extract: `ContactFilters.tsx`
  - Extract: `ContactActions.tsx`
  - Extract: `useContactState.ts` hook
  - Target: <500 lines each
  - Effort: 4h

- [ ] **REFACTOR-004** Extract common OAuth flow from auth-handlers.ts
  - Create: `electron/services/oauthBaseService.ts`
  - Reduce duplication between Google/Microsoft
  - Effort: 4h

- [ ] **REFACTOR-005** Split `system-handlers.ts` 975-line function
  - Break into 5-6 focused handler functions
  - Effort: 3h

### Performance - Medium Priority
- [ ] **PERF-005** Add useMemo to expensive filter computations
  - File: `src/components/ConversationList/index.tsx:79-87`
  - File: `src/components/Transactions.tsx` (multiple locations)
  - File: `src/components/Contacts.tsx` (multiple locations)
  - Effort: 4h

- [ ] **PERF-006** Add useCallback to event handlers passed to children
  - All major components
  - Effort: 2h

- [ ] **PERF-007** Add pagination to getContacts() query
  - File: `electron/services/databaseService.ts:1350-1375`
  - Effort: 2h

- [ ] **PERF-008** Add pagination to getTransactions() query
  - File: `electron/services/databaseService.ts:1920-1971`
  - Effort: 2h

- [ ] **PERF-009** Pre-compute CSP headers as constants
  - File: `electron/main.ts:69-114`
  - Effort: 30m

### Security - Medium Priority
- [ ] **SEC-007** Use random port for OAuth redirect URIs
  - File: `electron/services/googleAuthService.ts:62`
  - File: `electron/services/microsoftAuthService.ts`
  - Effort: 2h

- [ ] **SEC-008** Implement schema validation with Zod for complex IPC params
  - File: `electron/transaction-handlers.ts:114-126`
  - Effort: 4h

- [ ] **SEC-009** Add explicit `webSecurity: true` to BrowserWindow config
  - File: `electron/main.ts:118-132`
  - Effort: 15m

- [ ] **SEC-010** Use generic error messages in production
  - Replace detailed error messages with user-friendly versions
  - Effort: 2h

---

## P3 - Low Priority (Backlog)

### Testing - Remaining Components
- [ ] **TEST-021** Add tests for `ManualTransactionModal.tsx`
- [ ] **TEST-022** Add tests for `UpdateNotification.tsx`
- [ ] **TEST-023** Add tests for `PermissionsScreen.tsx`
- [ ] **TEST-024** Add tests for `WelcomeTerms.tsx`
- [ ] **TEST-025** Add tests for `ExportComplete.tsx`
- [ ] **TEST-026** Add tests for `BulkActionBar.tsx`
- [ ] **TEST-027** Add tests for `ContactSelectModal.tsx`
- [ ] **TEST-028** Add tests for `FieldWithFeedback.tsx`
- [ ] **TEST-029** Add tests for `SetupProgressIndicator.tsx`
- [ ] **TEST-030** Add tests for `SystemHealthMonitor.tsx`
- [ ] **TEST-031** Add tests for `AndroidComingSoon.tsx`
- [ ] **TEST-032** Add tests for ConversationList subdirectory components
  - `ContactInfoModal.tsx`
  - `ConversationCard.tsx`
  - `ExportButtons.tsx`
  - `SearchBar.tsx`
  - `SelectionControls.tsx`

### Code Quality - Lower Priority Refactoring
- [ ] **REFACTOR-006** Extract shared `formatDate()` utility
  - Remove from: `Transactions.tsx`, `TransactionList.tsx`, `ConversationCard.tsx`
  - Use: `src/utils/dateFormatters.ts`
  - Effort: 1h

- [ ] **REFACTOR-007** Extract shared `formatCurrency()` utility
  - Centralize in `src/utils/formatters.ts`
  - Effort: 30m

- [ ] **REFACTOR-008** Split `AuditTransactionModal.tsx` (1,017 lines)
  - Effort: 3h

- [ ] **REFACTOR-009** Split `PermissionsScreen.tsx` (863 lines)
  - Effort: 2h

- [ ] **REFACTOR-010** Split `OnboardingWizard.tsx` (802 lines)
  - Effort: 2h

- [ ] **REFACTOR-011** Split `TransactionDetails.tsx` (787 lines)
  - Effort: 2h

### Performance - Lower Priority
- [ ] **PERF-010** Add pagination to export handler
  - File: `electron/main.ts:1290-1605`
  - Stream results instead of loading all into memory
  - Effort: 4h

- [ ] **PERF-011** Add exponential backoff to device polling
  - File: `electron/services/deviceDetectionService.ts:103-115`
  - Effort: 2h

- [ ] **PERF-012** Use Buffer concatenation instead of string concatenation
  - File: `electron/services/deviceDetectionService.ts:200-234`
  - Effort: 1h

- [ ] **PERF-013** Move database migration to background after app loads
  - File: `electron/services/databaseService.ts:238-399`
  - Effort: 3h

### Security - Lower Priority
- [ ] **SEC-011** Implement audit logging for sensitive operations
  - Effort: 4h

- [ ] **SEC-012** Add token revocation on logout
  - Effort: 2h

- [ ] **SEC-013** Add CSRF-like request IDs to IPC handlers
  - Effort: 3h

### Dependencies
- [ ] **DEP-002** Upgrade ESLint to v9
  - Current: 8.57.1 (EOL)
  - Effort: 2h

- [ ] **DEP-003** Remove unused `sqlite3` dependency
  - Using `better-sqlite3-multiple-ciphers` instead
  - Effort: 30m

- [ ] **DEP-004** Update transitive `popper.js` via react-joyride
  - Effort: 30m

### DevOps
- [ ] **DEVOPS-001** Disable sourcemaps in production build
  - File: `vite.config.js:17`
  - Change `sourcemap: true` to `sourcemap: false`
  - Effort: 15m

- [ ] **DEVOPS-002** Add npm audit to CI pipeline
  - File: `.github/workflows/ci.yml`
  - Effort: 30m

- [ ] **DEVOPS-003** Add pre-commit test coverage gate
  - Target: 70% minimum coverage
  - Effort: 1h

- [ ] **DEVOPS-004** Add dependency update automation (Dependabot/Renovate)
  - Effort: 1h

---

## Quick Wins (< 30 minutes each)

- [ ] Remove database integrity check on every open (PERF-003)
- [ ] Reduce secure delete passes (PERF-004)
- [ ] Replace electron-rebuild (DEP-001)
- [ ] Pre-compute CSP headers (PERF-009)
- [ ] Disable production sourcemaps (DEVOPS-001)
- [ ] Remove unused sqlite3 dependency (DEP-003)
- [ ] Add explicit webSecurity: true (SEC-009)
- [ ] Sanitize contactName in export path (SEC-006)

---

## Summary by Category

| Category | Tasks | Estimated Hours |
|----------|-------|-----------------|
| Security | 13 | ~28h |
| Testing | 32 | ~55h |
| Performance | 13 | ~24h |
| Code Quality (Refactoring) | 11 | ~36h |
| Dependencies | 4 | ~4h |
| DevOps | 4 | ~3h |
| **TOTAL** | **67** | **~150h** |

---

## Progress Tracking

### Test Coverage Goals
- [ ] Reach 70% overall coverage (currently 66%)
- [ ] Reach 80% component coverage (currently 45%)
- [ ] Reach 90% handler coverage (currently 63%)
- [ ] Maintain 100% utils/hooks/contexts coverage

### Code Quality Goals
- [ ] No files over 500 lines
- [ ] No functions over 50 lines
- [ ] No components with more than 10 useState calls
- [ ] Eliminate all code duplication

### Performance Goals
- [ ] App startup time < 3 seconds
- [ ] No O(n²) algorithms in hot paths
- [ ] All database queries paginated
- [ ] React components properly memoized

### Security Goals
- [ ] All critical vulnerabilities fixed
- [ ] All IPC handlers have authorization checks
- [ ] All user input validated with schemas
- [ ] No sensitive data in error messages
