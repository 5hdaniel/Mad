# BACKLOG-481: Trial Limit Enforcement UI

**Category**: ui
**Priority**: P1
**Sprint**: SPRINT-057
**Estimated Tokens**: ~10K
**Status**: Pending

---

## Summary

Create UI components to display trial status and enforce limits.

## Background

Users need clear feedback about their trial status, limits, and path to upgrade.

## Requirements

### Components

1. **TrialStatusBanner**:
   - Shows trial days remaining
   - Progress bar for transaction count
   - "Upgrade" CTA

2. **TransactionLimitWarning**:
   - Modal shown when approaching limit (4/5)
   - Prevents creation when at limit (5/5)
   - Clear upgrade path

3. **UpgradeScreen**:
   - Full-screen blocking when trial expired
   - Clear value proposition
   - Pricing and upgrade CTA

4. **DeviceLimitScreen**:
   - Shows registered devices
   - Option to deactivate a device
   - Explains why blocked

### Design Requirements

- Consistent with existing app design
- Non-intrusive banner for active trial
- Clear, not aggressive upgrade messaging
- Easy device management

## Acceptance Criteria

- [ ] Trial banner shows in dashboard
- [ ] Transaction limit warning appears at 4/5
- [ ] Creation blocked at 5/5 with upgrade prompt
- [ ] Upgrade screen blocks expired trials
- [ ] Device limit screen allows deactivation
- [ ] All components match app design

## Dependencies

- BACKLOG-480: License check must be integrated

## Related Files

- `src/components/license/TrialStatusBanner.tsx`
- `src/components/license/TransactionLimitWarning.tsx`
- `src/components/license/UpgradeScreen.tsx`
- `src/components/license/DeviceLimitScreen.tsx`
