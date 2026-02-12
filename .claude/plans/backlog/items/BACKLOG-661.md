# BACKLOG-661: Move External Contacts Query to Worker Thread (Main Process Freeze Fix)

## Type
Performance / Bug Fix

## Priority
High

## Status
In Progress

## Description

The `contacts:get-available` IPC handler blocks the Electron main process for ~3.7s when loading 1000+ external contacts, freezing window dragging and all UI interaction. The root cause is `better-sqlite3`'s synchronous API being called on the main thread.

The fix is to move this specific query to a Node.js `worker_threads` worker, which runs the SQLite query in a separate thread and posts results back asynchronously. This also requires enabling WAL mode on the database for safe concurrent access.

This is a targeted first step of BACKLOG-497 (Move all SQLite queries to worker thread), scoped to only the `contacts:get-available` handler.

## Acceptance Criteria

- [ ] External contacts query runs in a worker thread, not on main process
- [ ] No UI freeze when loading 1000+ contacts
- [ ] WAL mode enabled for concurrent reader/writer access
- [ ] All existing tests pass
- [ ] New tests cover the async worker wrapper

## Related

- **Parent epic:** BACKLOG-497 (Move SQLite Queries to Worker Thread)
- **Sprint:** SPRINT-080
- **Task:** TASK-1956

## Created
2026-02-11
