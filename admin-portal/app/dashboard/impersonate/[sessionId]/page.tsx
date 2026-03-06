'use client';

/**
 * Impersonation View Page
 *
 * Shows a user's data as they would see it, with a persistent
 * "Support Session" banner. Data loaded via impersonation session token.
 * Auto-expires after 30 minutes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, X, Clock, User, Building2, CreditCard, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ImpersonatedData {
  user: {
    id: string;
    email: string | null;
    display_name: string | null;
    status: string | null;
    created_at: string;
    avatar_url: string | null;
  };
  organization: {
    name: string;
    slug: string;
    plan: string | null;
    role: string;
  } | null;
  licenses: Array<{
    id: string;
    license_type: string;
    status: string;
    starts_at: string | null;
    expires_at: string | null;
    transaction_limit: number | null;
    transactions_used: number | null;
  }>;
  session: {
    id: string;
    expires_at: string;
    created_at: string;
  };
}

export default function ImpersonatePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<ImpersonatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'admin_get_impersonated_user_data',
        { p_session_id: sessionId }
      );

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      setData(result as unknown as ImpersonatedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [supabase, sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expires = new Date(data.session.expires_at);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
        setError('Session expired');
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [data]);

  const handleEndSession = useCallback(async () => {
    await supabase.rpc('admin_end_impersonation', { p_session_id: sessionId });
    router.push('/dashboard/users');
  }, [supabase, sessionId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-gray-400">Loading impersonation session...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-red-800">Session Error</h2>
          <p className="mt-2 text-sm text-red-600">{error || 'Session not found'}</p>
          <button
            onClick={() => router.push('/dashboard/users')}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const user = data.user;
  const displayName = user.display_name || user.email || 'Unknown User';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Impersonation Banner */}
      <div className="sticky top-0 z-50 -mx-6 -mt-6 px-6 py-3 bg-purple-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5" />
            <span className="text-sm font-medium">
              Viewing as <span className="font-bold">{displayName}</span> — Support Session
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-purple-200 text-xs">
              <Clock className="h-3.5 w-3.5" />
              <span>{timeLeft} remaining</span>
            </div>
            <button
              onClick={handleEndSession}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-500 hover:bg-purple-400 px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={displayName} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xl font-semibold">
              {(displayName[0] || '?').toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
            {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {user.status || 'active'}
              </span>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">User ID</dt>
            <dd className="mt-1"><code className="text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">{user.id}</code></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">{new Date(user.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Organization */}
      {data.organization && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Organization</h3>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.organization.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Slug</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.organization.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Plan</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.organization.plan || 'None'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Role</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.organization.role}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Licenses */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Licenses</h3>
        </div>
        {data.licenses.length === 0 ? (
          <p className="text-sm text-gray-500">No licenses found.</p>
        ) : (
          <div className="space-y-3">
            {data.licenses.map((license) => (
              <div key={license.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 capitalize">{license.license_type}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      license.status === 'active' ? 'bg-green-100 text-green-700' :
                      license.status === 'suspended' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {license.status}
                    </span>
                  </div>
                  {license.transaction_limit && (
                    <span className="text-xs text-gray-500">
                      {license.transactions_used || 0} / {license.transaction_limit} transactions
                    </span>
                  )}
                </div>
                {license.expires_at && (
                  <p className="mt-2 text-xs text-gray-400">
                    Expires: {new Date(license.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session info */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-medium text-purple-700">
            This is a read-only support session. All actions are logged.
          </span>
        </div>
        <p className="mt-1 text-xs text-purple-500">
          Session started at {new Date(data.session.created_at).toLocaleString()} — expires at {new Date(data.session.expires_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
