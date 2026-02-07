# TASK-1913: Contacts Dashboard Page + Import UI

**Backlog ID:** BACKLOG-628
**Sprint:** SPRINT-072
**Phase:** Phase 4 - UI
**Branch:** `feature/task-1913-contacts-dashboard-ui`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~25K (ui category x 1.0 = ~25K)
**Depends On:** TASK-1912 (server actions must be available)
**SR Review Status:** Reviewed -- 2 changes incorporated (see below)

---

## Objective

Create a Contacts page in the broker portal dashboard that displays imported contacts in a table, provides an "Import from Outlook" button, supports source filtering and search, and shows appropriate empty/error states.

---

## Context

### Existing Dashboard Structure
- Dashboard layout: `app/dashboard/layout.tsx` -- top nav with links (Dashboard, Submissions, Users)
- Users page: `app/dashboard/users/page.tsx` -- good reference for data table pattern
- Components: `components/users/` -- UserListClient, UserSearchFilter, etc. (reference patterns)

### Server Actions Available (from TASK-1912)
- `syncOutlookContacts()` -- Triggers import, returns `{ success, count, error }`
- `getExternalContacts({ source?, search?, limit?, offset? })` -- Fetches contacts with filtering

### Design Principles
- Follow existing patterns from the Users page (server-rendered table with client filters)
- Use existing Tailwind classes and component patterns
- Responsive design (mobile-friendly table)
- Accessible (proper ARIA labels, keyboard navigation)

---

## Requirements

### Must Do:

1. **Add "Contacts" nav link to dashboard layout** (`app/dashboard/layout.tsx`):
   - Add between "Submissions" and "Users" in the nav

   > **SR Engineer Note [LOW]:** Role gating for the Contacts nav link is a PM decision.
   > For now, make it visible to ALL authenticated roles (admin, broker, it_admin).
   > Future sprint can restrict if needed.

   ```tsx
   <Link href="/dashboard/contacts" className="...">
     Contacts
   </Link>
   ```

2. **Create contacts page** (`app/dashboard/contacts/page.tsx`):

   > **SR Engineer Note [MEDIUM]:** Use server-action-driven search/filter instead of
   > client-side filtering. This is more scalable for large contact lists. The client component
   > should call `getExternalContacts()` server action with search/filter params on each
   > user interaction (debounced), rather than filtering a pre-loaded array in memory.

   - Server component that fetches initial contacts on load
   - Client component calls server action for search/filter (not client-side array filtering)
   ```tsx
   export default async function ContactsPage() {
     const { contacts, total } = await getExternalContacts({ limit: 50, offset: 0 });
     return <ContactsListClient initialContacts={contacts} initialTotal={total} />;
   }
   ```

3. **Create loading state** (`app/dashboard/contacts/loading.tsx`):
   - Skeleton UI matching the contacts table layout
   - Follow pattern from `app/dashboard/users/loading.tsx`

4. **Create client component** (`components/contacts/ContactsListClient.tsx`):
   - Contact table with columns: Name, Email, Phone, Company, Source, Synced At
   - "Import from Outlook" button in header area
   - Source filter tabs/dropdown: All | Outlook | Gmail | Manual
   - **Server-action-driven search**: Search input calls `getExternalContacts({ search, source, limit, offset })` server action on change (debounced ~300ms), NOT client-side array filtering
   - Contact count display (e.g., "47 contacts")
   - Import progress state (spinner + "Importing contacts...")
   - Success notification after import ("Imported 47 contacts from Outlook")
   - Error states:
     - "not_connected": "Sign in with Microsoft to import Outlook contacts"
     - "permission_denied": "Microsoft Contacts permission not granted. Please re-sign in."
     - "token_expired": "Your Microsoft session has expired. Please sign in again."

5. **Create contact table row component** (`components/contacts/ContactRow.tsx`):
   ```tsx
   function ContactRow({ contact }: { contact: ExternalContact }) {
     return (
       <tr className="hover:bg-gray-50">
         <td>{contact.name || 'Unknown'}</td>
         <td>{contact.email || '-'}</td>
         <td>{contact.phone || '-'}</td>
         <td>{contact.company || '-'}</td>
         <td><SourceBadge source={contact.source} /></td>
         <td>{contact.synced_at ? formatRelativeTime(contact.synced_at) : '-'}</td>
       </tr>
     );
   }
   ```

