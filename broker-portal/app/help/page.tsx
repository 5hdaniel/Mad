'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

const articles = [
  {
    href: '/guides/sso-setup',
    title: 'Single Sign-On (SSO) Setup',
    description: 'Enable your team to sign in with their existing Microsoft or Google accounts.',
    tags: ['sso', 'microsoft', 'google', 'login', 'entra', 'azure', 'authentication'],
  },
  {
    href: '/guides/scim-provisioning',
    title: 'Automatic User Provisioning (SCIM)',
    description: 'Automatically create, update, and deactivate users when changes are made in Microsoft Entra ID.',
    tags: ['scim', 'provisioning', 'azure', 'entra', 'users', 'sync', 'automatic'],
  },
  {
    href: '/guides/admin-consent',
    title: 'Desktop App Permissions (Admin Consent)',
    description: 'Grant organization-wide permissions so team members can connect their email and contacts.',
    tags: ['permissions', 'consent', 'admin', 'desktop', 'email', 'contacts', 'graph'],
  },
  {
    href: '/setup',
    title: 'Set Up Your Organization',
    description: 'Register your organization with Keepr and link your Microsoft tenant.',
    tags: ['setup', 'organization', 'tenant', 'onboarding', 'getting started'],
  },
  {
    href: '/download',
    title: 'Download the Desktop App',
    description: 'Get the Keepr desktop app for macOS or Windows.',
    tags: ['download', 'install', 'desktop', 'mac', 'windows', 'app'],
  },
  {
    href: '/guides',
    title: 'IT Admin Guides Overview',
    description: 'Everything you need to set up Keepr for your organization.',
    tags: ['guides', 'admin', 'it', 'overview', 'setup'],
  },
  {
    href: '/guides/sso-setup',
    title: 'How to Configure SSO for Your Organization',
    description:
      'Walk through the /setup flow, the Microsoft consent prompt, and granting admin consent for the desktop app.',
    tags: ['sso', 'configure', 'setup', 'consent', 'microsoft', 'entra', 'how to'],
  },
  {
    href: '/guides/scim-provisioning',
    title: 'How to Configure SCIM for Your Organization',
    description:
      'End-to-end guide: generate a token in Settings, copy the endpoint URL, create an enterprise app in Azure, configure provisioning, and assign users.',
    tags: ['scim', 'configure', 'token', 'azure', 'enterprise app', 'provisioning', 'how to'],
  },
  {
    href: '/guides/scim-provisioning',
    title: 'How to Generate a SCIM Token',
    description:
      'Step-by-step instructions for creating a SCIM bearer token from Settings > SCIM and copying the endpoint URL.',
    tags: ['scim', 'token', 'bearer', 'settings', 'endpoint', 'generate', 'how to'],
  },
  {
    href: '/dashboard/users',
    title: 'Managing User Roles',
    description:
      'How to change user roles (agent, broker, admin, IT admin) from the Users page.',
    tags: ['roles', 'users', 'agent', 'broker', 'admin', 'it_admin', 'permissions'],
  },
  {
    href: '/guides/scim-provisioning',
    title: 'How SCIM User Provisioning Works',
    description:
      'What happens when Azure AD creates or deactivates users via SCIM, and how changes sync to Keepr.',
    tags: ['scim', 'provisioning', 'azure', 'sync', 'create', 'deactivate', 'users'],
  },
  {
    href: '/guides/sso-setup',
    title: 'Troubleshooting: "Organization Not Set Up" Error',
    description:
      'Why this error appears and what to do — your IT admin needs to visit /setup first, or you can sign up for an individual account.',
    tags: ['error', 'organization', 'not set up', 'troubleshooting', 'setup', 'individual'],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
    );
  }, [query]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900">How can we help?</h1>
          <p className="mt-3 text-lg text-gray-500">
            Search our guides and documentation
          </p>

          {/* Search */}
          <div className="mt-8 max-w-xl mx-auto">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for articles..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-base text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {query.trim() && (
          <p className="text-sm text-gray-500 mb-6">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'} for &quot;{query}&quot;
          </p>
        )}

        <div className="space-y-3">
          {filtered.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="block bg-white border border-gray-200 rounded-lg px-6 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600">
                {article.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{article.description}</p>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            <p className="mt-4 text-gray-500">No articles found for &quot;{query}&quot;</p>
            <p className="mt-1 text-sm text-gray-400">
              Try a different search term or{' '}
              <a href="mailto:support@keeprcompliance.com" className="text-blue-600 hover:underline">
                contact support
              </a>
            </p>
          </div>
        )}

        {/* Contact */}
        <div className="mt-12 text-center border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-500">
            Can&apos;t find what you&apos;re looking for?
          </p>
          <a
            href="mailto:support@keeprcompliance.com"
            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
