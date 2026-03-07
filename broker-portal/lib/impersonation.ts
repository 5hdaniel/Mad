import { cookies } from 'next/headers';

export interface ImpersonationSession {
  session_id: string;
  target_user_id: string;
  admin_user_id: string;
  target_email: string;
  target_name: string;
  expires_at: string;
  started_at: string;
}

export const IMPERSONATION_COOKIE_NAME = 'impersonation_session';

/**
 * Read impersonation session from cookie (server-side only).
 * Returns null if no active impersonation or if session is expired.
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const session: ImpersonationSession = JSON.parse(raw);

    // Check expiry
    if (new Date(session.expires_at) <= new Date()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
