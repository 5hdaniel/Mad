'use client';

/**
 * Download Page
 *
 * Public landing page for downloading the Keepr desktop app.
 * Uses server-side /api/download route for reliable redirects.
 */

import { useEffect, useState } from 'react';

type Platform = 'mac-arm' | 'mac-intel' | 'windows' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) {
    if (
      navigator.platform === 'MacIntel' &&
      typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints === 'number' &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 0
    ) {
      return 'mac-arm';
    }
    return 'mac-arm';
  }
  if (ua.includes('win')) return 'windows';
  return 'unknown';
}

const DOWNLOADS: Record<string, string> = {
  'mac-arm': 'Download for macOS (Apple Silicon)',
  'mac-intel': 'Download for macOS (Intel)',
  'windows': 'Download for Windows',
};

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    // Auto-start download after a short delay
    if (detected !== 'unknown') {
      const timer = setTimeout(() => {
        setAutoStarted(true);
        window.location.href = `/api/download?platform=${detected}`;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const primaryLabel = platform !== 'unknown' ? DOWNLOADS[platform] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Keepr.</h1>

        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Download Keepr
          </h2>

          {autoStarted ? (
            <p className="text-gray-600">
              Your download should begin automatically.
              If it doesn&apos;t,{' '}
              <a
                href={`/api/download?platform=${platform}`}
                className="text-indigo-600 hover:text-indigo-500 underline"
              >
                click here
              </a>.
            </p>
          ) : (
            <p className="text-gray-600">
              Get the Keepr desktop app for real estate transaction auditing.
            </p>
          )}

          {/* Primary download button */}
          {primaryLabel && (
            <a
              href={`/api/download?platform=${platform}`}
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <span>{primaryLabel}</span>
            </a>
          )}

          {/* Other platforms */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <p className="text-sm text-gray-500">Other platforms</p>
            {Object.entries(DOWNLOADS)
              .filter(([key]) => key !== platform)
              .map(([key, label]) => (
                <a
                  key={key}
                  href={`/api/download?platform=${key}`}
                  className="block text-sm text-indigo-600 hover:text-indigo-500"
                >
                  {label}
                </a>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
