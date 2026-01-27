# BACKLOG-522: Upgrade/Downgrade License Flows

**Category**: feature
**Priority**: P2 (Medium)
**Sprint**: -
**Estimated Tokens**: ~40K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Implement self-service flows for users to upgrade or downgrade their license plans, including prorated billing and limit adjustments.

## Background

Users need to:
- Upgrade from trial to paid
- Upgrade from individual to team
- Downgrade from team to individual
- Handle billing proration

## Requirements

### Upgrade Flow

1. **Trial to Individual**
   - Show pricing/features comparison
   - Stripe checkout
   - Immediate limit increase
   - Mark trial as 'converted'

2. **Individual to Team**
   - Show team features
   - Prorated billing
   - Increase device/member limits
   - Enable team management features

### Downgrade Flow

1. **Team to Individual**
   - Check current usage vs new limits
   - Warn if over new limits
   - Prorated credit
   - Reduce limits at billing cycle end

2. **Edge Cases**
   - More devices than new limit allows
   - Team members need to be removed
   - Data migration considerations

### UI Components

1. **Plan Comparison Modal**
   - Feature matrix
   - Pricing details
   - Upgrade/Downgrade buttons

2. **Confirmation Dialogs**
   - Show what changes
   - Show billing impact
   - Require explicit confirmation

## Acceptance Criteria

- [ ] Upgrade flow works for all plan combinations
- [ ] Downgrade flow handles over-limit scenarios
- [ ] Billing proration is accurate
- [ ] UI clearly shows plan differences
- [ ] Confirmation prevents accidental changes

## Dependencies

- BACKLOG-520 (Stripe Integration) - Required
- BACKLOG-477 (License Schema) - COMPLETE

## Related Files

- `src/components/license/PlanComparison.tsx`
- `electron/services/licenseService.ts`
- Supabase functions for plan changes
