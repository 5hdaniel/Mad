# BACKLOG-520: Stripe Payment Integration for License Purchases

**Category**: feature
**Priority**: P2 (Medium)
**Sprint**: -
**Estimated Tokens**: ~80K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Integrate Stripe for handling license purchases and subscription management, enabling users to upgrade from trial to paid licenses.

## Background

Currently there is no payment flow. Users need to be able to:
- Purchase individual licenses
- Subscribe to team plans
- Manage payment methods
- Cancel subscriptions

## Requirements

### Backend (Supabase Edge Functions)

1. **Checkout Session Creation**
   - Create Stripe checkout session for license purchase
   - Handle one-time and subscription payments

2. **Webhook Handler**
   - Process `checkout.session.completed`
   - Process `customer.subscription.updated`
   - Process `customer.subscription.deleted`
   - Update license table on payment events

3. **Customer Portal**
   - Create billing portal session for subscription management

### Frontend Changes

1. **Upgrade Button/Modal**
   - Show pricing options
   - Redirect to Stripe Checkout

2. **Billing Settings**
   - Link to Stripe Customer Portal
   - Show current subscription status

### Database Changes

```sql
ALTER TABLE licenses
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT;
```

## Acceptance Criteria

- [ ] Stripe checkout flow works end-to-end
- [ ] Webhooks properly update license status
- [ ] Customer portal accessible from app
- [ ] Test mode works for development
- [ ] Error handling for failed payments

## Dependencies

- BACKLOG-477 (License Schema) - COMPLETE
- Stripe account setup

## Related Files

- `supabase/functions/create-checkout-session/`
- `supabase/functions/stripe-webhook/`
- `src/components/license/UpgradeModal.tsx`
