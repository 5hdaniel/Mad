# BACKLOG-623: Bulk Edit Role Feature for User Management

## Description

Add bulk role editing capability to the broker portal user management page. Allows admins and IT admins to select multiple users and change their roles in one operation.

## Components

1. **BulkEditRoleModal** (`broker-portal/components/users/BulkEditRoleModal.tsx`)
   - Modal with role selector dropdown
   - Shows assignable roles based on current user's admin level
   - Calls `bulkUpdateRole` server action

2. **UserTableRow** (`broker-portal/components/users/UserTableRow.tsx`)
   - Renders individual user row in the list view
   - Includes selection checkbox and actions dropdown
   - Passes `onEditRole` handler to `UserActionsDropdown`

3. **bulkUpdateRole Server Action** (`broker-portal/lib/actions/bulkUpdateRole.ts`)
   - Validates admin permissions
   - Enforces role assignment rules (IT admins can assign all roles, admins cannot assign IT admin)
   - Prevents self-role-change via Supabase `.neq('user_id', user.id)`
   - Updates multiple organization members in a single query

4. **UserActionsDropdown Enhancement**
   - Added optional `onEditRole` prop for per-user role editing from the actions menu
   - Shows "Edit Role" option for active (non-pending) members

## Priority

Medium

## Status

In Progress

## Created

2026-02-06
