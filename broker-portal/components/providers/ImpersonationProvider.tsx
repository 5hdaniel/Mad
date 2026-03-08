'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ImpersonationState {
  isImpersonating: boolean;
  sessionId: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  targetName: string | null;
  adminUserId: string | null;
  expiresAt: Date | null;
  remainingSeconds: number;
  endSession: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationState>({
  isImpersonating: false,
  sessionId: null,
  targetUserId: null,
  targetEmail: null,
  targetName: null,
  adminUserId: null,
  expiresAt: null,
  remainingSeconds: 0,
  endSession: async () => {},
});

/** Props are passed from the server component that reads the cookie */
interface ImpersonationProviderProps {
  children: ReactNode;
  session?: {
    session_id: string;
    target_user_id: string;
    target_email: string;
    target_name: string;
    admin_user_id: string;
    expires_at: string;
  } | null;
}

export function ImpersonationProvider({ children, session }: ImpersonationProviderProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    if (!session) return;

    const expiresAt = new Date(session.expires_at).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const endSession = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);

    try {
      await fetch('/api/impersonation/end', { method: 'POST' });
    } catch (e) {
      console.error('Failed to end impersonation session:', e);
      // Clear the impersonation cookie client-side so the user doesn't stay
      // in a broken impersonation state when the API call fails.
      document.cookie = 'impersonation_session=; Max-Age=0; path=/;';
    }

    // Redirect to admin portal
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || 'https://admin.keeprcompliance.com';
    window.location.href = `${adminUrl}/dashboard/users`;
  }, [isEnding]);

  const value: ImpersonationState = {
    isImpersonating: !!session,
    sessionId: session?.session_id || null,
    targetUserId: session?.target_user_id || null,
    targetEmail: session?.target_email || null,
    targetName: session?.target_name || null,
    adminUserId: session?.admin_user_id || null,
    expiresAt: session ? new Date(session.expires_at) : null,
    remainingSeconds,
    endSession,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export const useImpersonation = () => useContext(ImpersonationContext);
