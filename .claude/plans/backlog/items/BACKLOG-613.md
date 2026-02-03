# BACKLOG-613: Broker Portal Users Management Tab

## User Story

As a broker organization admin, I need to manage my team members through the broker portal, so I can invite new users, change roles, and deactivate users who leave the organization.

## Category

feature

## Priority

High (enterprise requirement)

## Status

In Progress (SPRINT-071)

## Feature Requirements

### 1. User List View
- Display all organization members with name, email, role, and status
- Search and filter by name, email, role, or status
- Show pending invitations alongside active users
- Indicate current user with "(You)" marker

### 2. Invite New Users
- Modal to invite by email address
- Role selection (agent, broker, admin)
- Generate shareable invitation link
- Track pending invitations

### 3. Role Management
- Change user roles (with permission checks)
- Only it_admin can assign it_admin role
- Protect last admin from demotion

### 4. User Deactivation/Removal
- Deactivate (soft delete) - suspends access but keeps record
- Remove - deletes membership record entirely
- Revoke pending invitations
- Protect last admin from removal

### 5. User Details View
- Full profile information
- Membership details (joined date, invited by)
- SSO/SCIM provisioning info (if applicable)
- Action buttons for management

## Acceptance Criteria

- [ ] Users nav link visible to admin/it_admin only
- [ ] User list displays with search and filter
- [ ] Invite modal creates invitation with link
- [ ] Role editing works with permission checks
- [ ] Deactivation suspends user access
- [ ] Removal deletes membership record
- [ ] User details page shows comprehensive info
- [ ] Last admin protection works

## Technical Considerations

- Builds on broker portal from SPRINT-050
- Leverages SSO/SCIM schema from SPRINT-070
- Uses Next.js server actions pattern
- Role-based access control throughout

## Dependencies

- SPRINT-070 (SSO/SCIM Schema) - provides provisioning columns
- SPRINT-050 (Broker Portal) - provides UI foundation

## Estimated Tokens

~150K total across all tasks

## Related Items

- BACKLOG-376: SCIM User Provisioning & Role Management
- BACKLOG-452: Admin User Management UI
- BACKLOG-070: Enterprise User Management (deferred)
- SPRINT-070: SSO/SCIM Schema Preparation

## Sprint

SPRINT-071 (Broker Users Management)
