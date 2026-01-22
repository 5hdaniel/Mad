/**
 * Logout Route Handler
 *
 * Signs out the user and redirects to login page
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const requestUrl = new URL(request.url);
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}

// Also support GET for simple link-based logout
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const requestUrl = new URL(request.url);
  return NextResponse.redirect(`${requestUrl.origin}/login`);
}
