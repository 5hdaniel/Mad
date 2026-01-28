# BACKLOG-562: Google Maps API Key Embedding

**Created**: 2026-01-28
**Source**: SPRINT-063 Phase 4 (Deferred)
**Original Task**: TASK-1508C
**Priority**: Medium
**Status**: Pending

---

## Description

Embed Google Maps API key in packaged Electron builds. Currently the API key is provided via environment variable which is not available in production builds.

## Background

During SPRINT-063, this task was part of Phase 4 (Build/Packaging Fixes). It was deferred because:
- Maps functionality works in development mode
- Production packaging requires embedding the key at build time
- Should be solved together with BACKLOG-563 (general env vars solution)

## Acceptance Criteria

- [ ] Google Maps loads correctly in packaged macOS builds
- [ ] Google Maps loads correctly in packaged Windows builds
- [ ] API key not exposed in client-accessible code (use restrictions instead)

## Technical Notes

- Google Maps API keys can be restricted by HTTP referrer or app bundle ID
- Consider restricting to production domains/bundle IDs
- May be solved as part of BACKLOG-561 general solution

## Estimated Effort

~10K tokens

## Related

- SPRINT-063 Phase 4
- BACKLOG-563 (Env vars - should solve both together)
