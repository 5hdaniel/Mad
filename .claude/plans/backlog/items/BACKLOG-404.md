# BACKLOG-404: Internal Admin Panel for User Management

**Priority:** P2 (Post-Demo)
**Category:** admin / operations
**Created:** 2026-01-22
**Status:** Backlog
**Sprint:** TBD

---

## Summary

Build an internal admin panel for dev team, customer service, and sales to manage user accounts, organizations, and access.

---

## Problem Statement

Currently, managing user accounts requires direct database access. Internal teams need a UI to:
- View and search user accounts
- Grant/revoke access to organizations
- Manage subscription tiers and trials
- Troubleshoot user issues
- Onboard new customers (sales demos)

---

## Proposed Solution

### Admin Portal Features

| Feature | Description | Access Level |
|---------|-------------|--------------|
| **User Search** | Search by email, name, org | All internal |
| **User Details** | View profile, login history, orgs | All internal |
| **Grant Org Access** | Add user to organization with role | Customer Service+ |
| **Manage Subscription** | Upgrade/downgrade, extend trials | Sales+ |
| **Impersonate User** | View portal as user (read-only) | Dev Team only |
| **Audit Logs** | View all actions taken on account | All internal |

### Access Levels

1. **Support**: View-only, can see user details
2. **Customer Service**: Can grant access, reset accounts
3. **Sales**: Can manage subscriptions, create demo orgs
4. **Dev Team**: Full access including impersonation

### Implementation Options

| Option | Pros | Cons |
|--------|------|------|
| **Separate admin app** | Isolated, secure | Another deployment |
| **Admin routes in broker portal** | Shared codebase | More complex auth |
| **Supabase Dashboard + RLS** | No code needed | Limited UX |
| **Retool/Appsmith** | Fast to build | External tool, cost |

### Recommended: Admin routes in broker portal

Add `/admin/*` routes protected by internal email domain or special role:

```typescript
// middleware.ts
if (pathname.startsWith('/admin')) {
  // Check if user has 'internal' role or @magicaudit.com email
  const isInternal = user?.email?.endsWith('@magicaudit.com')
    || membership?.role === 'internal_admin';
  if (!isInternal) redirect('/dashboard');
}
```

---

## Database Changes

```sql
-- Add internal admin role
ALTER TABLE organization_members
DROP CONSTRAINT organization_members_role_check;

ALTER TABLE organization_members
ADD CONSTRAINT organization_members_role_check
CHECK (role IN ('agent', 'broker', 'admin', 'it_admin', 'internal_admin'));

-- Or create separate internal_users table
CREATE TABLE internal_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  access_level VARCHAR(50) NOT NULL, -- support, cs, sales, dev
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Acceptance Criteria

- [ ] Internal team can search users by email/name
- [ ] Internal team can view user's organizations and roles
- [ ] Customer service can add users to organizations
- [ ] Sales can extend trials and change subscription tiers
- [ ] All admin actions are logged for audit
- [ ] Access restricted to internal team only

---

## Security Considerations

- Require MFA for admin access
- Log all admin actions with user ID and timestamp
- Implement rate limiting on admin endpoints
- Consider IP allowlisting for admin routes
- Impersonation should be read-only and logged

---

## Related Items

- BACKLOG-389: Demo Seed Data
- SPRINT-050: B2B Broker Portal

