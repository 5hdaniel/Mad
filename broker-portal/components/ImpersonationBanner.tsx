'use client';

import { useImpersonation } from '@/components/providers/ImpersonationProvider';

/** Shield icon (inline SVG to avoid lucide-react type mismatch with React 18/19) */
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

/** X icon (inline SVG) */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function ImpersonationBanner() {
  const { isImpersonating, targetEmail, remainingSeconds, endSession } = useImpersonation();

  if (!isImpersonating) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isExpired = remainingSeconds <= 0;

  return (
    <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <ShieldIcon className="h-4 w-4" />
        <span className="font-medium">Support Session</span>
        <span className="text-purple-200">|</span>
        <span>
          Viewing as <strong>{targetEmail}</strong>
        </span>
        <span className="text-purple-200">|</span>
        {isExpired ? (
          <span className="text-yellow-200 font-medium">Session Expired</span>
        ) : (
          <span className="tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} remaining
          </span>
        )}
      </div>
      <button
        onClick={endSession}
        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-700 hover:bg-purple-800 transition-colors text-xs font-medium"
      >
        <XIcon className="h-3 w-3" />
        End Session
      </button>
    </div>
  );
}
