# BACKLOG-935: Broker Portal Settings -- Allow Brokers to Manage Org-Level Feature Toggles

**Type:** feature
**Area:** broker-portal
**Priority:** medium
**Status:** Pending
**Created:** 2026-03-12
**Estimated Effort:** ~30K tokens

---

## Summary

Add a settings area to the broker portal where brokers (or their IT administrators) can manage org-level configuration. This includes user management, global settings, and the future ability to toggle features like submission and export per-org.

---

## Problem Statement

Currently, org-level feature configuration is only accessible through the admin portal (Keepr internal staff). Brokers have no self-service way to manage their organization's settings. As the feature flag system matures (SPRINT-127), brokers will need the ability to control certain features for their organization -- particularly export and submission toggles -- without contacting Keepr support.

---

## Scope

### Settings Area Structure

The broker portal settings should provide:

1. **User Management**
   - View org members and their roles
   - Invite / remove users (within plan seat limits)
   - Assign roles (admin, viewer, etc.)

2. **Global Settings**
   - Organization name and metadata
   - Default preferences (timezone, notification settings)
   - Branding configuration (if applicable)

3. **Feature Toggles (Future Capability)**
   - Toggle per-org features that the plan allows
   - Example: disable `desktop_text_export` for a specific org even though the plan allows it
   - Example: disable `broker_text_view` to hide text messages from broker view
   - Only features enabled at the plan level can be toggled at the org level (plan is the ceiling)
   - Requires `organization_feature_overrides` or similar mechanism in the database

### Relationship to SPRINT-127

SPRINT-127 establishes the plan-level feature system with 8 platform-specific export keys and `broker_portal_access`. This backlog item builds on top of that by adding an **org-level override layer** where brokers can further restrict (but never expand beyond) what their plan allows.

The flow is:
```
Plan Features (ceiling)
    |
    v
Org-Level Overrides (broker-managed, can only disable, not enable beyond plan)
    |
    v
Effective Features (what the org actually gets)
```

### Technical Considerations

- Requires a new `organization_feature_overrides` table (or extension of `plan_features` with org scope)
- RPCs must check org overrides in addition to plan features
- `check_feature_access` RPC may need to be updated to consider org-level overrides
- Broker portal needs appropriate RLS policies for org-scoped settings access

---

## Files Affected (Expected)

| Location | Change |
|----------|--------|
| `broker-portal/app/dashboard/settings/` | New settings pages |
| `broker-portal/app/dashboard/settings/users/` | User management page |
| `broker-portal/app/dashboard/settings/features/` | Feature toggle page |
| `broker-portal/components/settings/` | Settings UI components |
| Supabase migration | `organization_feature_overrides` table, RPCs, RLS |
| `supabase/functions/` or RPCs | Org-level override RPCs |

---

## Acceptance Criteria

1. Broker portal has a Settings section accessible from the main navigation
2. Settings includes user management (view members, invite, remove)
3. Settings includes global org configuration (name, preferences)
4. Feature toggle page shows plan-allowed features with per-org override toggles
5. Org overrides can only disable features (not enable beyond plan ceiling)
6. `check_feature_access` respects org-level overrides
7. Changes are audit-logged
8. Broker portal builds and type-checks

---

## Dependencies

- **Depends on:** SPRINT-127 (License/Plan/Tier Unification) -- plan-level feature system must be in place
- **Depends on:** SPRINT-126 (Feature Gate Rework) -- COMPLETED
- **Related:** BACKLOG-932 (Broker portal access gate) -- defines the `broker_portal_access` feature that gates data visibility

---

## Notes

- This is a post-SPRINT-127 item; not scheduled for immediate implementation
- User management may overlap with existing broker portal user flows -- audit existing pages first
- The org-level override mechanism is the key new schema/RPC work
- Consider whether "toggle features per-org" should require a specific admin role in the broker portal
