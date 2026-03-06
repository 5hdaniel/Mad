'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, MoreVertical, ExternalLink, Ban, CheckCircle } from 'lucide-react';
import { suspendUser, unsuspendUser } from '@/lib/admin-queries';

export interface MemberRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  license_status: string | null;
  joined_at: string | null;
  status: string | null;
}

interface MembersTableProps {
  members: MemberRow[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800';
    case 'admin':
      return 'bg-primary-100 text-primary-800';
    case 'member':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function LicenseStatusBadge({ status }: { status: string | null }) {
  const statusText = status || 'none';
  const colorMap: Record<string, string> = {
    active: 'bg-success-50 text-success-600',
    assigned: 'bg-blue-100 text-blue-800',
    expired: 'bg-danger-50 text-danger-600',
    revoked: 'bg-danger-50 text-danger-600',
    pending: 'bg-yellow-100 text-yellow-800',
    none: 'bg-gray-100 text-gray-600',
  };
  const color = colorMap[statusText.toLowerCase()] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {statusText}
    </span>
  );
}

function UserStatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'active') return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-50 text-danger-600 ml-1.5">
      {status}
    </span>
  );
}

function UserInitials({ name }: { name: string | null }) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
      {initials}
    </div>
  );
}

// Per-row action menu
function RowActionMenu({
  member,
  onSuspendToggle,
  loading,
}: {
  member: MemberRow;
  onSuspendToggle: (userId: string, isSuspended: boolean) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const isSuspended = member.status === 'suspended';

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 }); // 192 = w-48
    }
    setOpen(!open);
  }, [open]);

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="p-1 rounded hover:bg-gray-100 transition-colors"
        aria-label="Actions"
      >
        <MoreVertical className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-48 rounded-md bg-white shadow-lg border border-gray-200 py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                router.push(`/dashboard/users/${member.user_id}`);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View User Detail
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSuspendToggle(member.user_id, isSuspended);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 disabled:opacity-50 ${
                isSuspended
                  ? 'text-success-600 hover:bg-success-50'
                  : 'text-danger-600 hover:bg-danger-50'
              }`}
            >
              {isSuspended ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Unsuspend User
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  Suspend User
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function MembersTable({ members }: MembersTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const confirmRef = useRef<HTMLDialogElement>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'unsuspend';
    userIds: string[];
    label: string;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');

  const allSelected = members.length > 0 && selected.size === members.length;
  const someSelected = selected.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.user_id)));
    }
  }, [allSelected, members]);

  const toggleOne = useCallback((userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  // Open confirmation dialog
  const openConfirm = useCallback(
    (type: 'suspend' | 'unsuspend', userIds: string[]) => {
      const names = userIds
        .map((id) => {
          const m = members.find((m) => m.user_id === id);
          return m?.display_name || m?.email || 'Unknown';
        })
        .slice(0, 3);
      const label =
        userIds.length <= 3
          ? names.join(', ')
          : `${names.join(', ')} and ${userIds.length - 3} more`;

      setConfirmAction({ type, userIds, label });
      setConfirmReason('');
      setMessage(null);
      confirmRef.current?.showModal();
    },
    [members]
  );

  // Execute confirmed action
  const executeAction = useCallback(async () => {
    if (!confirmAction) return;
    setLoading(true);
    setMessage(null);

    const { type, userIds } = confirmAction;
    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      const result =
        type === 'suspend'
          ? await suspendUser(userId, confirmReason || undefined)
          : await unsuspendUser(userId);

      if (result.error) errorCount++;
      else successCount++;
    }

    confirmRef.current?.close();
    setConfirmAction(null);
    setLoading(false);
    setSelected(new Set());

    if (errorCount === 0) {
      setMessage({
        type: 'success',
        text: `${type === 'suspend' ? 'Suspended' : 'Unsuspended'} ${successCount} user${successCount !== 1 ? 's' : ''} successfully.`,
      });
    } else {
      setMessage({
        type: 'error',
        text: `${successCount} succeeded, ${errorCount} failed.`,
      });
    }

    router.refresh();
  }, [confirmAction, confirmReason, router]);

  // Individual row action handler
  const handleSuspendToggle = useCallback(
    (userId: string, isSuspended: boolean) => {
      openConfirm(isSuspended ? 'unsuspend' : 'suspend', [userId]);
    },
    [openConfirm]
  );

  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">
          No members found for this organization.
        </p>
      </div>
    );
  }

  // Selected members info for bulk actions
  const selectedSuspended = members.filter(
    (m) => selected.has(m.user_id) && m.status === 'suspended'
  );
  const selectedActive = members.filter(
    (m) => selected.has(m.user_id) && m.status !== 'suspended'
  );

  return (
    <>
      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary-50 border border-primary-200 px-4 py-2.5">
          <span className="text-sm font-medium text-primary-800">
            {selected.size} selected
          </span>
          <div className="h-4 w-px bg-primary-200" />
          {selectedActive.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                openConfirm(
                  'suspend',
                  selectedActive.map((m) => m.user_id)
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-danger-600 bg-white border border-danger-200 hover:bg-danger-50 transition-colors disabled:opacity-50"
            >
              <Ban className="h-3 w-3" />
              Suspend ({selectedActive.length})
            </button>
          )}
          {selectedSuspended.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                openConfirm(
                  'unsuspend',
                  selectedSuspended.map((m) => m.user_id)
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-success-600 bg-white border border-success-500 hover:bg-success-50 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3 w-3" />
              Unsuspend ({selectedSuspended.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-primary-600 hover:text-primary-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div
          className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${
            message.type === 'success'
              ? 'bg-success-50 text-success-600'
              : 'bg-danger-50 text-danger-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  aria-label="Select all members"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                License
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="w-10 px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr
                key={member.user_id}
                onClick={() => router.push(`/dashboard/users/${member.user_id}`)}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                  selected.has(member.user_id) ? 'bg-primary-50/50' : ''
                }`}
              >
                <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(member.user_id)}
                    onChange={() => toggleOne(member.user_id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    aria-label={`Select ${member.display_name || member.email}`}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <UserInitials name={member.display_name} />
                    <span className="text-sm font-medium text-gray-900">
                      {member.display_name || 'Unnamed User'}
                    </span>
                    <UserStatusBadge status={member.status} />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.email || '--'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}
                  >
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <LicenseStatusBadge status={member.license_status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(member.joined_at)}
                </td>
                <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                  <RowActionMenu
                    member={member}
                    onSuspendToggle={handleSuspendToggle}
                    loading={loading}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation dialog */}
      <dialog
        ref={confirmRef}
        className="rounded-lg shadow-xl border border-gray-200 p-0 backdrop:bg-black/50 max-w-md w-full"
      >
        {confirmAction && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {confirmAction.type === 'suspend' ? 'Suspend' : 'Unsuspend'}{' '}
              {confirmAction.userIds.length === 1 ? 'User' : `${confirmAction.userIds.length} Users`}
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              {confirmAction.type === 'suspend' ? (
                <>
                  Are you sure you want to suspend{' '}
                  <span className="font-medium text-gray-900">{confirmAction.label}</span>?
                  They will lose access immediately.
                </>
              ) : (
                <>
                  Are you sure you want to unsuspend{' '}
                  <span className="font-medium text-gray-900">{confirmAction.label}</span>?
                  Their access will be restored.
                </>
              )}
            </p>

            {confirmAction.type === 'suspend' && (
              <div className="mt-4">
                <label htmlFor="bulk-reason" className="block text-sm font-medium text-gray-700">
                  Reason (optional)
                </label>
                <textarea
                  id="bulk-reason"
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="e.g. Terms of service violation"
                  disabled={loading}
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => confirmRef.current?.close()}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAction}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 ${
                  confirmAction.type === 'suspend'
                    ? 'bg-danger-600 hover:bg-danger-500'
                    : 'bg-success-600 hover:bg-success-500'
                }`}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Confirm ${confirmAction.type === 'suspend' ? 'Suspend' : 'Unsuspend'}`
                )}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
