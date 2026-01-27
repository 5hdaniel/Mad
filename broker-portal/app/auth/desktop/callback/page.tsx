'use client';

/**
 * Desktop Auth Callback Page
 *
 * Receives OAuth callback from Supabase, extracts session tokens,
 * and redirects to desktop app via magicaudit:// deep link.
 */

import { useEffect, useState, useCallback, Suspense } from 'react';

type Status = 'loading' | 'redirecting' | 'success' | 'error';

function DesktopCallbackContent() {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [deepLinkUrl, setDeepLinkUrl] = useState<string>('');

  const handleCallback = useCallback(async () => {
    // Check for errors in hash fragment first (Supabase puts errors there)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get('error_description');
      const errorCode = params.get('error');
      if (errorCode || errorDesc) {
        setStatus('error');
        setErrorMessage(
          errorDesc
            ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
            : 'Authentication failed. Please try again.'
        );
        return;
      }
    }

    try {
      // Dynamic import to avoid SSR issues
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Get session from Supabase (handles hash fragment automatically)
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      if (!session) {
        setStatus('error');
        setErrorMessage('No session found. Please try signing in again.');
        return;
      }

      // Build deep link URL with tokens
      const callbackUrl = new URL('magicaudit://callback');
      callbackUrl.searchParams.set('access_token', session.access_token);
      callbackUrl.searchParams.set('refresh_token', session.refresh_token);

      const deepLink = callbackUrl.toString();
      setDeepLinkUrl(deepLink);
      setStatus('redirecting');

      // Attempt to redirect to desktop app
      window.location.href = deepLink;

      // After a delay, if we're still here, show success with manual link
      setTimeout(() => {
        setStatus('success');
      }, 2000);
    } catch {
      setStatus('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  }, []);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-lg shadow text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />
            <p className="text-gray-600">Signing you in...</p>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto" />
            <p className="text-gray-900 font-medium">Opening Magic Audit...</p>
            <p className="text-gray-500 text-sm">You should be redirected automatically.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-600">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">Sign in successful!</p>
            <p className="text-gray-500 text-sm">
              If Magic Audit didn&apos;t open automatically, click the button below.
            </p>
            <a
              href={deepLinkUrl}
              className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Open Magic Audit
            </a>
            <p className="text-gray-400 text-xs mt-4">
              You can close this browser tab after Magic Audit opens.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-600">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">Sign in failed</p>
            <p className="text-red-600 text-sm">{errorMessage}</p>
            <a
              href="/auth/desktop"
              className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Try Again
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function CallbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}

// Main page component with Suspense boundary
export default function DesktopCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <DesktopCallbackContent />
    </Suspense>
  );
}
