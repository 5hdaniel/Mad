# BACKLOG-489: Privacy Controls & Error Tracking

**Category**: service
**Priority**: P1
**Sprint**: SPRINT-059
**Estimated Tokens**: ~5K
**Status**: Pending

---

## Summary

Implement user opt-out controls and error tracking for debugging.

## Background

Users should be able to opt out of analytics, and errors should be tracked (without PII) for debugging.

## Requirements

### Privacy Controls

1. **Settings Toggle**:
   ```typescript
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

### Error Tracking

1. **Renderer Errors**:
   ```typescript
   window.addEventListener('error', (event) => {
     track('error_occurred', {
       error_type: event.error?.name || 'Unknown',
       message: event.message,
       component: 'renderer',
     });
   });
   ```

2. **Main Process Errors**:
   ```typescript
   process.on('uncaughtException', (error) => {
     track('error_occurred', {
       error_type: error.name,
       message: error.message,
       component: 'main',
     });
   });
   ```

### Privacy Guarantees

**DO NOT track**:
- Message content
- Contact names/emails
- Transaction details
- Full error stack traces

**DO track**:
- Error types and components
- Anonymous usage patterns
- Feature counts

## Acceptance Criteria

- [ ] Opt-out toggle in Settings
- [ ] Preference persisted and respected
- [ ] PostHog stops capturing when opted out
- [ ] Error tracking captures type and component
- [ ] No PII in error events
- [ ] Clear explanation text for users

## Dependencies

- BACKLOG-487: Core events must be working
- BACKLOG-488: Feature events must be working

## Related Files

- `src/components/Settings.tsx`
- `electron/services/telemetryService.ts`
- `electron/main.ts`
- `src/main.tsx`
