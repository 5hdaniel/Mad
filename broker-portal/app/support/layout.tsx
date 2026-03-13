import Link from 'next/link';

/**
 * Support Section Layout - Broker Portal
 *
 * Minimal layout for public-facing support pages (e.g., /support/new).
 * Authenticated users access tickets via /dashboard/support instead.
 */
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">Keepr.</span>
            <span className="text-sm text-gray-500">Support</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-gray-400 text-center">
            Keepr. Compliance &mdash; Product Support
          </p>
        </div>
      </footer>
    </div>
  );
}
