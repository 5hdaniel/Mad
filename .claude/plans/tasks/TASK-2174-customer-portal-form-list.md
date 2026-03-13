# Task TASK-2174: Customer Portal - Ticket Submission Form & Ticket List

**Backlog ID:** BACKLOG-938
**Sprint:** SPRINT-130
**Status:** Pending

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

---

## Goal

Build the customer-facing ticket submission form at `/support/new` (NO AUTH REQUIRED), the customer ticket list at `/support/`, and add "Support" to the broker portal navigation. The form must work for both authenticated and unauthenticated users: auto-fill name/email if logged in, collect them manually if not. The ticket list shows tickets matching the user's email.

## Non-Goals

- Do NOT build the ticket detail page (TASK-2175)
- Do NOT implement file upload on the form (TASK-2176)
- Do NOT implement email notifications
- Do NOT implement rich text editing
- Do NOT modify broker portal middleware to gate `/support/*` (it already passes through)
- Do NOT build admin portal pages (already done)

## Deliverables

1. New file: `broker-portal/app/support/page.tsx` -- Customer ticket list page
2. New file: `broker-portal/app/support/new/page.tsx` -- Ticket submission form
3. New file: `broker-portal/app/support/layout.tsx` -- Support section layout with "Keepr Support" heading
4. New file: `broker-portal/lib/support-types.ts` -- Type definitions (subset of admin portal types)
5. New file: `broker-portal/lib/support-queries.ts` -- Supabase RPC query functions for customer context
6. New file: `broker-portal/app/support/components/TicketForm.tsx` -- The ticket submission form component
7. New file: `broker-portal/app/support/components/TicketList.tsx` -- Customer ticket list component
8. Update: Broker portal navigation -- Add "Support" link visible to all users

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

### Ticket Submission Form (`/support/new`)
- [ ] Form is accessible WITHOUT authentication (no login redirect)
- [ ] Form fields: Name, Email, Subject, Description, Category (hierarchical dropdown), Priority, Ticket Type
- [ ] If user is logged in: Name and Email are auto-filled from session
- [ ] If user is NOT logged in: Name and Email are editable text inputs (both required)
- [ ] Category dropdown shows hierarchical categories (parent -> subcategory)
- [ ] When "Compliance Guidance" category is selected, disclaimer appears: "We provide product guidance and workflow support. We do not provide legal advice."
- [ ] "Keepr Support" heading at the top of the page
- [ ] Submit calls `support_create_ticket` RPC
- [ ] On success: redirect to ticket list page with success message
- [ ] On error: show error message, preserve form data
- [ ] Form validation: Subject and Description required, min 3 chars each

### Ticket List (`/support/`)
- [ ] If authenticated: automatically shows tickets for the user's email
- [ ] If not authenticated: shows an email input field, user enters email, then sees their tickets
- [ ] Ticket list shows: Subject, Status (badge), Priority (badge), Created date
- [ ] Clicking a ticket navigates to `/support/[id]` (detail page built in TASK-2175)
- [ ] Empty state: "No tickets found" with link to create a new one
- [ ] "New Ticket" button links to `/support/new`

### Navigation
- [ ] "Support" link is visible in broker portal navigation to ALL users
- [ ] Support link navigates to `/support/`

### General
- [ ] `npx tsc --noEmit` passes in broker-portal

## Implementation Notes

### Auth Handling for Public Form

The broker portal middleware only protects `/dashboard/*` routes. `/support/*` routes pass through without auth. This is correct.

```typescript
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
// user may be null for unauthenticated visitors
```

### RPC Call for Unauthenticated Users

The `support_create_ticket` RPC accepts anon calls (GRANT to anon was done in TASK-2171). When `auth.uid()` is null, the RPC uses the provided `p_requester_email` and `p_requester_name`.

### Type Definitions (`broker-portal/lib/support-types.ts`)

Subset of admin portal types -- only what the customer portal needs:

```typescript
export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  ticket_type: string | null;
  category_id: string | null;
  requester_email: string;
  requester_name: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
  subcategory_name?: string;
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

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New', assigned: 'Assigned', in_progress: 'In Progress',
  pending: 'Pending', resolved: 'Resolved', closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
};
```

### Support Layout

```typescript
// broker-portal/app/support/layout.tsx
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Keepr Support</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

### Compliance Disclaimer

Use the category's `metadata.disclaimer` field or check the slug:
```typescript
{selectedCategory?.slug === 'compliance-guidance' && (
  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
    We provide product guidance and workflow support. We do not provide legal advice.
  </div>
)}
```

### Navigation Update

Find the broker portal navigation component and add a "Support" link. Check:
- `broker-portal/components/` for shared nav components
- `broker-portal/app/layout.tsx` for root layout
- The existing pattern for navigation items

## Do / Don't

### Do:
- Match broker portal's existing theme/styling
- Make the form mobile-responsive
- Handle both auth states gracefully
- Validate form before submission

### Don't:
- Do NOT add auth middleware for `/support/*` routes
- Do NOT require login to submit a ticket
- Do NOT add file upload to the form (TASK-2176)
- Do NOT install new UI libraries

## When to Stop and Ask

- If the broker portal navigation structure is significantly different from expected
- If the `support_create_ticket` RPC doesn't accept anon calls
- If the broker portal layout/theme is complex and unclear

## Testing Expectations

### Type Checking (MANDATORY)
- [ ] `npx tsc --noEmit` passes in `broker-portal/`

## PR Preparation

- **Title**: `feat(support): add customer ticket submission form and list in broker portal`
- **Labels**: `feature`, `ui`, `support`
- **Depends on**: TASK-2173

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
