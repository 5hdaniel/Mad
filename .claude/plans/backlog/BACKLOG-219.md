# BACKLOG-219: Audit Debug/Logging Calls Across Repository

## Type
Tech Debt / Code Quality

## Priority
Low

## Description
Review and audit all debug logging and `console.log` statements across the codebase. During development, debug logging has been added in various places (especially during TASK-1012 attachment work and TASK-1028 iMessage parsing). These should be reviewed to:

1. Remove temporary debug logs that are no longer needed
2. Convert useful debug logs to proper `logService` calls with appropriate log levels
3. Ensure no sensitive data is being logged (message content, file paths, user data)
4. Standardize logging format and prefixes

## Scope
- `electron/` - Backend services and handlers
- `src/components/` - Frontend components (especially modal components)
- Focus areas:
  - `electron/services/macOSMessagesImportService.ts` - Has debug logging for attachments
  - `electron/utils/messageParser.ts` - May have parsing debug logs
  - `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Has attachment fetch logging

## Acceptance Criteria
- [ ] All `console.log` statements reviewed and either removed or converted to `logService`
- [ ] Debug logging uses appropriate log levels (debug, info, warn, error)
- [ ] No sensitive user data logged at info level or above
- [ ] Logging prefixes are consistent (e.g., `[ServiceName]` format)
- [ ] Production builds don't include verbose debug output

## Notes
- Created during SPRINT-034 stability work
- Debug logging was added to diagnose attachment display issues
- SR Engineer should review before next release

## Created
2025-01-12
