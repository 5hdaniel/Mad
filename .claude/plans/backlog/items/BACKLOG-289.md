# BACKLOG-289: Unified Notification System

## Category
UI/UX, Architecture

## Priority
Medium

## Status
Pending

## Description

Create a unified notification system with consistent toast/alert/notification components used across all screens. Currently, notifications may be implemented inconsistently across different parts of the app.

## Goals

1. **Single notification API** - One way to trigger notifications from anywhere in the app
2. **Consistent styling** - All notifications look the same (success, error, warning, info)
3. **Consistent behavior** - Same animation, positioning, auto-dismiss timing
4. **Accessible** - Proper ARIA roles, keyboard handling, screen reader support

## Proposed API

```typescript
// Simple usage
notify.success("Transaction saved successfully");
notify.error("Failed to connect to email provider");
notify.warning("Sync may take longer than usual");
notify.info("New messages detected");

// With options
notify.success("Transaction saved", {
  duration: 5000,        // Auto-dismiss after 5s (default: 3s)
  action: {
    label: "View",
    onClick: () => navigate("/transactions/123")
  }
});

// Persistent (no auto-dismiss)
notify.error("Connection lost", { persistent: true });
```

## Component Requirements

### Toast Component
- Appears in consistent position (top-right or bottom-right)
- Stacks multiple notifications
- Auto-dismisses after configurable duration
- Manual dismiss via X button
- Optional action button
- Variants: success (green), error (red), warning (yellow), info (blue)

### Context/Provider
- `NotificationProvider` wraps app
- `useNotification()` hook for triggering
- Queue management for multiple notifications

## Acceptance Criteria

- [ ] Single `NotificationProvider` component at app root
- [ ] `useNotification()` hook available throughout app
- [ ] Consistent toast styling for all notification types
- [ ] Auto-dismiss with configurable duration
- [ ] Manual dismiss option
- [ ] Action button support
- [ ] Stacking/queue for multiple notifications
- [ ] Accessible (ARIA, keyboard)
- [ ] All existing notification patterns migrated to new system

## Files Likely Involved

- New: `src/components/ui/Notification/` or `src/components/ui/Toast/`
- New: `src/contexts/NotificationContext.tsx`
- New: `src/hooks/useNotification.ts`
- Update: `src/App.tsx` - Add provider
- Update: Various components currently showing notifications

## Implementation Notes

- Consider using a library like `react-hot-toast` or `sonner` as base
- Or build custom with Tailwind + Headless UI
- Should integrate with existing design system

## Related

- BACKLOG-290 (Reusable Sync Progress Component) - may use notifications for sync status
- General UX consistency improvements

## Created
2026-01-16

## Reported By
User (design sprint planning)
