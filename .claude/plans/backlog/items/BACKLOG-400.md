# BACKLOG-400: Portal - Review Actions (Approve/Reject/Request Changes)

**Priority:** P0 (Critical)
**Category:** feature / portal
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~25K

---

## Summary

Implement the review actions panel that allows brokers to approve, reject, or request changes on transaction submissions.

---

## Problem Statement

After reviewing a submission, brokers need to:
1. Approve submissions that pass compliance
2. Reject submissions with serious issues
3. Request changes with detailed feedback
4. Update submission status in the database
5. Trigger status sync to the agent's desktop app

---

## Proposed Solution

### ReviewActions Component

Create `broker-portal/components/submission/ReviewActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react'

interface ReviewActionsProps {
  submission: {
    id: string
    status: string
    organization_id: string
  }
  disabled?: boolean
}

export function ReviewActions({ submission, disabled }: ReviewActionsProps) {
  const [action, setAction] = useState<'approve' | 'reject' | 'changes' | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmitReview = async () => {
    if (!action) return
    
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        changes: 'needs_changes',
      }
      
      const { error } = await supabase
        .from('transaction_submissions')
        .update({
          status: statusMap[action],
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', submission.id)
      
      if (error) throw error
      
      // Optionally add a comment for the record
      if (notes) {
        await supabase.from('submission_comments').insert({
          submission_id: submission.id,
          author_id: user?.id,
          content: notes,
          comment_type: action === 'approve' ? 'approval' : 
                        action === 'reject' ? 'rejection' : 'feedback',
        })
      }
      
      // Refresh page to show updated status
      router.refresh()
      
      // Reset form
      setAction(null)
      setNotes('')
      
    } catch (error) {
      console.error('Review error:', error)
      alert('Failed to submit review. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (disabled) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Review Complete</h3>
        <p className="text-sm text-gray-500">
          This submission has been {submission.status}.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold mb-4">Review Actions</h3>
      
      {/* Action Buttons */}
      <div className="space-y-2 mb-4">
        <ActionButton
          icon={Check}
          label="Approve"
          description="Transaction audit passes compliance"
          selected={action === 'approve'}
          onClick={() => setAction('approve')}
          color="green"
        />
        <ActionButton
          icon={AlertTriangle}
          label="Request Changes"
          description="Agent needs to fix issues and resubmit"
          selected={action === 'changes'}
          onClick={() => setAction('changes')}
          color="orange"
        />
        <ActionButton
          icon={X}
          label="Reject"
          description="Submission cannot be approved"
          selected={action === 'reject'}
          onClick={() => setAction('reject')}
          color="red"
        />
      </div>
      
      {/* Notes Field */}
      {action && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {action === 'approve' ? 'Approval Notes (optional)' :
               action === 'changes' ? 'What changes are needed?' :
               'Rejection Reason'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm"
              rows={4}
              placeholder={
                action === 'approve' ? 'Add any notes for the record...' :
                action === 'changes' ? 'Describe what needs to be fixed...' :
                'Explain why this submission is being rejected...'
              }
              required={action !== 'approve'}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSubmitReview}
              disabled={loading || (action !== 'approve' && !notes.trim())}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 ${
                action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                action === 'changes' ? 'bg-orange-600 hover:bg-orange-700' :
                'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {action === 'approve' && <Check className="h-4 w-4" />}
                  {action === 'changes' && <AlertTriangle className="h-4 w-4" />}
                  {action === 'reject' && <X className="h-4 w-4" />}
                  <span>
                    {action === 'approve' ? 'Approve Submission' :
                     action === 'changes' ? 'Request Changes' :
                     'Reject Submission'}
                  </span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setAction(null)
                setNotes('')
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({ icon: Icon, label, description, selected, onClick, color }) {
  const colors = {
    green: 'border-green-500 bg-green-50',
    orange: 'border-orange-500 bg-orange-50',
    red: 'border-red-500 bg-red-50',
  }
  
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-2 transition ${
        selected ? colors[color] : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${
          color === 'green' ? 'text-green-600' :
          color === 'orange' ? 'text-orange-600' :
          'text-red-600'
        }`} />
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-gray-500">{description}</div>
        </div>
      </div>
    </button>
  )
}
```

### Confirmation Dialog

For reject action, add a confirmation step:

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'

function ConfirmRejectDialog({ open, onClose, onConfirm, notes }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Rejection</DialogTitle>
          <DialogDescription>
            Are you sure you want to reject this submission? This action is final.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-2">Rejection reason:</p>
          <p className="text-sm bg-gray-100 p-3 rounded">{notes}</p>
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Yes, Reject Submission
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Quick Review from List

Add quick actions to the submission list for common actions:

```tsx
// In SubmissionList.tsx