6. **Create source badge component** (`components/contacts/SourceBadge.tsx`):
   ```tsx
   // Color-coded badges:
   // outlook -> blue badge with Outlook icon
   // gmail -> red badge
   // manual -> gray badge
   ```

7. **Empty state** when no contacts:
   ```tsx
   <EmptyState
     icon={<UsersIcon />}
     title="No contacts yet"
     description="Import contacts from Outlook to get started."
     action={<ImportButton />}
   />
   ```

8. **Handle import flow**:
   ```tsx
   const [importing, setImporting] = useState(false);
   const [result, setResult] = useState<SyncResult | null>(null);

   async function handleImport() {
     setImporting(true);
     try {
       const result = await syncOutlookContacts();
       setResult(result);
       if (result.success) {
         // Refresh contacts list
         router.refresh();
       }
     } finally {
       setImporting(false);
     }
   }
   ```

### Must NOT Do:
- Do NOT add new npm dependencies for UI (use existing Tailwind + Lucide icons)
- Do NOT modify server actions (TASK-1912 handles those)
- Do NOT implement contact editing/deletion (future feature)
- Do NOT implement Gmail import (future feature, but show the filter option)
- Do NOT add pagination yet (defer to future sprint if contact lists exceed 100)

---

## Acceptance Criteria

- [ ] "Contacts" nav link added to dashboard layout (visible to all authenticated roles)
- [ ] `/dashboard/contacts` page loads and shows contacts table
- [ ] Loading skeleton shown while data loads
- [ ] "Import from Outlook" button triggers sync server action
- [ ] Import progress indicator (spinner) shown during import
- [ ] Success/error feedback after import attempt
- [ ] Source filter (All / Outlook) works via server action (Gmail/Manual as future placeholders)
- [ ] Search by name/email/phone uses server-action-driven query (not client-side filtering)
- [ ] Contact count displayed
- [ ] Empty state shown when no contacts exist
- [ ] Error state shown when Microsoft permission not granted
- [ ] Responsive layout (works on mobile)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `broker-portal/app/dashboard/layout.tsx` - Add "Contacts" nav link

## Files to Create

- `broker-portal/app/dashboard/contacts/page.tsx` - Contacts page (server component)
- `broker-portal/app/dashboard/contacts/loading.tsx` - Loading skeleton
- `broker-portal/components/contacts/ContactsListClient.tsx` - Client component with table + filters
- `broker-portal/components/contacts/ContactRow.tsx` - Table row component
- `broker-portal/components/contacts/SourceBadge.tsx` - Source indicator badge

## Files to Read (for context)

- `broker-portal/app/dashboard/users/page.tsx` - Reference for page pattern
- `broker-portal/app/dashboard/users/loading.tsx` - Reference for loading skeleton
- `broker-portal/components/users/UserListClient.tsx` - Reference for client list component
- `broker-portal/components/users/UserSearchFilter.tsx` - Reference for search/filter pattern
- `broker-portal/components/ui/EmptyState.tsx` - Existing empty state component
- `broker-portal/lib/utils.ts` - Utility functions (formatRelativeTime, etc.)
- `broker-portal/lib/actions/contacts.ts` - Server actions from TASK-1912

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI components, would need React Testing Library setup)
- **Manual verification:** Navigate to /dashboard/contacts, click Import, verify contacts appear

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(contacts): add contacts dashboard page with Outlook import`
- **Branch:** `feature/task-1913-contacts-dashboard-ui`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from main
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] Verified TASK-1912 is merged (server actions available)

Implementation:
- [ ] Nav link added to dashboard layout
- [ ] Contacts page created
- [ ] Loading skeleton created
- [ ] Client component with table, filters, search
- [ ] Import button with progress/error states
- [ ] Source badge component
- [ ] Empty state component
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Build passes (npm run build)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No contacts page in broker portal
- **After**: Full contacts page with Outlook import, filtering, and search
- **Actual Tokens**: ~XK (Est: ~25K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The existing UI patterns don't fit the contacts use case well
- You need to add new npm dependencies (chart library, etc.)
- Contact import takes more than 30 seconds (need to discuss background job approach)
- You're unsure about the error UX for permission-denied scenarios
- You encounter blockers not covered in the task file
