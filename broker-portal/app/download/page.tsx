/**
 * Download Page
 *
 * Shown to agent users after accepting an invite.
 * Agents use the desktop app, not the broker portal.
 */

export default function DownloadPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Magic Audit</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-4">
          <div className="mx-auto h-12 w-12 text-green-500">
            <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Your account is ready
          </h2>
          <p className="text-gray-600">
            Download Magic Audit to get started. Sign in with the same account you used to accept your invitation.
          </p>
          <a
            href="https://magicaudit.com/download"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download Magic Audit
          </a>
        </div>
      </div>
    </div>
  );
}
