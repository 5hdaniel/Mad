'use client';

/**
 * ReviewActions Component
 *
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

      const { error: updateError } = await supabase
        .from('transaction_submissions')
        .update({
          status: statusMap[action],
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        })
        .eq('id', submission.id);

      if (updateError) throw updateError;

      // Add a comment for the record if notes provided
      if (notes && user) {
        await supabase.from('submission_comments').insert({
          submission_id: submission.id,
          author_id: user.id,
          content: notes,
          comment_type:
            action === 'approve' ? 'approval' : action === 'reject' ? 'rejection' : 'feedback',
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

  // Terminal states - review is complete
  if (disabled || submission.status === 'approved' || submission.status === 'rejected') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Review Complete</h3>
        <p className="text-sm text-gray-500">
          This submission has been{' '}
          <span
            className={
              submission.status === 'approved'
                ? 'text-green-600 font-medium'
                : 'text-red-600 font-medium'
            }
          >
            {submission.status}
          </span>
          .
        </p>
      </div>
    );
  }

  // Rejection confirmation dialog
  if (showConfirm) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
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
            onClick={() => setShowConfirm(false)}
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
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Review Actions</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 mb-4">
        <ActionButton
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
          label="Approve"
          description="Transaction audit passes compliance"
          selected={action === 'approve'}
          onClick={() => setAction('approve')}
          color="green"
        />
        <ActionButton
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
          label="Request Changes"
          description="Agent needs to fix issues and resubmit"
          selected={action === 'changes'}
          onClick={() => setAction('changes')}
          color="orange"
        />
        <ActionButton
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
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
              {action === 'approve'
                ? 'Approval Notes (optional)'
                : action === 'changes'
                  ? 'What changes are needed?'
                  : 'Rejection Reason'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder={
                action === 'approve'
                  ? 'Add any notes for the record...'
                  : action === 'changes'
                    ? 'Describe what needs to be fixed...'
                    : 'Explain why this submission is being rejected...'
              }
            />
            {action !== 'approve' && notes.length > 0 && notes.length < 10 && (
              <p className="mt-1 text-xs text-orange-600">
                Please provide at least 10 characters of feedback.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmitReview}
              disabled={loading || (action !== 'approve' && notes.trim().length < 10)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : action === 'changes'
                    ? 'bg-orange-600 hover:bg-orange-700'
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
                  {action === 'approve' && 'Approve Submission'}
                  {action === 'changes' && 'Request Changes'}
                  {action === 'reject' && 'Reject Submission'}
                </>
              )}
            </button>
            <button
              onClick={() => {
                setAction(null);
                setNotes('');
                setError(null);
              }}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  color: 'green' | 'orange' | 'red';
}

function ActionButton({ icon, label, description, selected, onClick, color }: ActionButtonProps) {
  const colorClasses = {
    green: {
      selected: 'border-green-500 bg-green-50',
      icon: 'text-green-600',
    },
    orange: {
      selected: 'border-orange-500 bg-orange-50',
      icon: 'text-orange-600',
    },
    red: {
      selected: 'border-red-500 bg-red-50',
      icon: 'text-red-600',
    },
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
        selected ? colorClasses[color].selected : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={colorClasses[color].icon}>{icon}</div>
        <div>
          <div className="font-medium text-gray-900">{label}</div>
          <div className="text-xs text-gray-500">{description}</div>
        </div>
      </div>
    </button>
  );
}

export default ReviewActions;
