# BACKLOG-525: UX - Usage Progress Indicators and Upgrade Prompts

**Category**: ui
**Priority**: P2 (Medium)
**Sprint**: -
**Estimated Tokens**: ~35K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Add UI components showing users their license usage and prompting upgrades at appropriate moments.

## Background

Users need clear visibility into:
- How many transactions they've used
- Days remaining in trial
- Device registration status
- When they're approaching limits

## Requirements

### Progress Indicators

1. **Transaction Usage Bar**
   - Show X of Y transactions used
   - Color coding (green/yellow/red)
   - Tooltip with details

2. **Trial Countdown**
   - Days remaining badge
   - Prominent display when < 7 days
   - Urgent styling when < 3 days

3. **Device Status**
   - Current device indicator
   - List of registered devices
   - Quick deactivate option

### Upgrade Prompts

1. **Soft Prompts** (non-blocking)
   - Banner when 80% of transaction limit
   - Toast when 7 days left in trial
   - Settings page upgrade section

2. **Hard Prompts** (blocking)
   - Modal when trial expired
   - Modal when transaction limit reached
   - Include pricing and upgrade button

### Component Library

```typescript
// Components to create
- <LicenseUsageBar />
- <TrialCountdown />
- <DeviceStatusBadge />
- <UpgradePromptBanner />
- <UpgradeBlockingModal />
- <LicenseSettingsSection />
```

### Placement

- Usage bar: Dashboard header
- Trial countdown: App header (when < 14 days)
- Upgrade banner: Dashboard (when 80% used)
- Settings: Dedicated license section

## Acceptance Criteria

- [ ] Usage bar shows accurate transaction count
- [ ] Trial countdown appears at appropriate threshold
- [ ] Upgrade prompts trigger at correct moments
- [ ] Blocking modal cannot be dismissed without action
- [ ] UI is accessible and responsive

## Dependencies

- BACKLOG-478 (License Validation Service) - IN PROGRESS
- BACKLOG-520 (Stripe Integration) - For upgrade flow

## Related Files

- `src/components/license/LicenseUsageBar.tsx`
- `src/components/license/TrialCountdown.tsx`
- `src/components/license/UpgradePrompt.tsx`
- `src/pages/Settings/LicenseSection.tsx`
