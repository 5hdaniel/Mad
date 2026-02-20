# BACKLOG-744: Internal Support Portal for Customer Account Management

**Priority:** High
**Type:** Feature
**Area:** Service
**Status:** Pending

## Description

Build an internal support portal that enables Magic Audit support agents to view customer account details, troubleshoot issues, and manage accounts without needing direct database access. This is a standard tool for any SaaS product with paying customers.

## Core Features

### 1. Account Lookup & Details
- Search by: email, name, organization name, user ID
- View: account status, plan/license, organization, team members
- View: device registrations, last login, session history
- View: sync status (last email sync, last message import, errors)
- View: transaction count, audit history

### 2. User Impersonation (Admin-Only)
- "View as user" mode — see what the user sees in the broker portal
- Impersonation must be:
  - Logged in the audit trail (who impersonated whom, when, for how long)
  - Restricted to admin role only (not regular support agents)
  - Visually indicated (banner: "You are viewing as user@example.com")
  - Time-limited (auto-expires after 30 minutes)
- Does NOT give access to the desktop app — broker portal only
- Supabase supports this via `auth.admin.getUserById()` + service_role key

### 3. Error & Health Dashboard
- **Sentry integration** (see BACKLOG-669): Surface recent errors per user/org
  - Error count, last error, most common errors
  - Link to Sentry issue for each error
- **Sync health**: Last successful sync, failed syncs, retry status
- **App version**: Which Electron version each user is running
- **Platform**: macOS/Windows, OS version

### 4. Account Actions
- Reset user password (trigger Supabase password reset email)
- Force sign-out all sessions (`auth.admin.signOut()` with service_role)
- Disable/enable account
- Modify organization settings
- Extend/modify license
- Clear stuck sync state

### 5. Audit Log Viewer
- View all actions taken on an account (by the user and by support agents)
- Filter by: date range, action type, agent
- Export audit log for compliance/legal requests

## Technical Considerations

### Architecture Options
- **Option A**: Separate Next.js app (like broker-portal) with its own Vercel deployment
- **Option B**: Protected routes within the existing broker-portal (`/admin/support/*`)
- **Option C**: Standalone tool using Supabase Dashboard + custom SQL views (quick but limited)

Option B is likely the best balance — reuses the existing auth, deployment, and UI infrastructure with role-based access control.

### Security Requirements
- Only accessible to users with `admin` or `support_agent` role
- All actions logged to audit trail
- Impersonation requires MFA confirmation
- No direct database write access — all mutations go through validated API endpoints
- Rate limiting on sensitive actions (password reset, force sign-out)

### Sentry Integration
- BACKLOG-669 covers adding Sentry to the desktop app
- Support portal would use Sentry API to pull error data per user
- Requires Sentry API token and project configuration

## Phased Rollout

### Phase 1: Account Lookup (MVP)
- Search users, view account details, org, devices, sync status
- Read-only — no mutations

### Phase 2: Account Actions
- Password reset, force sign-out, disable/enable
- Audit log viewer

### Phase 3: Impersonation + Sentry
- View-as-user in broker portal
- Sentry error dashboard per user

## Related Items

- **BACKLOG-669**: Sentry integration for error tracking (prerequisite for Phase 3)
- **BACKLOG-742**: Broker portal session timeout (applies to support portal too)
- **BACKLOG-484**: License validation (support portal needs to view/modify licenses)

## Acceptance Criteria

- [ ] Support agents can search and view customer account details
- [ ] Admins can impersonate users in the broker portal (with audit trail)
- [ ] All support actions are logged
- [ ] Role-based access (admin vs support_agent)
- [ ] Sentry errors surfaced per user (Phase 3)
- [ ] Force sign-out and password reset work
