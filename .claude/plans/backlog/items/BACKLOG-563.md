# BACKLOG-563: Environment Variables for Packaged Builds

**Created**: 2026-01-28
**Source**: SPRINT-063 Phase 4 (Deferred)
**Original Task**: TASK-1508B
**Priority**: Medium
**Status**: Pending

---

## Description

Fix `process.env` being undefined in production/packaged Electron builds. Environment variables work correctly in development mode but are not available in packaged builds.

## Background

During SPRINT-063, this task was part of Phase 4 (Build/Packaging Fixes). It was deferred because:
- The app runs correctly in development mode
- Env vars are properly handled by Vite during dev
- Production packaging requires a different approach (embedding at build time)

## Acceptance Criteria

- [ ] Environment variables accessible in packaged macOS builds
- [ ] Environment variables accessible in packaged Windows builds
- [ ] Supabase URL/key available in production
- [ ] No secrets exposed in built artifacts

## Technical Notes

Options to consider:
1. **Build-time injection** - Embed env vars during `npm run build`
2. **Electron main process** - Load from config file in main process
3. **Vite define** - Use `define` in vite.config.ts for build-time replacement

## Estimated Effort

~20K tokens

## Related

- SPRINT-063 Phase 4
- BACKLOG-562 (Google Maps API key - related, should solve together)
