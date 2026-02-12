# Task TASK-1967: Sentry Integration

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Integrate `@sentry/electron` for JavaScript exception tracking and native crash minidumps. This provides production error monitoring for both main and renderer processes.

## Non-Goals

- Do NOT add Sentry performance monitoring (just error tracking)
- Do NOT create custom Sentry dashboards or alerting rules
- Do NOT add user-facing error reporting UI
- Do NOT capture PII in error reports (sanitize before sending)

## Deliverables

1. Update: `electron/main.ts` — init Sentry before `app.whenReady()`, wrap existing uncaught handlers (lines 110-121)
2. Update: `vite.config.ts` — add `@sentry/vite-plugin` for source map upload
3. Update: `.github/workflows/release.yml` — add `SENTRY_AUTH_TOKEN`, `SENTRY_DSN` secrets
4. Update: `.env.production` / `.env.development` — add `SENTRY_DSN`

## Acceptance Criteria

- [ ] `@sentry/electron` installed as dependency
- [ ] `@sentry/vite-plugin` installed as devDependency
- [ ] Sentry initialized in main process before `app.whenReady()`
- [ ] Existing uncaught exception handlers (lines 110-121) wrapped to also report to Sentry
- [ ] Source maps uploaded to Sentry during release builds
- [ ] `SENTRY_DSN` configured via environment variable (not hardcoded)
- [ ] Deliberate test error appears in Sentry with readable stack trace
- [ ] All CI checks pass

## Implementation Notes

### Main Process Init

In `electron/main.ts`, before `app.whenReady()` (around line 110):

```typescript
import * as Sentry from '@sentry/electron/main';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: app.isPackaged ? 'production' : 'development',
  release: app.getVersion(),
  // Don't send events in development unless DSN is explicitly set
  enabled: app.isPackaged || !!process.env.SENTRY_DSN,
});
```

### Renderer Process

The renderer needs its own init. In the renderer entry point (or preload):

```typescript
import * as Sentry from '@sentry/electron/renderer';

Sentry.init({
  // Renderer inherits config from main process
});
```

### Existing Uncaught Handler Integration

Wrap the existing handlers (lines 110-121) to also capture in Sentry:

```typescript
process.on('uncaughtException', (error) => {
  Sentry.captureException(error);
  // ... existing handler logic
});

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
  // ... existing handler logic
});
```

### Vite Plugin

In `vite.config.ts`:

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

// In plugins array (production only):
...(process.env.SENTRY_AUTH_TOKEN ? [
  sentryVitePlugin({
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: '<org-slug>',
    project: '<project-slug>',
    sourcemaps: {
      filesToDeleteAfterUpload: ['**/*.js.map'], // Don't ship source maps
    },
  })
] : []),
```

### GitHub Actions

In `.github/workflows/release.yml`, add to the build environment:
```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

### Prereq

A Sentry account and project must be created manually before this task can be fully verified. The code changes can be made first, with verification after Sentry is set up.

## Integration Notes

- TASK-1968 (Renderer Crash Recovery) depends on this — Sentry captures crash details before the recovery dialog
- TASK-1970 (Periodic Updates) also touches `electron/main.ts` — run that after this task
- Source maps should be uploaded during release builds only, not dev builds

## Do / Don't

### Do:
- Initialize Sentry as early as possible in the main process
- Use environment variables for all Sentry configuration
- Delete source maps after upload (don't ship them)
- Set `release` to the app version for proper release tracking

### Don't:
- Do NOT hardcode the Sentry DSN
- Do NOT enable Sentry performance monitoring (just errors)
- Do NOT capture user PII (email, name) in error reports
- Do NOT ship source maps with the application

## When to Stop and Ask

- If `@sentry/electron` has significant breaking changes from expected API
- If the existing uncaught exception handlers are structured differently than expected
- If vite.config.ts uses a plugin system incompatible with sentryVitePlugin

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (integration, tested manually)
- Verify via: Trigger deliberate error, confirm in Sentry dashboard

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(monitoring): integrate Sentry error tracking`
- **Labels:** `feature`, `monitoring`
- **Depends on:** None (but blocks TASK-1968)

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~50K
**Token Cap:** 200K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] electron/main.ts (Sentry init + handler wrapping)
- [ ] vite.config.ts (Sentry vite plugin)
- [ ] .github/workflows/release.yml (secrets)
- [ ] .env.production / .env.development (DSN)
- [ ] package.json (new dependencies)

Features implemented:
- [ ] Main process Sentry initialization
- [ ] Renderer process Sentry initialization
- [ ] Uncaught exception/rejection reporting
- [ ] Source map upload in release builds

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Test error visible in Sentry with stack trace
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>
- Test coverage: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