{submission.status === 'submitted' && (
  <div className="flex gap-2">
    <button
      onClick={() => handleQuickApprove(submission.id)}
      className="p-1 text-green-600 hover:bg-green-50 rounded"
      title="Quick Approve"
    >
      <Check className="h-4 w-4" />
    </button>
    <Link
      href={`/dashboard/submissions/${submission.id}`}
      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
      title="Review Details"
    >
      <Eye className="h-4 w-4" />
    </Link>
  </div>
)}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `broker-portal/components/submission/ReviewActions.tsx` | Main actions panel |
| `broker-portal/components/submission/ConfirmDialog.tsx` | Confirmation modal |
| `broker-portal/components/SubmissionList.tsx` | Quick action buttons |
| `broker-portal/app/api/submissions/[id]/review/route.ts` | Optional: API route for review |

---

## Dependencies

- BACKLOG-399: Submission Detail (displays this component)
- BACKLOG-397: Auth (user context for reviewed_by)
- BACKLOG-387: Schema (status field, comments table)

---

## Acceptance Criteria

- [ ] Three action buttons: Approve, Request Changes, Reject
- [ ] Selecting action shows notes field
- [ ] Approve works with optional notes
- [ ] Request Changes requires notes (minimum 10 chars)
- [ ] Reject shows confirmation dialog
- [ ] Reject requires notes
- [ ] Status updates in database after action
- [ ] reviewed_by and reviewed_at populated
- [ ] review_notes saved
- [ ] Comment created for record
- [ ] Page refreshes to show new status
- [ ] Actions disabled for terminal states
- [ ] Loading states during submission

---

## Technical Notes

### Status Transitions

Valid transitions:
- `submitted` -> `under_review` (implicit on open)
- `submitted` -> `approved`
- `submitted` -> `needs_changes`
- `submitted` -> `rejected`
- `under_review` -> `approved`
- `under_review` -> `needs_changes`
- `under_review` -> `rejected`
- `resubmitted` -> `approved`
- `resubmitted` -> `needs_changes`
- `resubmitted` -> `rejected`

Terminal states (no further actions):
- `approved`
- `rejected`

### Under Review Transition

Optionally mark as "under_review" when broker first opens:

```typescript
// In detail page server component
if (submission.status === 'submitted') {
  await supabase
    .from('transaction_submissions')
    .update({ status: 'under_review' })
    .eq('id', submission.id)
}
```

For demo, this is optional - direct to action is fine.

### Validation

| Action | Notes Required | Validation |
|--------|----------------|------------|
| Approve | No | None |
| Request Changes | Yes | Min 10 chars |
| Reject | Yes | Min 10 chars, confirmation |

### RLS for Updates

Brokers can update status because RLS policy allows:

```sql
CREATE POLICY "Brokers review submissions"
  ON transaction_submissions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('broker', 'admin')
    )
  );
```

---

## Testing Plan

1. Open submission as broker
2. Click Approve, verify no notes required
3. Submit approval, verify status changes
4. Open different submission
5. Click Request Changes, try submit without notes
6. Add notes, submit, verify status and notes saved
7. Open different submission
8. Click Reject, try submit without notes
9. Add notes, verify confirmation dialog
10. Confirm rejection, verify status and notes
11. Verify approved/rejected submissions show disabled state

---

## Related Items

- BACKLOG-399: Submission Detail (displays this)
- BACKLOG-395: Status Sync (agent sees result)
- SPRINT-050: B2B Broker Portal Demo
