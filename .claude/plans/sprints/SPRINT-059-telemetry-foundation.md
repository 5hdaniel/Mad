# Sprint Plan: SPRINT-059 - Telemetry Foundation

**Created**: 2026-01-24
**Updated**: 2026-01-24
**Status**: Blocked (Waiting for SPRINT-058)
**Goal**: Add analytics/telemetry to track user activity for product development
**Track**: Consumer Launch (4 of 4)
**Dependencies**: SPRINT-058 (Unified auth must be working)

---

## Sprint Goal

This sprint implements analytics and telemetry to understand how users interact with the app:

1. **PostHog Integration** - Free tier (1M events/month), Electron SDK compatible
2. **Core Event Tracking** - App start, transaction lifecycle, exports, syncs
3. **Error Tracking** - Capture errors with context for debugging
4. **Privacy Controls** - Opt-out mechanism for users who prefer no tracking

This enables:
- Data-driven product decisions
- Understanding user workflows and pain points
- Error debugging with session context
- Feature adoption tracking

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] Verify SPRINT-058 is complete (unified auth working)
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install && npm rebuild better-sqlite3-multiple-ciphers && npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] PostHog project created (free tier)

---

## Why PostHog?

| Criteria | PostHog | Alternatives |
|----------|---------|--------------|
| **Free Tier** | 1M events/month | Mixpanel: 100K, Amplitude: 10M but limited |
| **Electron Support** | Official SDK | Varies |
| **Self-Host Option** | Yes | Most are cloud-only |
| **Privacy Features** | Built-in opt-out | Varies |
| **Open Source** | Yes | No |
| **Feature Flags** | Included | Often paid add-on |

PostHog offers the best balance of features, free tier limits, and Electron compatibility.

---

## Event Taxonomy

### Core Events

| Event | When Fired | Properties |
|-------|------------|------------|
| `app_started` | App launch completes | `version`, `platform`, `license_type` |
| `app_closed` | App closes | `session_duration_seconds` |
| `user_signed_in` | Auth completes | `provider` (google/microsoft) |
| `user_signed_out` | Logout | - |

### Transaction Events

| Event | When Fired | Properties |
|-------|------------|------------|
| `transaction_created` | New transaction | `source` (manual/detected), `has_contacts` |
| `transaction_updated` | Edit transaction | `fields_changed[]` |
| `transaction_exported` | Export completes | `format` (pdf/folder), `contact_count`, `message_count` |
| `transaction_submitted` | Submit for review | `has_attachments` |
| `transaction_closed` | Mark closed | `days_active` |

### Sync Events

| Event | When Fired | Properties |
|-------|------------|------------|
| `sync_started` | Sync begins | `type` (email/messages/contacts), `provider` |
| `sync_completed` | Sync completes | `type`, `items_synced`, `duration_seconds` |
| `sync_failed` | Sync errors | `type`, `error_code` |

### Feature Events

| Event | When Fired | Properties |
|-------|------------|------------|
| `ai_detection_used` | AI analyzes messages | `message_count`, `transactions_detected` |
| `contact_linked` | Contact added to transaction | `link_type` (manual/auto) |
| `message_attached` | Message attached to transaction | `message_type` (email/text) |

### Error Events

| Event | When Fired | Properties |
|-------|------------|------------|
| `error_occurred` | Unhandled error | `error_type`, `component`, `message` |
| `feature_error` | Feature fails | `feature`, `error_code` |

---

## In Scope (4 Items)

### Phase 1: PostHog Setup (Sequential)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-486 | PostHog SDK Integration | ~15K | P0 | TASK-1195 |

### Phase 2: Core Event Implementation (Sequential - After Phase 1)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-487 | Core Lifecycle Events | ~10K | P0 | TASK-1196 |
| BACKLOG-488 | Transaction & Feature Events | ~10K | P1 | TASK-1197 |

### Phase 3: Privacy & Error Tracking (Sequential - After Phase 2)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-489 | Privacy Controls & Error Tracking | ~5K | P1 | TASK-1198 |

---

## Phase Plan

### Phase 1: PostHog SDK Integration

