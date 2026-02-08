'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  generateScimToken,
  revokeScimToken,
  listScimTokens,
  listScimSyncLogs,
} from '@/lib/actions/scim';

interface ScimToken {
  id: string;
  description: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  request_count: number;
}

interface SyncLogEntry {
  id: string;
  operation: string;
  scim_resource_type: string;
  external_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function ScimSettingsPage() {
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Token generation state
  const [description, setDescription] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const scimEndpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scim/v2/Users`;

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [tokenData, logData] = await Promise.all([
        listScimTokens(),
        listScimSyncLogs(),
      ]);
      setTokens(tokenData);
      setSyncLogs(logData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load SCIM data'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateScimToken(description || 'SCIM Token');
      setGeneratedToken(result.token);
      setDescription('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate token'
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    if (revoking) return;
    setRevoking(tokenId);
    setError(null);
    try {
      await revokeScimToken(tokenId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token');
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            SCIM Provisioning
          </h1>
          <p className="mt-1 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SCIM Provisioning</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure SCIM to automatically sync users from your identity provider
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* SCIM Endpoint URL */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            SCIM Endpoint URL
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Use this URL in your identity provider&apos;s SCIM configuration
          </p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 px-3 py-2 rounded-md text-sm font-mono text-gray-800 border border-gray-200 truncate">
              {scimEndpoint}
            </code>
            <button
              onClick={() => handleCopy(scimEndpoint)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Generate Token */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Generate Bearer Token
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create a token for your identity provider to authenticate SCIM
            requests
          </p>
        </div>
        <div className="px-4 py-4 sm:px-6 space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="token-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <input
                id="token-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Okta SCIM Integration"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate Token'}
            </button>
          </div>

          {/* Show generated token once */}
          {generatedToken && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Copy this token now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded-md text-sm font-mono text-gray-800 border border-yellow-300 break-all">
                  {generatedToken}
                </code>
                <button
                  onClick={() => handleCopy(generatedToken)}
                  className="px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 flex-shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Token List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Active Tokens</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your SCIM bearer tokens
          </p>
        </div>
        {tokens.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            No tokens created yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokens.map((token) => {
                  const isRevoked = !!token.revoked_at;
                  return (
                    <tr key={token.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {token.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(token.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {token.last_used_at
                          ? formatDate(token.last_used_at)
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {token.request_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isRevoked
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {isRevoked ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {!isRevoked && (
                          <button
                            onClick={() => handleRevoke(token.id)}
                            disabled={revoking === token.id}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {revoking === token.id
                              ? 'Revoking...'
                              : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Logs */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Sync Activity Log
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Recent SCIM provisioning operations
          </p>
        </div>
        {syncLogs.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            No sync activity yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    External ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.operation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.scim_resource_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {log.external_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : log.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                      {log.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
