# BACKLOG-631: User Groups

**Status:** Pending
**Priority:** Medium
**Category:** feature
**Effort:** ~60K tokens
**Created:** 2026-02-06

## Overview

Introduce user groups within an organization. Groups allow admins to organize agents by team, office, or specialty. Each group can have an assigned broker for review routing. Agents can belong to multiple groups.

## Business Value

- Organize agents by team/office/specialty
- Enable group-based review routing (used by BACKLOG-632)
- Simplify bulk role and permission management
- Foundation for future group-level policies

## Requirements

### Database

1. **`user_groups` table**
   - `id` UUID PK
   - `organization_id` UUID FK → organizations
   - `name` TEXT NOT NULL
   - `description` TEXT
   - `assigned_broker_id` UUID FK → org_members (nullable)
   - `created_at`, `updated_at` timestamps
   - UNIQUE constraint on (organization_id, name)

2. **`user_group_members` table**
   - `id` UUID PK
   - `group_id` UUID FK → user_groups (CASCADE DELETE)
   - `member_id` UUID FK → org_members (CASCADE DELETE)
   - `added_at` TIMESTAMPTZ DEFAULT now()
   - UNIQUE constraint on (group_id, member_id)

3. **RLS Policies**
   - SELECT: org members can read groups in their org
   - INSERT/UPDATE/DELETE: admin and it_admin only
   - Members junction: same rules

### UI Pages

4. **Groups List** — `/dashboard/groups`
   - Table showing all groups with name, description, member count, assigned broker
   - Create Group button → modal or inline form
   - Click row → group detail page

5. **Group Detail** — `/dashboard/groups/[id]`
   - Edit group name, description, assigned broker
   - Members list with add/remove
   - Member picker (search org members, multi-select)
   - Delete group with confirmation

### Server Actions

6. CRUD actions: createGroup, updateGroup, deleteGroup
7. Membership actions: addGroupMembers, removeGroupMember
8. Query: getGroups, getGroupById, getGroupMembers

## Acceptance Criteria

- [ ] `user_groups` and `user_group_members` tables created with RLS
- [ ] Groups list page at `/dashboard/groups`
- [ ] Group detail page at `/dashboard/groups/[id]`
- [ ] Create, edit, delete groups (admin/it_admin only)
- [ ] Add/remove members from groups
- [ ] Agents can belong to multiple groups
- [ ] Assigned broker dropdown on group (optional)
- [ ] Non-admin users cannot see groups pages

## Technical Considerations

- Migration for new tables + RLS policies
- Follow existing dashboard patterns (UserManagement page structure)
- Reuse existing member/role types from org_members
- Server actions pattern matching existing user management actions

## Dependencies

- None (standalone, but designed to work with BACKLOG-632)

## Dependents

- BACKLOG-632 (uses group-based routing for broker assignment)

## References

- Existing `org_members` table and user management pages
- Dashboard layout patterns
