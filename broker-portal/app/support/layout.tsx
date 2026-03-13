import Link from 'next/link';

/**
 * Support Section Layout - Broker Portal
 *
 * Standalone layout for the /support/* pages with "Keepr. Support" branding.
 * Accessible without authentication.
 */
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/support" className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">Keepr. Support</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/support"
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              My Tickets
            </Link>
            <Link
              href="/support/new"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              New Ticket
            </Link>
          </nav>
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
