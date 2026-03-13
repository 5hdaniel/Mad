# Task TASK-2172: Agent Dashboard - Ticket Queue & Navigation

**Backlog ID:** BACKLOG-938
**Sprint:** SPRINT-130
**Status:** Pending

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

---

## Goal

Build the support ticket queue page in the admin portal at `/dashboard/support/`, add the "Support" nav item to the sidebar (gated behind `support.view`), add the route permission to middleware, create the shared type definitions and query layer, and add a dashboard stats widget showing open/unassigned/urgent ticket counts.

## Non-Goals

- Do NOT build the ticket detail page (that is TASK-2173)
- Do NOT build the reply composer or conversation thread
- Do NOT build the customer portal (that is TASK-2174+)
- Do NOT build attachment upload/download UI
- Do NOT implement rich text editing
- Do NOT implement saved views
- Do NOT add E2E tests

## Deliverables

1. New file: `admin-portal/lib/support-types.ts` -- Type definitions for all support entities
2. New file: `admin-portal/lib/support-queries.ts` -- Supabase RPC query functions
3. New file: `admin-portal/app/dashboard/support/page.tsx` -- Ticket queue page
4. New file: `admin-portal/app/dashboard/support/components/TicketTable.tsx` -- Ticket table component
5. New file: `admin-portal/app/dashboard/support/components/TicketFilters.tsx` -- Filter controls
6. New file: `admin-portal/app/dashboard/support/components/StatsCards.tsx` -- Dashboard stat cards
7. New file: `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx` -- Create ticket modal
8. Update: `admin-portal/lib/permissions.ts` -- Add SUPPORT_* permission constants and support category
9. Update: `admin-portal/components/layout/Sidebar.tsx` -- Add "Support" nav item
10. Update: `admin-portal/middleware.ts` -- Add `/dashboard/support` route permission

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

- [ ] `/dashboard/support/` page renders a ticket queue table with columns: #, Subject, Status, Priority, Category, Requester, Assignee, Created
- [ ] Table supports pagination (20 tickets per page, next/prev buttons)
- [ ] Filter bar with dropdowns: Status, Priority, Category, Assignee
- [ ] Filters call `support_list_tickets` RPC with appropriate params
- [ ] Stats cards at top showing: Open tickets count, Unassigned count, Urgent count (via `support_get_ticket_stats` RPC)
- [ ] "Create Ticket" button opens a dialog/modal for agent-created tickets
- [ ] Create ticket form has: requester email, requester name, subject, description, category (hierarchical dropdown), priority, ticket type
- [ ] Sidebar shows "Support" nav item gated behind `support.view` permission
- [ ] Clicking "Support" in sidebar navigates to `/dashboard/support/`
- [ ] Middleware gates `/dashboard/support` behind `support.view` permission
- [ ] `PERMISSIONS` object in `permissions.ts` includes all 5 support permission keys
- [ ] `PERMISSION_CATEGORIES` includes `{ key: 'support', label: 'Support' }`
- [ ] Table rows are clickable, navigating to `/dashboard/support/[id]` (page doesn't exist yet, that's fine)
- [ ] Status badges use color coding: new=blue, assigned=yellow, in_progress=green, pending=orange, resolved=purple, closed=gray
- [ ] Priority badges use color coding: low=gray, normal=blue, high=orange, urgent=red
- [ ] `npx tsc --noEmit` passes in admin-portal (run this check)

## Implementation Notes

### Type Definitions (`admin-portal/lib/support-types.ts`)

```typescript
export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageType = 'reply' | 'internal_note';
export type SourceChannel = 'web_form' | 'email' | 'in_app_redirect' | 'admin_created';
export type ParticipantRole = 'cc' | 'watcher';
export type PendingReason = 'customer' | 'vendor' | 'internal';

export interface SupportTicket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  ticket_type: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  requester_id: string | null;
  requester_email: string;
  requester_name: string;
  assignee_id: string | null;
  organization_id: string | null;
  source_channel: SourceChannel;
  pending_reason: PendingReason | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields from RPCs
  category_name?: string;
  subcategory_name?: string;
  assignee_name?: string;
  assignee_email?: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  message_type: MessageType;
  body: string;
  created_at: string;
  attachments?: SupportTicketAttachment[];
}

export interface SupportTicketAttachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SupportTicketEvent {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SupportCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  children?: SupportCategory[];
}

export interface TicketListParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  category_id?: string;
  assignee_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface TicketStats {
  total_open: number;
  total_unassigned: number;
  total_urgent: number;
  by_status: Record<TicketStatus, number>;
}

export interface CreateTicketParams {
  subject: string;
  description: string;
  priority: TicketPriority;
  ticket_type?: string;
  category_id?: string;
  subcategory_id?: string;
  requester_email: string;
  requester_name: string;
  source_channel?: SourceChannel;
}

// Status transition map for UI validation
export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['assigned', 'in_progress'],
  assigned: ['in_progress', 'pending'],
  in_progress: ['pending', 'resolved'],
  pending: ['in_progress'],
  resolved: ['in_progress', 'closed'],
  closed: ['in_progress'],  // admin reopen only
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};
```