**Goal**: Install and configure PostHog for Electron

**Implementation**:

1. **Install SDK**:
   ```bash
   npm install posthog-js
   ```

2. **Create Telemetry Service**:
   ```typescript
   // electron/services/telemetryService.ts
   import posthog from 'posthog-js';

   const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
   const POSTHOG_HOST = 'https://us.i.posthog.com'; // or eu.i.posthog.com

   let initialized = false;

   export function initTelemetry(): void {
     if (initialized || !POSTHOG_API_KEY) return;

     // Check opt-out preference
     const optedOut = getOptOutPreference();
     if (optedOut) return;

     posthog.init(POSTHOG_API_KEY, {
       api_host: POSTHOG_HOST,
       persistence: 'localStorage',
       autocapture: false, // Manual tracking only
       capture_pageview: false,
       capture_pageleave: false,
       disable_session_recording: true, // Privacy
     });

     initialized = true;
   }

   export function identify(userId: string, traits?: Record<string, unknown>): void {
     if (!initialized) return;
     posthog.identify(userId, traits);
   }

   export function track(event: string, properties?: Record<string, unknown>): void {
     if (!initialized) return;
     posthog.capture(event, properties);
   }

   export function reset(): void {
     if (!initialized) return;
     posthog.reset();
   }
   ```

3. **Environment Variables**:
   ```env
   POSTHOG_API_KEY=phc_xxxxxxxxxxxxx
   ```

**Files to Create/Modify**:
- `electron/services/telemetryService.ts`
- `.env.example` (add POSTHOG_API_KEY)
- `electron/main.ts` (initialize on app ready)

**Integration checkpoint**: PostHog initialized, can send test event.

---

### Phase 2: Core Event Implementation

**Goal**: Track essential user journey events

**Implementation**:

1. **App Lifecycle Events**:
   ```typescript
   // In main.ts
   app.on('ready', () => {
     initTelemetry();
     track('app_started', {
       version: app.getVersion(),
       platform: process.platform,
     });
   });

   app.on('before-quit', () => {
     track('app_closed', {
       session_duration_seconds: getSessionDuration(),
     });
   });
   ```

2. **Auth Events** (integrate with auth flow):
   ```typescript
   // After successful auth
   track('user_signed_in', { provider: 'google' });
   identify(userId, {
     license_type: licenseStatus.licenseType,
     platform: process.platform,
   });
   ```

3. **Transaction Events**:
   ```typescript
   // In transactionService.ts
   export async function createTransaction(...): Promise<Transaction> {
     const result = await db.createTransaction(...);

     track('transaction_created', {
       source: 'manual',
       has_contacts: contacts.length > 0,
     });

     return result;
   }
   ```

**Files to Modify**:
- `electron/main.ts`
- `electron/services/transactionService.ts`
- `src/appCore/state/flows/useAuthFlow.ts`

**Integration checkpoint**: Core events appearing in PostHog dashboard.

---

### Phase 3: Privacy Controls & Error Tracking

**Goal**: Allow users to opt out, capture errors

**Privacy Implementation**:

1. **Settings UI**:
   ```typescript
   // In Settings component
   <Toggle
     label="Send anonymous usage data"
     checked={!telemetryOptedOut}
     onChange={(checked) => setTelemetryOptOut(!checked)}
   />
   <Text size="sm" color="dimmed">
     Help improve Magic Audit by sharing anonymous usage statistics.
     No personal data or message content is ever shared.
   </Text>
   ```

2. **Preference Storage**:
   ```typescript
   // In telemetryService.ts
   export function getOptOutPreference(): boolean {
     return localStorage.getItem('telemetry_opt_out') === 'true';
   }

   export function setOptOutPreference(optOut: boolean): void {
     localStorage.setItem('telemetry_opt_out', String(optOut));
     if (optOut) {
       posthog.opt_out_capturing();
     } else {
       posthog.opt_in_capturing();
     }
   }
   ```

