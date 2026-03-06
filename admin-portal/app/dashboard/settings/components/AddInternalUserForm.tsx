'use client';

/**
 * AddInternalUserForm - Form to add a new internal user
 *
 * Email input + role dropdown (from admin_roles table). Calls admin_add_internal_user RPC.
 */

import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AdminRole } from '../page';

interface AddInternalUserFormProps {
  onSuccess: () => void;
  roles: AdminRole[];
}

export function AddInternalUserForm({ onSuccess, roles }: AddInternalUserFormProps) {
  const defaultSlug = roles.find(r => r.slug === 'support-agent')?.slug || roles[0]?.slug || '';
  const [email, setEmail] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('admin_add_internal_user', {
        p_email: trimmedEmail,
        p_role: selectedSlug,
      });

      if (rpcError) {
        setError(rpcError.message || 'Failed to add user');
        return;
      }

      const result = data as { success: boolean; user_id: string; role: string } | null;
      if (result?.success) {
        const roleName = roles.find(r => r.slug === selectedSlug)?.name || selectedSlug;
        setSuccess(`Successfully added ${trimmedEmail} as ${roleName}`);
        setEmail('');
        setSelectedSlug(defaultSlug);
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Add Internal User</h2>
        <p className="text-sm text-gray-500">Grant admin portal access to an existing user by email</p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder="user@example.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="w-52">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              disabled={isSubmitting}
            >
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add User'}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-md bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
      </form>
    </div>
  );
}
