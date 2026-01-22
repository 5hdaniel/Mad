# BACKLOG-398: Portal - Dashboard + Submission List

**Priority:** P0 (Critical)
**Category:** ui / portal
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~30K

---

## Summary

Create the broker portal dashboard with summary statistics and a filterable list of transaction submissions for review.

---

## Problem Statement

Once authenticated, brokers need to:
1. See an overview of pending submissions
2. View a list of all submissions with status filtering
3. Navigate to individual submissions for review
4. Understand workload at a glance

---

## Proposed Solution

### Dashboard Layout

Create `broker-portal/app/dashboard/layout.tsx`:

```tsx
import { AuthProvider } from '@/components/providers/AuthProvider'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="py-8 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  )
}
```

### Dashboard Overview

Create `broker-portal/app/dashboard/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/StatCard'
import { RecentSubmissions } from '@/components/RecentSubmissions'

export default async function DashboardPage() {
  const supabase = createClient()
  
  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user?.id)
    .single()
  
  if (!membership) {
    return <div>No organization found</div>
  }
  
  // Get submission counts
  const { data: submissions } = await supabase
    .from('transaction_submissions')
    .select('id, status')
    .eq('organization_id', membership.organization_id)
  
  const stats = {
    pending: submissions?.filter(s => s.status === 'submitted').length || 0,
    underReview: submissions?.filter(s => s.status === 'under_review').length || 0,
    needsChanges: submissions?.filter(s => 
      s.status === 'needs_changes' || s.status === 'resubmitted'
    ).length || 0,
    approved: submissions?.filter(s => s.status === 'approved').length || 0,
    rejected: submissions?.filter(s => s.status === 'rejected').length || 0,
  }
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of transaction submissions</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Pending Review"
          value={stats.pending}
          icon="clock"
          color="blue"
          href="/dashboard/submissions?status=submitted"
        />
        <StatCard
          title="Under Review"
          value={stats.underReview}
          icon="eye"
          color="yellow"
          href="/dashboard/submissions?status=under_review"
        />
        <StatCard
          title="Changes Requested"
          value={stats.needsChanges}
          icon="alert"
          color="orange"
          href="/dashboard/submissions?status=needs_changes"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon="check"
          color="green"
          href="/dashboard/submissions?status=approved"
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon="x"
          color="red"
          href="/dashboard/submissions?status=rejected"
        />
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Recent Submissions</h2>
        </div>
        <RecentSubmissions organizationId={membership.organization_id} />
      </div>
    </div>
  )
}
```

### Submission List Page

Create `broker-portal/app/dashboard/submissions/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { SubmissionList } from '@/components/SubmissionList'
import { StatusFilter } from '@/components/StatusFilter'

interface PageProps {
  searchParams: { status?: string; search?: string }
}

export default async function SubmissionsPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { status, search } = searchParams
  
  // Get user's organization
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user?.id)
    .single()
  
  // Build query
  let query = supabase
    .from('transaction_submissions')
    .select(`
      id,
      property_address,
      property_city,
      property_state,
      transaction_type,
      status,
      submitted_by,
      message_count,
      attachment_count,
      created_at,
      updated_at,
      users:submitted_by (
        email,
        raw_user_meta_data
      )
    `)
    .eq('organization_id', membership?.organization_id)
    .order('created_at', { ascending: false })
  
  // Apply filters
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  
  if (search) {
    query = query.ilike('property_address', `%${search}%`)
  }
  
  const { data: submissions } = await query
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-600">
            {submissions?.length || 0} submissions
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <StatusFilter currentStatus={status || 'all'} />
      </div>

      {/* List */}
      <SubmissionList submissions={submissions || []} />
    </div>
  )
}
```

### SubmissionList Component

Create `broker-portal/components/SubmissionList.tsx`:

```tsx
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'

interface Submission {
  id: string
  property_address: string
  property_city: string | null
  property_state: string | null
  transaction_type: string
  status: string
  message_count: number
  attachment_count: number
  created_at: string
  users: {
    email: string
    raw_user_meta_data: { name?: string }
  }
}

export function SubmissionList({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No submissions found
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Property
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Agent
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Messages
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Submitted
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {submissions.map((submission) => (
            <tr key={submission.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div>
                  <div className="font-medium text-gray-900">
                    {submission.property_address}
                  </div>
                  <div className="text-sm text-gray-500">
                    {submission.property_city}, {submission.property_state}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {submission.users?.raw_user_meta_data?.name || submission.users?.email}
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={submission.status} />
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {submission.message_count} msgs, {submission.attachment_count} files
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {formatDate(submission.created_at)}
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/dashboard/submissions/${submission.id}`}
                  className="text-blue-600 hover:text-blue-900 font-medium"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### StatusBadge Component

Create `broker-portal/components/StatusBadge.tsx`:

```tsx
const statusConfig = {
  submitted: { label: 'Pending', color: 'bg-blue-100 text-blue-800' },
  under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' },
  needs_changes: { label: 'Changes Requested', color: 'bg-orange-100 text-orange-800' },
  resubmitted: { label: 'Resubmitted', color: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    color: 'bg-gray-100 text-gray-800',
  }

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `broker-portal/app/dashboard/layout.tsx` | Dashboard shell layout |
| `broker-portal/app/dashboard/page.tsx` | Dashboard overview |
| `broker-portal/app/dashboard/submissions/page.tsx` | Submission list |
| `broker-portal/components/Sidebar.tsx` | Navigation sidebar |
| `broker-portal/components/Header.tsx` | Top header with user menu |
| `broker-portal/components/StatCard.tsx` | Statistics card |
| `broker-portal/components/SubmissionList.tsx` | Submission table |
| `broker-portal/components/StatusBadge.tsx` | Status badge |
| `broker-portal/components/StatusFilter.tsx` | Filter buttons |
| `broker-portal/components/RecentSubmissions.tsx` | Recent list for dashboard |

---

## Dependencies

- BACKLOG-396: Next.js project setup
- BACKLOG-397: Supabase Auth (user context)
- BACKLOG-387: Schema (data to display)

---

## Acceptance Criteria

- [ ] Dashboard layout with sidebar navigation
- [ ] Stats cards show correct counts
- [ ] Stats cards link to filtered list
- [ ] Submission list shows all org submissions
- [ ] Status filter works correctly
- [ ] Search by address works
- [ ] Clicking "Review" navigates to detail page
- [ ] Empty state displayed when no submissions
- [ ] Loading states for async data
- [ ] Responsive design (mobile-friendly)

---

## Technical Notes

### Data Fetching

Use Server Components for initial data fetch:
- No loading spinner needed
- SEO friendly
- Fast initial paint

For real-time updates (post-demo), add Supabase Realtime subscriptions.

### Organization Scoping

All queries include organization filter:
```typescript
.eq('organization_id', membership.organization_id)
```

RLS also enforces this, providing defense in depth.

### User Display

Agent names come from `users.raw_user_meta_data.name` (OAuth profile) or email fallback.

### Pagination

For demo, load all submissions. Post-demo, add pagination:

```typescript
const PAGE_SIZE = 20
const { data, count } = await supabase
  .from('transaction_submissions')
  .select('*', { count: 'exact' })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
```

---

## Testing Plan

1. Login as broker, verify dashboard loads
2. Verify stats show correct counts
3. Click stat card, verify filtered list
4. View submission list, verify all columns
5. Filter by status, verify results
6. Search by address, verify results
7. Click "Review", verify navigation
8. Test empty state (no submissions)
9. Test responsive layout on mobile

---

## Related Items

- BACKLOG-396: Next.js Setup (dependency)
- BACKLOG-397: Supabase Auth (dependency)
- BACKLOG-399: Submission Detail (next page)
- SPRINT-050: B2B Broker Portal Demo