3. **Error Tracking**:
   ```typescript
   // Global error handler
   window.addEventListener('error', (event) => {
     track('error_occurred', {
       error_type: event.error?.name || 'Unknown',
       message: event.message,
       component: 'renderer',
     });
   });

   process.on('uncaughtException', (error) => {
     track('error_occurred', {
       error_type: error.name,
       message: error.message,
       component: 'main',
     });
   });
   ```

**Files to Modify**:
- `src/components/Settings.tsx`
- `electron/services/telemetryService.ts`
- `electron/main.ts`
- `src/main.tsx`

**Integration checkpoint**: Opt-out works, errors tracked in PostHog.

---

## Dependency Graph

```yaml
dependency_graph:
  nodes:
    - id: SPRINT-058
      type: sprint
      title: "Unified Auth"
      status: must_be_complete
    - id: BACKLOG-486
      type: task
      phase: 1
      title: "PostHog SDK Integration"
    - id: BACKLOG-487
      type: task
      phase: 2
      title: "Core Lifecycle Events"
    - id: BACKLOG-488
      type: task
      phase: 2
      title: "Transaction & Feature Events"
    - id: BACKLOG-489
      type: task
      phase: 3
      title: "Privacy Controls & Error Tracking"

  edges:
    - from: SPRINT-058
      to: BACKLOG-486
      type: depends_on
      reason: "Need auth working to identify users"
    - from: BACKLOG-486
      to: BACKLOG-487
      type: depends_on
    - from: BACKLOG-486
      to: BACKLOG-488
      type: depends_on
    - from: BACKLOG-487
      to: BACKLOG-489
      type: depends_on
    - from: BACKLOG-488
      to: BACKLOG-489
      type: depends_on
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PostHog rate limiting | Low | Low | 1M events/month is generous for early users |
| SDK not working in Electron | Low | Medium | PostHog officially supports Electron |
| Users opt out en masse | Medium | Low | Expected; still useful for those who opt in |
| GDPR compliance concerns | Low | Medium | No PII tracked, opt-out provided |

---

## Privacy Considerations

**What we DO track**:
- Anonymous usage patterns (events without message content)
- Error types and components (not full stack traces)
- Feature usage counts

**What we DO NOT track**:
- Message content
- Contact names/emails
- Transaction details
- Personal information
- Full error messages that might contain PII

**User controls**:
- Opt-out available in Settings
- Clear explanation of what is tracked
- Data deleted on request (PostHog feature)

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: PostHog Setup | BACKLOG-486 | ~15K | Sequential |
| Phase 2: Core Events | BACKLOG-487, 488 | ~20K | Parallel after Phase 1 |
| Phase 3: Privacy | BACKLOG-489 | ~5K | Sequential |
| **Total** | **4 tasks** | **~40K** | - |

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-1195 | BACKLOG-486 | Blocked | - | - | - |
| 2 | TASK-1196 | BACKLOG-487 | Blocked | - | - | - |
| 2 | TASK-1197 | BACKLOG-488 | Blocked | - | - | - |
| 3 | TASK-1198 | BACKLOG-489 | Blocked | - | - | - |

**Blocker**: SPRINT-058 must complete first.

---

## Success Criteria

- [ ] PostHog SDK installed and initialized
- [ ] App start/close events tracked
- [ ] Auth events tracked with provider
- [ ] Transaction lifecycle events tracked
- [ ] Sync events tracked
- [ ] Opt-out toggle in Settings
- [ ] Error tracking working
- [ ] No PII in tracked events

---

## PostHog Dashboard Setup

After implementation, create these dashboards:

1. **User Funnel**:
   - App started -> Signed in -> Transaction created -> Exported

2. **Feature Adoption**:
   - AI detection usage
   - Export formats used
   - Sync frequency

3. **Error Tracking**:
   - Error rate over time
   - Top error types
   - Affected components

---

## Related Documentation

- **PostHog Docs**: https://posthog.com/docs/libraries/js
- **Electron Integration**: https://posthog.com/docs/libraries/js#electron

---

## Next Steps

After SPRINT-059 completes, the Consumer Launch Track is complete. Next priorities:
- Beta testing with real users
- Feature iteration based on telemetry data
- Performance optimization based on error patterns
