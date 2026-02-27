/**
 * Admin Consent Callback Route
 *
 * Handles the redirect from Microsoft after an IT admin grants (or denies)
 * org-wide admin consent for the desktop app's Graph API permissions.
 *
 * Microsoft redirects here with:
 * - admin_consent=True (success)
 * - error + error_description (failure)
 * - state (org ID we passed in the original request)
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const adminConsent = searchParams.get('admin_consent');
  const state = searchParams.get('state'); // org ID
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    // eslint-disable-next-line no-control-regex
    const sanitize = (s: string | null) =>
      s ? s.replace(/[\r\n]/g, ' ').replace(/[\x00-\x1f\x7f]/g, '') : '';
    console.error('Admin consent denied:', sanitize(error), sanitize(errorDescription));
    return NextResponse.redirect(
      `${origin}/dashboard?consent_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (adminConsent === 'True' && state) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          graph_admin_consent_granted: true,
          graph_admin_consent_at: new Date().toISOString(),
        })
        .eq('id', state);

      if (updateError) {
        console.error('Failed to record admin consent:', updateError.message);
      }
    }

    return NextResponse.redirect(`${origin}/dashboard?consent_granted=true`);
  }

  // Fallback - no clear result, go to dashboard
  return NextResponse.redirect(`${origin}/dashboard`);
}