### Query Layer (`admin-portal/lib/support-queries.ts`)

```typescript
import { createClient } from '@/lib/supabase/client';
import type { TicketListParams, CreateTicketParams } from './support-types';

export async function listTickets(params: TicketListParams) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_tickets', {
    p_status: params.status || null,
    p_priority: params.priority || null,
    p_category_id: params.category_id || null,
    p_assignee_id: params.assignee_id || null,
    p_search: params.search || null,
    p_page: params.page || 1,
    p_page_size: params.page_size || 20,
  });
  if (error) throw error;
  return data;
}

export async function getTicketStats() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_ticket_stats');
  if (error) throw error;
  return data;
}

export async function createTicket(params: CreateTicketParams) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_create_ticket', {
    p_subject: params.subject,
    p_description: params.description,
    p_priority: params.priority,
    p_ticket_type: params.ticket_type || null,
    p_category_id: params.category_id || null,
    p_subcategory_id: params.subcategory_id || null,
    p_requester_email: params.requester_email,
    p_requester_name: params.requester_name,
    p_source_channel: params.source_channel || 'admin_created',
  });
  if (error) throw error;
  return data;
}

export async function getCategories() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}
```

### Permissions Update (`admin-portal/lib/permissions.ts`)

Add to the `PERMISSIONS` object:
```typescript
SUPPORT_VIEW: 'support.view',
SUPPORT_RESPOND: 'support.respond',
SUPPORT_ASSIGN: 'support.assign',
SUPPORT_MANAGE: 'support.manage',
SUPPORT_ADMIN: 'support.admin',
```

Add to `PERMISSION_CATEGORIES`:
```typescript
{ key: 'support', label: 'Support' },
```

### Sidebar Update (`admin-portal/components/layout/Sidebar.tsx`)

Add to `mainNavItems` array (after Plans, before the Settings section):
```typescript
import { Headphones } from 'lucide-react';  // or LifeBuoy

{ label: 'Support', href: '/dashboard/support', icon: Headphones, permission: PERMISSIONS.SUPPORT_VIEW },
```

### Middleware Update (`admin-portal/middleware.ts`)

Add to `ROUTE_PERMISSIONS`:
```typescript
'/dashboard/support': ['support.view'],
```

### Stats Cards

Display 3 stat cards at the top: Open tickets, Unassigned, Urgent. Use the `support_get_ticket_stats` RPC.

### Category Dropdown

Build a hierarchical dropdown: top-level categories as optgroup headers, subcategories as options. Fetch via `getCategories()`.

## Do / Don't

### Do:
- Use the existing admin portal component patterns (dark sidebar, white content area)
- Use Tailwind CSS classes matching the existing admin portal style
- Use `lucide-react` icons (already in the project)
- Handle loading states with skeletons or spinners
- Handle error states gracefully

### Don't:
- Do NOT install new UI libraries (use Tailwind + existing patterns)
- Do NOT build the ticket detail page (TASK-2173)
- Do NOT implement search yet (TASK-2176)
- Do NOT add attachment handling (TASK-2176)

## When to Stop and Ask

- If the existing admin portal uses a different data fetching pattern than expected
- If `usePermissions` or `hasPermission` hooks don't work as expected
- If the Sidebar.tsx structure has changed significantly from what's documented
- If the supabase client import path differs from `@/lib/supabase/client`

## Testing Expectations

### Type Checking (MANDATORY)
- [ ] `npx tsc --noEmit` passes in `admin-portal/`

## PR Preparation

- **Title**: `feat(support): add agent dashboard ticket queue, nav, and RBAC integration`
- **Labels**: `feature`, `ui`, `support`
- **Depends on**: TASK-2171

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~50K-70K

**Token Cap:** 280K (4x upper estimate)

**Confidence:** Medium

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~70K vs Actual ~XK (X% over/under)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
