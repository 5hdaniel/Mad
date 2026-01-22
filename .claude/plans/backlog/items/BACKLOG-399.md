# BACKLOG-399: Portal - Submission Detail View

**Priority:** P0 (Critical)
**Category:** ui / portal
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~35K

---

## Summary

Create the submission detail page where brokers can view complete transaction information, messages, and attachments for compliance review.

---

## Problem Statement

When reviewing a submission, brokers need to:
1. See transaction details (property, dates, parties)
2. View all communications (emails, texts)
3. Download/view attachments
4. See submission history (versions, previous reviews)
5. Take review actions (handled in BACKLOG-400)

---

## Proposed Solution

### Detail Page Structure

Create `broker-portal/app/dashboard/submissions/[id]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SubmissionHeader } from '@/components/submission/SubmissionHeader'
import { TransactionInfo } from '@/components/submission/TransactionInfo'
import { MessageList } from '@/components/submission/MessageList'
import { AttachmentList } from '@/components/submission/AttachmentList'
import { ReviewActions } from '@/components/submission/ReviewActions'
import { SubmissionTimeline } from '@/components/submission/SubmissionTimeline'

interface PageProps {
  params: { id: string }
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const supabase = createClient()
  
  // Fetch submission with messages and attachments
  const { data: submission, error } = await supabase
    .from('transaction_submissions')
    .select(`
      *,
      submitted_by_user:submitted_by (
        email,
        raw_user_meta_data
      ),
      reviewed_by_user:reviewed_by (
        email,
        raw_user_meta_data
      ),
      messages:submission_messages (
        id,
        channel,
        direction,
        subject,
        body_text,
        participants,
        sent_at,
        has_attachments,
        attachment_count
      ),
      attachments:submission_attachments (
        id,
        filename,
        mime_type,
        file_size_bytes,
        storage_path,
        document_type
      ),
      comments:submission_comments (
        id,
        content,
        comment_type,
        created_at,
        author:author_id (
          email,
          raw_user_meta_data
        )
      )
    `)
    .eq('id', params.id)
    .single()
  
  if (error || !submission) {
    notFound()
  }
  
  // Get submission history (previous versions)
  const { data: history } = await supabase
    .from('transaction_submissions')
    .select('id, version, status, created_at, reviewed_at, review_notes')
    .eq('local_transaction_id', submission.local_transaction_id)
    .eq('organization_id', submission.organization_id)
    .order('version', { ascending: true })
  
  return (
    <div className="space-y-6">
      {/* Header with property address and status */}
      <SubmissionHeader submission={submission} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content: 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Details */}
          <TransactionInfo submission={submission} />
          
          {/* Messages (Tabs: All, Emails, Texts) */}
          <MessageList messages={submission.messages} />
          
          {/* Attachments */}
          <AttachmentList attachments={submission.attachments} />
        </div>
        
        {/* Sidebar: 1 column */}
        <div className="space-y-6">
          {/* Review Actions (separate task BACKLOG-400) */}
          <ReviewActions 
            submission={submission} 
            disabled={submission.status === 'approved' || submission.status === 'rejected'}
          />
          
          {/* Timeline / History */}
          <SubmissionTimeline history={history || []} />
          
          {/* Comments */}
          <CommentsPanel comments={submission.comments} submissionId={submission.id} />
        </div>
      </div>
    </div>
  )
}
```

### SubmissionHeader Component

```tsx
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import Link from 'next/link'

export function SubmissionHeader({ submission }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/dashboard/submissions"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {submission.property_address}
          </h1>
          <p className="text-gray-500">
            {submission.property_city}, {submission.property_state} {submission.property_zip}
          </p>
        </div>
        <StatusBadge status={submission.status} size="lg" />
      </div>
      
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>
            Submitted by {submission.submitted_by_user?.raw_user_meta_data?.name || 
              submission.submitted_by_user?.email}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Submitted {formatDate(submission.created_at)}</span>
        </div>
        {submission.version > 1 && (
          <span className="text-orange-600">
            Resubmission (v{submission.version})
          </span>
        )}
      </div>
    </div>
  )
}
```

### TransactionInfo Component

```tsx
import { formatCurrency, formatDate } from '@/lib/utils'
import { Home, DollarSign, Calendar, Users } from 'lucide-react'

export function TransactionInfo({ submission }) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Transaction Details</h2>
      </div>
      <div className="p-6 grid grid-cols-2 gap-6">
        <InfoItem
          icon={Home}
          label="Transaction Type"
          value={capitalize(submission.transaction_type)}
        />
        <InfoItem
          icon={DollarSign}
          label="Listing Price"
          value={submission.listing_price ? formatCurrency(submission.listing_price) : 'N/A'}
        />
        <InfoItem
          icon={DollarSign}
          label="Sale Price"
          value={submission.sale_price ? formatCurrency(submission.sale_price) : 'N/A'}
        />
        <InfoItem
          icon={Calendar}
          label="Transaction Period"
          value={`${formatDate(submission.started_at)} - ${formatDate(submission.closed_at) || 'Ongoing'}`}
        />
        <InfoItem
          icon={Users}
          label="Communications"
          value={`${submission.message_count} messages, ${submission.attachment_count} attachments`}
        />
      </div>
    </div>
  )
}
```

