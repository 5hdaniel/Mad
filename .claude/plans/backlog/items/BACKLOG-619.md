# BACKLOG-619: Admin Portal (Support, Sales & Impersonation)

**Category:** Feature
**Priority:** Medium
**Status:** Pending
**Estimated Tokens:** ~50K
**Created:** 2026-02-05

---

## Summary

Create a comprehensive admin portal for internal teams including:
- **Support Team**: User impersonation for debugging and troubleshooting
- **Sales Team**: Trial invites, account activity metrics, and sales-relevant data
- **Compliance**: Audit logs and user activity monitoring

This portal will be the central hub for all internal team operations.

---

## Requirements

### Sales Team Features

1. **Trial Account Management**
   - Send trial invites to prospects
   - Set trial duration (7, 14, 30 days)
   - Extend or convert trials to paid
   - View trial expiration dates

2. **Account Activity Dashboard**
   - Active users per organization
   - Last login dates
   - Feature usage metrics (transactions created, syncs completed, etc.)
   - Storage usage
   - Subscription status and billing info

3. **Organization Overview**
   - List all organizations with key metrics
   - Filter by: trial/paid, active/churned, size
   - Quick stats: MRR, user count, activity score

4. **Sales Actions**
   - Add notes to accounts
   - Set follow-up reminders
   - Tag accounts (hot lead, enterprise, etc.)
   - Export account lists

### Support Team Features

1. **Separate Admin Subdomain**
   - Host at `admin.magicaudit.com` or `support.magicaudit.com`
   - Completely isolated from user-facing portal
   - Mandatory 2FA for all admin users
   - Optional: IP allowlist for additional security

2. **User Selection & Impersonation**
   - Search users by email, name, or organization
   - View user details before impersonating
   - Start impersonation session with clear confirmation
   - Cannot impersonate other admins (prevent privilege escalation)

3. **Visual Impersonation Banner**
   - Bright, always-visible banner showing impersonation mode
   - Display: "Support Mode - Viewing as user@example.com"
   - Easy "Exit Impersonation" button always visible
   - Different color scheme to make impersonation obvious

4. **Comprehensive Audit Logging**
   - Log every impersonation event:
     - Admin ID (who)
     - Target user ID (whom)
     - Timestamp (when)
     - Reason (why - optional text field)
     - Actions taken during session
     - IP address and user agent
   - Audit logs immutable and retained for compliance

5. **Time-Limited Sessions**
   - Auto-expire impersonation after 30-60 minutes
   - Configurable session duration
   - Clear countdown timer visible to admin
   - Forced re-authentication to extend

6. **Read-Only Mode Option**
   - Toggle to view user data without modification ability
   - Safer for initial investigation
   - Can upgrade to full access if needed (with additional logging)

7. **Exit Impersonation**
   - Always-visible button to end impersonation
   - Clear confirmation of session end
   - Return to admin dashboard

---

## Technical Implementation

### Option A: Service Role with RLS Bypass

```typescript
// Admin endpoint to fetch user's data
async function impersonateUser(adminId: string, targetUserId: string) {
  // 1. Verify admin has impersonation permission
  const isAuthorized = await checkSuperAdminRole(adminId);
  if (!isAuthorized) throw new UnauthorizedError();

  // 2. Verify target is not an admin
  const targetRole = await getUserRole(targetUserId);
  if (['admin', 'it_admin', 'super_admin'].includes(targetRole)) {
    throw new ForbiddenError('Cannot impersonate admin users');
  }

  // 3. Log the impersonation event
  await auditLog.create({
    action: 'IMPERSONATION_START',
    adminId,
    targetUserId,
    timestamp: new Date(),
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });

  // 4. Create impersonation session token
  const sessionToken = await createImpersonationSession({
    adminId,
    targetUserId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  return { sessionToken };
}
```

### Option B: Supabase Auth Admin API

```typescript
// Generate a short-lived magic link for the target user
const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: targetUserEmail,
  options: {
    redirectTo: `${adminPortalUrl}/impersonate-session`
  }
});
```

### Database Schema

```sql
-- Impersonation audit log table
CREATE TABLE admin_impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  reason TEXT,
  actions_taken JSONB DEFAULT '[]',
  ip_address INET,
  user_agent TEXT,
  read_only BOOLEAN DEFAULT false,

  CONSTRAINT cannot_impersonate_self CHECK (admin_id != target_user_id)
);

-- Index for querying by admin or target
CREATE INDEX idx_impersonation_admin ON admin_impersonation_logs(admin_id);
CREATE INDEX idx_impersonation_target ON admin_impersonation_logs(target_user_id);
CREATE INDEX idx_impersonation_started ON admin_impersonation_logs(started_at DESC);

-- RLS: Only super_admins can read logs
ALTER TABLE admin_impersonation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_read_logs" ON admin_impersonation_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Only service role can insert (from admin API)
CREATE POLICY "service_role_insert_logs" ON admin_impersonation_logs
FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

---

## Security Considerations

| Requirement | Implementation |
|-------------|----------------|
| **Authentication** | Mandatory 2FA for admin portal |
| **Authorization** | Only `super_admin` role can impersonate |
| **Privilege Escalation Prevention** | Cannot impersonate admin/it_admin/super_admin roles |
| **Audit Trail** | All actions logged with immutable records |
| **Session Limits** | Auto-expire after configurable time (default 60 min) |
| **IP Restrictions** | Optional allowlist for admin portal access |
| **User Notification** | Optional: Email user when account accessed by support |

---

## User Stories

### Support
1. **As a support agent**, I need to view a user's data to help troubleshoot their reported issue
2. **As a compliance officer**, I need to audit all impersonation events for security reviews
3. **As a super admin**, I need to prevent other admins from being impersonated
4. **As a user**, I want to be notified if support accesses my account (optional)

### Sales
5. **As a sales rep**, I need to send trial invites to prospects I'm working with
6. **As a sales rep**, I need to see which trial accounts are active vs inactive to prioritize follow-ups
7. **As a sales manager**, I need to see overall trial conversion metrics
8. **As a sales rep**, I need to see account activity to identify upsell opportunities

---

## Out of Scope (Future Enhancements)

- Real-time shadowing (see user's screen live)
- Impersonation for mobile app
- Automated impersonation for automated testing
- User consent flow before impersonation

---

## Dependencies

- Super admin role implementation
- Separate admin portal infrastructure
- 2FA implementation for admin portal

---

## Acceptance Criteria

- [ ] Admin portal accessible at separate subdomain
- [ ] 2FA required for all admin logins
- [ ] Can search and select users to impersonate
- [ ] Cannot impersonate admin-level users
- [ ] Visual banner shows impersonation mode
- [ ] Session auto-expires after timeout
- [ ] All impersonation events logged with full details
- [ ] Audit logs viewable by super admins
- [ ] Exit impersonation button always visible
- [ ] Read-only mode available
