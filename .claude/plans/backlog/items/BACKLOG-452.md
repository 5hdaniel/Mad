# BACKLOG-452: Admin User Management UI

## Summary

Add an admin interface in the broker portal to view and manage organization members with their statuses (invited, active, suspended, expired).

## Category

Portal / Admin

## Priority

P2 - Enhancement

## Description

### Problem

Admins currently have no visibility into:
- Who has been invited but hasn't joined
- Which invitations have expired
- Which users are active vs suspended
- Ability to deactivate users

### Solution

Create an admin page in the broker portal showing all organization members with:

1. **User List View**
   - Display name / email
   - Role (agent, broker, admin)
   - Status badge (computed from data)
   - Last login date
   - Actions (suspend, reactivate, resend invite)

2. **Computed User Status** (derived from existing fields):
   | Status | Condition |
   |--------|-----------|
   | `invited` | `user_id IS NULL` AND `invitation_expires_at > NOW()` |
   | `invite_expired` | `user_id IS NULL` AND `invitation_expires_at <= NOW()` |
   | `active` | `license_status = 'active'` |
   | `suspended` | `license_status = 'suspended'` |
   | `expired` | `license_status = 'expired'` |

3. **Admin Actions**
   - Resend invitation (reset expiry)
   - Suspend user (set license_status = 'suspended')
   - Reactivate user (set license_status = 'active')
   - Remove from organization

### Schema (Already Exists)

The `organization_members` table already has all needed fields:
- `license_status` (pending, active, suspended, expired)
- `invitation_expires_at`, `joined_at` for invitation tracking
- `user_id` NULL until invite accepted

No schema changes required - just UI and possibly a database view for computed status.

## Acceptance Criteria

- [ ] Admin can view list of all organization members
- [ ] Status badges show correct computed status
- [ ] Admin can suspend/reactivate users
- [ ] Admin can resend expired invitations
- [ ] Only admin/it_admin roles can access this page
- [ ] RLS policies enforce admin-only access

## Estimated Effort

~40K tokens

## Dependencies

- Broker portal deployed
- Admin role assigned to user

## Related Items

- BACKLOG-419: RLS Policies (needs admin policies)
