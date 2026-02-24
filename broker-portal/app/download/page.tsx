'use client';

/**
 * Download Page
 *
 * Landing page for agent-role users. Detects platform and offers
 * the correct installer download from GitHub releases.
 */

import { useEffect, useState } from 'react';

type Platform = 'mac-arm' | 'mac-intel' | 'windows' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) {
    // Apple Silicon detection via platform or GPU
    if (
      navigator.platform === 'MacIntel' &&
      typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints === 'number' &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 0
    ) {
      return 'mac-arm';
    }
    return 'mac-arm'; // Default to ARM for modern Macs
  }
  if (ua.includes('win')) return 'windows';
  return 'unknown';
}

const REPO = '5hdaniel/Mad';
const RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`;

const DOWNLOADS: Record<string, { label: string; file: string; icon: string }> = {
  'mac-arm': {
    label: 'Download for macOS (Apple Silicon)',
    file: 'MagicAudit-VERSION-arm64.dmg',
    icon: '🍎',
  },
  'mac-intel': {
    label: 'Download for macOS (Intel)',
    file: 'MagicAudit-VERSION.dmg',
    icon: '🍎',
  },
  windows: {
    label: 'Download for Windows',
    file: 'MagicAudit.Setup.VERSION.exe',
    icon: '🪟',
  },
};

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());

    // Fetch latest release version from GitHub API
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((res) => res.json())
      .then((data) => {
        if (data.tag_name) {
          setVersion(data.tag_name.replace(/^v/, ''));
        }
      })
      .catch(() => {
        // Fallback — user can still go to releases page
      });
  }, []);

  const getDownloadUrl = (key: string) => {
    if (!version) return RELEASE_PAGE;
    const file = DOWNLOADS[key].file.replace('VERSION', version);
    return `https://github.com/${REPO}/releases/download/v${version}/${file}`;
  };

  const primary = platform !== 'unknown' ? DOWNLOADS[platform] : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Keepr</h1>

        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Your account is ready
          </h2>
          <p className="text-gray-600">
            Download the Keepr desktop app to start submitting transactions for review.
          </p>

          {/* Primary download button */}
          {primary && (
            <a
              href={getDownloadUrl(platform)}
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <span>{primary.label}</span>
            </a>
          )}

          {/* Version info */}
          {version && (
            <p className="text-xs text-gray-400">Version {version}</p>
          )}

          {/* Other platforms */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <p className="text-sm text-gray-500">Other platforms</p>
            {Object.entries(DOWNLOADS)
              .filter(([key]) => key !== platform)
              .map(([key, info]) => (
                <a
                  key={key}
                  href={getDownloadUrl(key)}
                  className="block text-sm text-indigo-600 hover:text-indigo-500"
                >
                  {info.label}
                </a>
              ))}
          </div>

          {/* All releases link */}
          <a
            href={RELEASE_PAGE}
            className="block text-xs text-gray-400 hover:text-gray-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            View all releases on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
