'use client';

/**
 * PendingInvitationsTable - Shows pending org-member invitations with resend/cancel actions.
 *
 * BACKLOG-1581: Add resend invite button for pending invitations
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, RotateCw, X } from 'lucide-react';
import { formatDate } from '@/lib/format';

export interface PendingInvitationRow {
  id: string;
  invited_email: string;
  role: string;
  invited_at: string | null;
  invitation_expires_at: string | null;
}

interface PendingInvitationsTableProps {
  invitations: PendingInvitationRow[];
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export function PendingInvitationsTable({ invitations }: PendingInvitationsTableProps) {
  const router = useRouter();
  const [resending, setResending] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = useCallback(async (invitationId: string) => {
    setResending(invitationId);
    setResendSuccess(null);
    setError(null);
    try {
      const res = await fetch('/api/users/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: invitationId, type: 'org' }),
      });
      if (res.ok) {
        setResendSuccess(invitationId);
        setTimeout(() => setResendSuccess(null), 3000);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to resend invitation');
      }
    } catch {
      setError('Failed to resend invitation');
    } finally {
      setResending(null);
    }
  }, [router]);

  const handleCancel = useCallback(async (invitationId: string) => {
    setCancelling(invitationId);
    setError(null);
    try {
      const res = await fetch('/api/users/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: invitationId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to cancel invitation');
      }
    } catch {
      setError('Failed to cancel invitation');
    } finally {
      setCancelling(null);
    }
  }, [router]);

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invited
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invitations.map((inv) => {
              const expired = isExpired(inv.invitation_expires_at);
              return (
                <tr key={inv.id} className="hover:bg-gray-50 bg-amber-50/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {inv.invited_email}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            expired
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {expired ? 'Expired' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(inv.invited_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {inv.invitation_expires_at
                      ? formatDate(inv.invitation_expires_at)
                      : '--'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => handleResend(inv.id)}
                        disabled={resending === inv.id}
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 font-medium transition-colors disabled:opacity-50"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${resending === inv.id ? 'animate-spin' : ''}`} />
                        {resendSuccess === inv.id
                          ? 'Sent!'
                          : resending === inv.id
                            ? 'Sending...'
                            : 'Resend'}
                      </button>
                      <button
                        onClick={() => handleCancel(inv.id)}
                        disabled={cancelling === inv.id}
                        className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 font-medium transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        {cancelling === inv.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