### MessageList Component

```tsx
'use client'

import { useState } from 'react'
import { MessageCard } from './MessageCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

export function MessageList({ messages }) {
  const [filter, setFilter] = useState('all')
  
  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true
    if (filter === 'email') return msg.channel === 'email'
    if (filter === 'text') return msg.channel === 'sms' || msg.channel === 'imessage'
    return true
  })
  
  const emailCount = messages.filter(m => m.channel === 'email').length
  const textCount = messages.filter(m => m.channel !== 'email').length
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({messages.length})</TabsTrigger>
            <TabsTrigger value="email">Emails ({emailCount})</TabsTrigger>
            <TabsTrigger value="text">Texts ({textCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No messages</p>
        ) : (
          filteredMessages.map(message => (
            <MessageCard key={message.id} message={message} />
          ))
        )}
      </div>
    </div>
  )
}
```

### MessageCard Component

```tsx
import { Mail, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export function MessageCard({ message }) {
  const isEmail = message.channel === 'email'
  const Icon = isEmail ? Mail : MessageSquare
  const DirectionIcon = message.direction === 'outbound' ? ArrowUp : ArrowDown
  
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isEmail ? 'bg-blue-100' : 'bg-green-100'}`}>
          <Icon className={`h-4 w-4 ${isEmail ? 'text-blue-600' : 'text-green-600'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <DirectionIcon className="h-3 w-3 text-gray-400" />
            <span className="text-sm font-medium">
              {message.participants?.from || 'Unknown'}
            </span>
            <span className="text-xs text-gray-400">
              {formatDateTime(message.sent_at)}
            </span>
          </div>
          
          {message.subject && (
            <p className="font-medium text-gray-900 mb-1">{message.subject}</p>
          )}
          
          <p className="text-sm text-gray-600 line-clamp-3">
            {message.body_text}
          </p>
          
          {message.has_attachments && (
            <div className="mt-2 text-xs text-gray-500">
              {message.attachment_count} attachment(s)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `broker-portal/app/dashboard/submissions/[id]/page.tsx` | Detail page |
| `broker-portal/components/submission/SubmissionHeader.tsx` | Header component |
| `broker-portal/components/submission/TransactionInfo.tsx` | Transaction details |
| `broker-portal/components/submission/MessageList.tsx` | Message list with tabs |
| `broker-portal/components/submission/MessageCard.tsx` | Individual message |
| `broker-portal/components/submission/AttachmentList.tsx` | Attachment grid |
| `broker-portal/components/submission/SubmissionTimeline.tsx` | Version history |
| `broker-portal/components/submission/CommentsPanel.tsx` | Broker comments |

---

## Dependencies

- BACKLOG-396: Next.js setup
- BACKLOG-397: Auth (for user context)
- BACKLOG-398: Dashboard/List (navigation)
- BACKLOG-401: Message viewer (for full message modal)

---

## Acceptance Criteria

- [ ] Detail page loads with all submission data
- [ ] Property address and status displayed prominently
- [ ] Transaction details section shows all fields
- [ ] Message list with filter tabs (All, Emails, Texts)
- [ ] Messages display sender, date, subject, preview
- [ ] Attachment list shows all files
- [ ] Timeline shows submission history
- [ ] Back navigation to list works
- [ ] 404 for invalid submission ID
- [ ] Loading states for data fetch

---

## Technical Notes

### Data Relationships

Single query fetches all related data:
- `submission_messages` - All communications
- `submission_attachments` - All documents
- `submission_comments` - Broker feedback
- `submitted_by_user` - Agent info (join on users)
- `reviewed_by_user` - Reviewer info (join on users)

### Message Display

Messages are sorted by `sent_at` descending (newest first).

For long messages, show first 200 chars with "Show more" (client-side).

### Attachment URLs

Attachments use Supabase Storage. Generate signed URLs for viewing:

```typescript
const { data: { signedUrl } } = await supabase.storage
  .from('submission-attachments')
  .createSignedUrl(attachment.storage_path, 3600) // 1 hour
```

### Timeline Component

Shows version history for resubmissions:

```
v1 - Submitted Jan 15
v1 - Changes requested Jan 16
v2 - Resubmitted Jan 17
v2 - Approved Jan 18
```

---

## Testing Plan

1. Navigate to submission detail from list
2. Verify header shows correct address and status
3. Verify transaction details are accurate
4. Filter messages by type
5. Expand message to see full content
6. View attachment list
7. View timeline for resubmitted transactions
8. Test 404 with invalid ID
9. Test loading states

---

## Related Items

- BACKLOG-398: Dashboard/List (navigation)
- BACKLOG-400: Review Actions (sidebar actions)
- BACKLOG-401: Message Viewer (full message modal)
- SPRINT-050: B2B Broker Portal Demo
