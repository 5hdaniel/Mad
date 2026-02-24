/**
 * Closed Beta / Waitlist Page
 *
 * Displayed for users who want to join the beta program,
 * or whose trial has expired or transaction limit reached.
 */

export default function BetaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Keepr</h1>
          <h2 className="mt-2 text-xl text-gray-600">Closed Beta Program</h2>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Beta Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Beta
            </span>
          </div>

          {/* Message */}
          <div className="text-center space-y-4">
            <p className="text-gray-700 text-lg">
              We&apos;re currently in a closed beta program.
            </p>
            <p className="text-gray-600">
              If you&apos;d like to join our waitlist, or if your trial license
              expired or you ran out of transactions, please email us at:
            </p>

            {/* Email Link */}
            <a
              href="mailto:support@keeprcompliance.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              support@keeprcompliance.com
            </a>

            {/* Copy hint */}
            <p className="text-sm text-gray-500">
              Click to open your email client, or copy the address above.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Thank you for your interest in Keepr.
        </p>
      </div>
    </div>
  );
}
