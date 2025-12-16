# BACKLOG-058: Split databaseService.ts into Domain Repositories

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BACKLOG-058 |
| **Priority** | Critical |
| **Status** | Pending |
| **Category** | Architecture Refactor |
| **Sprint** | SPRINT-002 |
| **Date Added** | 2024-12-15 |
| **Date Completed** | - |
| **Branch** | - |
| **Assigned To** | - |
| **Estimated Turns** | 60-80 (split across multiple tasks) |

---

## Description

`electron/services/databaseService.ts` is 3,342 lines - far exceeding the ~300 line guideline. This monolithic file contains all database operations for users, sessions, contacts, transactions, communications, feedback, and audit logs.

## Senior Engineer Assessment

- **Maintainability:** Very difficult to navigate and modify
- **Testing:** Hard to unit test individual domains
- **Risk:** High coupling, changes in one area can break others

## Recommended Split

| New File | Responsibility |
|----------|---------------|
| `electron/services/db/userRepository.ts` | User CRUD, authentication |
| `electron/services/db/contactRepository.ts` | Contact management |
| `electron/services/db/transactionRepository.ts` | Transaction CRUD |
| `electron/services/db/communicationRepository.ts` | Emails, messages |
| `electron/services/db/auditRepository.ts` | Audit logs |
| `electron/services/db/sessionRepository.ts` | Sessions, tokens |
| `electron/services/db/baseRepository.ts` | Shared utilities, connection |

## Files to Modify

- `electron/services/databaseService.ts` → Split into domain files
- All IPC handlers → Update imports
- Tests → Update to match new structure

## Acceptance Criteria

- [ ] Each domain repository is <400 lines
- [ ] All existing tests pass with new structure
- [ ] No functionality changes (refactor only)
- [ ] IPC handlers updated to use new repositories
- [ ] Old databaseService.ts deleted or deprecated

## Sprint Tasks

This backlog item is broken into:
- TASK-207: Base repository infrastructure
- TASK-208: UserRepository
- TASK-209: ContactRepository
- TASK-210: TransactionRepository
- TASK-211: CommunicationRepository
- TASK-212: Cleanup

## Related Items

- BACKLOG-064: Add Batch Operations (can leverage new structure)
- BACKLOG-005: LLM-Ready Database Patterns (superseded by this)
