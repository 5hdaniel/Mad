'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getConsentStatus, getRetentionPolicy, updateRetentionPolicy, getJitStatus, updateJitStatus } from '@/lib/actions/scim';
import { SignOutAllButton } from '@/components/SignOutAllButton';
import { ActiveSessionsList } from '@/components/ActiveSessionsList';

interface ConsentInfo {
  organizationId: string;
  tenantId: string | null;
  consentGranted: boolean;
  consentGrantedAt: string | null;
}

const RETENTION_OPTIONS = [
  { value: 1, label: '1 year' },
  { value: 2, label: '2 years' },
  { value: 3, label: '3 years' },
  { value: 5, label: '5 years' },
  { value: 7, label: '7 years' },
  { value: 10, label: '10 years' },
];

export default function SettingsPage() {
  const [consent, setConsent] = useState<ConsentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [retentionYears, setRetentionYears] = useState(7);
  const [savedRetention, setSavedRetention] = useState(7);
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [jitEnabled, setJitEnabled] = useState(true);
  const [savingJit, setSavingJit] = useState(false);

  const desktopClientId = process.env.NEXT_PUBLIC_DESKTOP_CLIENT_ID || '';

  useEffect(() => {
    async function load() {
      try {
        const [consentData, retentionData, jitData] = await Promise.all([
          getConsentStatus(),
          getRetentionPolicy(),
          getJitStatus(),
        ]);
        setConsent(consentData);
        setRetentionYears(retentionData.retentionYears);
        setSavedRetention(retentionData.retentionYears);
        setJitEnabled(jitData.enabled);
      } catch {
        // User may not be admin/it_admin
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleRetentionSave() {
    setSavingRetention(true);
    setRetentionSaved(false);
    try {
      await updateRetentionPolicy(retentionYears);
      setSavedRetention(retentionYears);
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 3000);
    } catch {
      // Error handling
    } finally {
      setSavingRetention(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization settings
        </p>
      </div>

      {/* Desktop App Permissions */}
      {consent && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Desktop App Permissions
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Grant org-wide permissions so team members can connect their Outlook in the desktop app
            </p>
          </div>
          <div className="px-4 py-4 sm:px-6">
            {consent.consentGranted ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Granted
                  </span>
                  <span className="text-sm text-gray-500">
                    Admin consent granted
                    {consent.consentGrantedAt && (
                      <> on {new Date(consent.consentGrantedAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}</>
                    )}
                  </span>
                </div>
                {consent.tenantId && desktopClientId && (
                  <button
                    onClick={() => {
                      const redirectUri = `${window.location.origin}/setup/consent/callback`;
                      const consentUrl = `https://login.microsoftonline.com/${consent.tenantId}/adminconsent?client_id=${desktopClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${consent.organizationId}`;
                      window.location.href = consentUrl;
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Re-grant
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Not granted
                  </span>
                  <span className="text-sm text-gray-500">
                    Team members will be prompted to request admin approval when connecting Outlook
                  </span>
                </div>
                {consent.tenantId && desktopClientId ? (
                  <button
                    onClick={() => {
                      const redirectUri = `${window.location.origin}/setup/consent/callback`;
                      const consentUrl = `https://login.microsoftonline.com/${consent.tenantId}/adminconsent?client_id=${desktopClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${consent.organizationId}`;
                      window.location.href = consentUrl;
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 23 23">
                      <path fill="#f35325" d="M1 1h10v10H1z" />
                      <path fill="#81bc06" d="M12 1h10v10H12z" />
                      <path fill="#05a6f0" d="M1 12h10v10H1z" />
                      <path fill="#ffba08" d="M12 12h10v10H12z" />
                    </svg>
                    Grant permissions with Microsoft
                  </button>
                ) : (
                  <p className="text-sm text-gray-400">
                    Microsoft tenant not configured. Please contact support.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Just-in-Time Provisioning */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Just-in-Time Provisioning
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Allow team members to join your organization automatically when they sign in with a matching Microsoft work account
          </p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">
                {jitEnabled
                  ? 'Anyone with a matching Microsoft tenant can sign in and join automatically'
                  : 'Users must be invited or provisioned via SCIM before they can sign in'}
              </p>
            </div>
            <button
              onClick={async () => {
                setSavingJit(true);
                try {
                  const newValue = !jitEnabled;
                  await updateJitStatus(newValue);
                  setJitEnabled(newValue);
                } catch {
                  // Error handling
                } finally {
                  setSavingJit(false);
                }
              }}
              disabled={savingJit}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                jitEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={jitEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  jitEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Email Retention Policy */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Email Retention Policy
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Set the retention period for all team members. This overrides individual settings in the desktop app.
          </p>
        </div>
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-end gap-4">
            <div>
              <label
                htmlFor="retention-years"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Retain emails for
              </label>
              <select
                id="retention-years"
                value={retentionYears}
                onChange={(e) => setRetentionYears(Number(e.target.value))}
                className="block w-48 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {RETENTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRetentionSave}
              disabled={savingRetention || retentionYears === savedRetention}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingRetention ? 'Saving...' : 'Save'}
            </button>
            {retentionSaved && (
              <span className="text-sm text-green-600">Saved</span>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Team members will see this setting locked in their desktop app and cannot change it.
          </p>
        </div>
      </div>

      {/* TASK-2062: Session Management */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Session Management
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            View active sessions and manage device access
          </p>
        </div>
        <div className="px-4 py-4 sm:px-6 space-y-4">
          {/* Active Sessions */}
          <ActiveSessionsList />

          {/* Sign Out All Devices */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700 mb-3">
              Sign out of all devices, including desktop apps and other browser sessions.
            </p>
            <SignOutAllButton />
          </div>
        </div>
      </div>

      {/* SCIM Provisioning Link */}
      <Link
        href="/dashboard/settings/scim"
        className="block bg-white shadow rounded-lg hover:shadow-md transition-shadow"
      >
        <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              SCIM Provisioning
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure SCIM to automatically sync users from your identity provider
            </p>
          </div>
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </Link>
    </div>
  );
}
