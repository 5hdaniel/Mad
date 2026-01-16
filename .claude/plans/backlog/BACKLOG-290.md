# BACKLOG-290: Reusable Sync Progress Component

## Category
UI/UX, Architecture

## Priority
Medium

## Status
Pending

## Description

Extract sync progress UI into a shared, reusable component that's used consistently throughout the app. Currently, sync progress may be implemented differently in various screens (iPhone sync, email sync, data import, etc.).

## Goals

1. **Single source of truth** - One `SyncProgress` component used everywhere
2. **Consistent UX** - Users see the same progress UI regardless of what's syncing
3. **Flexible** - Works for iPhone sync, email sync, data processing, exports
4. **Informative** - Shows what's happening, estimated time, and detailed steps

## Proposed Component API

```tsx
<SyncProgress
  title="Syncing iPhone..."
  subtitle="Keep your device connected"

  // Progress
  progress={78}                    // 0-100 percentage
  progressText="6.2 GB / 8.0 GB"  // Custom progress text

  // Steps (optional expandable details)
  steps={[
    { label: "Connecting to iPhone", status: "complete", duration: "0.2s" },
    { label: "Reading storage info", status: "complete", duration: "1.1s" },
    { label: "Waiting for passcode", status: "complete", duration: "45s" },
    { label: "Transferring files", status: "active", duration: "8m 14s" },
    { label: "Reading messages", status: "pending" },
    { label: "Saving to database", status: "pending" },
  ]}

  // Meta info (optional)
  lastSyncDate={new Date("2024-12-11T14:36:00")}
  lastSyncSize="46.9 GB"

  // Error state
  error={syncError}
  onCopyDiagnostics={() => copyToClipboard(diagnosticReport)}

  // Actions
  onCancel={() => cancelSync()}
  onRetry={() => retrySync()}
/>
```

## Component Variants

### Compact (for inline/card use)
```
[████████░░] 78% Syncing messages...
```

### Standard (modal/panel use)
```
🔄 Syncing iPhone...
[████████████████░░░░] 78%
6.2 GB / 8.0 GB • Keep connected
```

### Detailed (expandable steps)
```
🔄 Syncing iPhone...
[████████████████░░░░] 78%

▼ Show Details
┌─────────────────────────────────────┐
│ ✓ Connecting to iPhone       0.2s  │
│ ✓ Waiting for passcode       45s   │
│ ● Transferring files...      8m 14s│
│ ○ Reading messages                 │
└─────────────────────────────────────┘
```

## Use Cases

| Screen | Current | With Component |
|--------|---------|----------------|
| iPhone Sync Modal | Custom progress UI | `<SyncProgress variant="detailed" />` |
| Email Sync Status | Badge/text | `<SyncProgress variant="compact" />` |
| Data Import | Loading spinner | `<SyncProgress variant="standard" />` |
| Export Progress | Modal with bar | `<SyncProgress variant="standard" />` |
| Background Sync | None/notification | `<SyncProgress variant="compact" />` |

## Acceptance Criteria

- [ ] Single `SyncProgress` component with variants (compact, standard, detailed)
- [ ] Supports progress percentage and custom text
- [ ] Supports step-by-step checklist (expandable)
- [ ] Shows last sync info when available
- [ ] Error state with diagnostic copy button
- [ ] Cancel and retry action support
- [ ] Used consistently across all sync/progress screens
- [ ] Accessible (ARIA progressbar, status updates)

## Files Likely Involved

- New: `src/components/ui/SyncProgress/SyncProgress.tsx`
- New: `src/components/ui/SyncProgress/SyncProgressSteps.tsx`
- New: `src/components/ui/SyncProgress/types.ts`
- Update: `src/components/iphone/SyncProgress.tsx` - Replace or wrap
- Update: Any other components showing sync/progress UI

## Implementation Notes

- Should handle indeterminate progress (spinner) when percentage unknown
- Consider animation for step transitions
- Step timing should be human-readable ("45s", "3m 22s", "~2 hours")
- Error diagnostic report should include: steps completed, error message, timestamps, device info

## Related

- BACKLOG-023 (Detailed Sync Progress) - Original spec for iPhone sync
- BACKLOG-289 (Unified Notification System) - May show sync status as notifications
- BACKLOG-008 (New Transaction Flow) - May show "last sync" info

## Created
2026-01-16

## Reported By
User (design sprint planning)
