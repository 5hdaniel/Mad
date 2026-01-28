# BACKLOG-297: Startup Error Handling - User-Friendly Failure Screen

| Field | Value |
|-------|-------|
| **ID** | BACKLOG-297 |
| **Title** | Startup Error Handling - User-Friendly Failure Screen |
| **Type** | Enhancement |
| **Priority** | Medium |
| **Status** | Backlog |
| **Created** | 2025-01-17 |
| **Category** | UX / Error Handling |

## Problem Statement

When the app fails to initialize (e.g., database schema mismatch, migration failure, native module issues), it shows "Starting Magic Audit..." indefinitely. The user has no visibility into what's wrong - the app just loops forever on the splash screen.

### Current Behavior

User sees: "Starting Magic Audit..." (forever)

Meanwhile in logs:
```
ERROR [DatabaseService] Failed to initialize database
{
  "error": "no such column: sent_at"
}
ERROR [SystemHandlers] Database initialization failed
```

The user has no indication anything is wrong and no path to resolution.

### Impact

- Users abandon the app thinking it's broken
- Support burden increases (users report "app won't start")
- No actionable information for troubleshooting
- Poor first impression for new users

## Requested Behavior

### 1. Startup Timeout (30 seconds)

Add a timeout on the startup/splash screen. If initialization does not complete within 30 seconds, transition to the error screen.

### 2. User-Friendly Error Screen

When initialization fails OR times out, display an error screen with:

| Element | Content |
|---------|---------|
| **Heading** | "Magic Audit encountered an error during startup" |
| **Error Summary** | Sanitized error message (no stack traces, no file paths) |
| **Instructions** | "Please contact support at [email/link]" |
| **Actions** | "Try Again" button, "View Logs" button |

### 3. "Try Again" Action

- Attempt re-initialization from scratch
- Show splash screen again with timeout
- If fails again, return to error screen

### 4. "View Logs" Action

- Open the app's log file location in the system file explorer
- Or display last N lines of relevant logs in a modal

### 5. Detailed Logging

Ensure full error details are logged for debugging:
- Error message and stack trace
- Initialization phase that failed
- System information (OS, Electron version)
- Database state if available

## Acceptance Criteria

- [ ] Splash screen has a 30-second timeout
- [ ] Timeout or initialization failure shows error screen
- [ ] Error screen displays user-friendly message
- [ ] "Try Again" button attempts re-initialization
- [ ] "View Logs" button helps users find/view logs
- [ ] Full error details logged for developer debugging
- [ ] Error screen is styled consistently with app design
- [ ] Works on both macOS and Windows

## Technical Considerations

### Affected Components

| Component | Changes |
|-----------|---------|
| `SplashScreen` / Loading component | Add timeout logic |
| `useAppStateMachine` or equivalent | Add error state, timeout transition |
| New `StartupErrorScreen` component | Error display, retry, view logs |
| `App.tsx` | Route to error screen on failure |
| Main process IPC | Expose log file path |

### Error Categories to Handle

1. **Database initialization failure** - Schema mismatch, migration failure, corruption
2. **Native module failure** - better-sqlite3 version mismatch
3. **Configuration error** - Missing required settings
4. **Timeout** - Any initialization taking > 30s
5. **Unknown error** - Catch-all for unexpected failures

### Error Message Sanitization

Avoid exposing in UI:
- Full file paths (could contain usernames)
- Stack traces
- Internal service names
- SQL statements

Show in UI:
- General error category
- Brief explanation
- Error code if available

## Estimation

| Aspect | Estimate |
|--------|----------|
| Complexity | Medium |
| Effort | 3-5 tasks |
| Risk | Low |

## Related Items

- Native module rebuild issues (documented in CLAUDE.md)
- Database migration system
- App state machine

## Notes

This is a UX improvement that will significantly reduce support burden and improve user experience when things go wrong. The implementation should be defensive - we want to catch and display errors gracefully rather than leaving users stranded.
