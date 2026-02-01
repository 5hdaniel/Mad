# BACKLOG-486: PostHog SDK Integration

**Category**: infrastructure
**Priority**: P0
**Sprint**: SPRINT-059
**Estimated Tokens**: ~15K
**Status**: Pending

---

## Summary

Install and configure PostHog analytics SDK for Electron.

## Background

PostHog provides a generous free tier (1M events/month), official Electron support, and privacy-focused features including built-in opt-out.

## Requirements

### Installation

```bash
npm install posthog-js
```

### Telemetry Service

```typescript
// electron/services/telemetryService.ts
import posthog from 'posthog-js';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initTelemetry(): void {
  if (initialized || !POSTHOG_API_KEY) return;

  const optedOut = getOptOutPreference();
  if (optedOut) return;

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    persistence: 'localStorage',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
  });

  initialized = true;
}

export function identify(userId: string, traits?: Record<string, unknown>): void;
export function track(event: string, properties?: Record<string, unknown>): void;
export function reset(): void;
```

### Environment Variables

Add to `.env.example`:
```
POSTHOG_API_KEY=phc_xxxxxxxxxxxxx
```

### Initialization

Call `initTelemetry()` in `electron/main.ts` after app ready.

## Acceptance Criteria

- [ ] PostHog SDK installed
- [ ] Telemetry service created with init/identify/track/reset
- [ ] Environment variable configured
- [ ] Initialized on app ready
- [ ] Test event can be sent and appears in PostHog dashboard

## Dependencies

- SPRINT-058 must be complete (need auth working to identify users)

## Related Files

- `electron/services/telemetryService.ts`
- `electron/main.ts`
- `.env.example`
- `package.json`
