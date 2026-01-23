'use client';

/**
 * ReviewActions Component
 *
 * Floating action bar at the bottom of the screen for broker review actions.
 * Allows brokers to approve, reject, or request changes on submissions.
 * Part of BACKLOG-400.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ReviewActionsProps {
  submission: {
    id: string;
    status: string;
    organization_id: string;
  };
  disabled?: boolean;
}

type ReviewAction = 'approve' | 'reject' | 'changes' | null;

export function ReviewActions({ submission, disabled }: ReviewActionsProps) {
  const [action, setAction] = useState<ReviewAction>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmitReview = async () => {
    if (!action) return;

    // For reject, show confirmation first
    if (action === 'reject' && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const statusMap: Record<Exclude<ReviewAction, null>, string> = {
        approve: 'approved',
        reject: 'rejected',
        changes: 'needs_changes',
      };

      const newStatus = statusMap[action];
      const now = new Date().toISOString();

      // First fetch current status_history to append to it
      const { data: currentSubmission } = await supabase
        .from('transaction_submissions')
        .select('status_history')
        .eq('id', submission.id)
        .single();

      // Build new history entry
      const historyEntry = {
        status: newStatus,
        changed_at: now,
        changed_by: user?.email || 'Unknown',
        notes: notes || undefined,
      };

      // Append to existing history or create new array
      const existingHistory = currentSubmission?.status_history || [];
      const updatedHistory = [...existingHistory, historyEntry];

      const { error: updateError } = await supabase
        .from('transaction_submissions')
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          reviewed_at: now,
          review_notes: notes || null,
          status_history: updatedHistory,
        })
        .eq('id', submission.id);

      if (updateError) throw updateError;

      // Add a comment for the record if notes provided
      if (notes && user) {
        await supabase.from('submission_comments').insert({
          submission_id: submission.id,
          user_id: user.id,
          content: notes,
        });
      }

      // Refresh page to show updated status
      router.refresh();

      // Reset form
      setAction(null);
      setNotes('');
      setShowConfirm(false);
    } catch (err) {
      console.error('Review error:', err);
      setError('Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setAction(null);
    setNotes('');
    setError(null);
    setShowConfirm(false);
  };

  // Terminal states - review is complete (show minimal floating bar)
  if (disabled || submission.status === 'approved' || submission.status === 'rejected') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-white border-t shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  submission.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                Review Complete -{' '}
                <span
                  className={`font-medium ${
                    submission.status === 'approved' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {submission.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rejection confirmation overlay
  if (showConfirm) {
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleCancel} />

        {/* Confirmation panel */}
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="bg-white border-t shadow-2xl rounded-t-2xl">
            <div className="max-w-2xl mx-auto px-6 py-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Confirm Rejection</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Rejection reason:</p>
                <p className="text-sm text-gray-700">{notes}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Rejecting...
                    </>
                  ) : (
                    'Yes, Reject Submission'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className={`bg-white border-t shadow-lg transition-all duration-300 ${action ? 'shadow-2xl' : ''}`}>
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2">
            <p className="text-sm text-red-700 text-center">{error}</p>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Expanded form when action selected */}
          {action && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  {action === 'approve'
                    ? 'Approval Notes (optional)'
                    : action === 'changes'
                      ? 'What changes are needed?'
                      : 'Rejection Reason'}
                </label>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                placeholder={
                  action === 'approve'
                    ? 'Add any notes for the record...'
                    : action === 'changes'
                      ? 'Describe what needs to be fixed...'
                      : 'Explain why this submission is being rejected...'
                }
                autoFocus
              />
              {action !== 'approve' && notes.length > 0 && notes.length < 10 && (
                <p className="mt-1 text-xs text-orange-600">
                  Please provide at least 10 characters of feedback.
                </p>
              )}
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex items-center gap-3">
            {!action ? (
              <>
                {/* Collapsed state - show all action buttons */}
                <span className="text-sm font-medium text-gray-700 mr-2">Review Actions:</span>
                <button
                  onClick={() => setAction('approve')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={() => setAction('changes')}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Request Changes
                </button>
                <button
                  onClick={() => setAction('reject')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </>
            ) : (
              <>
                {/* Expanded state - show submit and cancel */}
                <button
                  onClick={handleSubmitReview}
                  disabled={loading || (action !== 'approve' && notes.trim().length < 10)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : action === 'changes'
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      {action === 'approve' && (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve Submission
                        </>
                      )}
                      {action === 'changes' && (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                          </svg>
                          Request Changes
                        </>
                      )}
                      {action === 'reject' && (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject Submission
                        </>
                      )}
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewActions;
