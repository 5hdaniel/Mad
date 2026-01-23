# BACKLOG-433: Prevent UI Freezing - Decouple Backend Services from Renderer

## Summary

The application UI freezes when backend services perform heavy operations like loading data, processing messages, or importing contacts. Backend work must be moved off the main thread to keep the interface responsive.

## Category

Performance / Architecture

## Priority

P0 - Critical (Major UX degradation)

## Description

### Problem

The UI freezes/hangs in several scenarios:
1. **Loading data for display** - When fetching and rendering large datasets
2. **New user onboarding** - Processing messages and contacts blocks the interface
3. **Background imports** - Heavy database operations lock up the UI

This creates a poor user experience where the app appears unresponsive or crashed.

### Root Cause

Backend services are likely running synchronous operations on the main/renderer process, blocking the event loop and preventing UI updates.

### Proposed Solution

#### 1. Move Heavy Operations to Background
- Use Electron's IPC properly - heavy work in main process, not renderer
- Consider Web Workers for CPU-intensive renderer-side operations
- Implement proper async patterns with non-blocking operations

#### 2. Chunked Processing
- Process large datasets in chunks with `setTimeout`/`requestIdleCallback`
- Allow UI to update between chunks
- Show progress during long operations

#### 3. Database Operations
- Ensure all SQLite operations are truly async
- Use connection pooling or queuing for concurrent operations
- Consider using `better-sqlite3` in a worker thread

#### 4. Loading States
- Show loading indicators during data fetches
- Implement skeleton screens for better perceived performance
- Never block render on data that can load progressively

### Areas to Audit

- [ ] Message import service
- [ ] Contact processing service
- [ ] Transaction list loading
- [ ] Initial app startup sequence
- [ ] Database queries in renderer process
- [ ] Any `await` chains that could be parallelized

## Acceptance Criteria

- [ ] UI remains responsive during message/contact import
- [ ] UI remains responsive during data loading
- [ ] UI remains responsive for new user onboarding
- [ ] No "frozen" or "unresponsive" states lasting more than 100ms
- [ ] Loading indicators shown for operations > 500ms
- [ ] User can cancel long-running operations where appropriate

## Estimated Effort

~60K tokens (significant architectural work)

## Dependencies

None

## Related Items

- BACKLOG-434: Add Progress Bar for Text Import
- Initial onboarding flow
- Message import service
