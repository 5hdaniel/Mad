/**
 * Authentication Service (Keepr Companion)
 *
 * Wraps Supabase auth operations for use in the companion app.
 * Supports Google OAuth, Microsoft/Azure OAuth, and email magic links.
 *
 * OAuth on React Native uses the `keepr-companion://` URL scheme
 * configured in app.json for redirect callbacks.
 */

import { createURL } from 'expo-linking';
import { supabase } from './supabaseClient';
import type { Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';

/** Redirect URI for OAuth callbacks using the app's URL scheme */
const REDIRECT_URI = createURL('auth/callback', { scheme: 'keepr-companion' });

/**
 * Sign in with Google via Supabase OAuth.
 * Opens the system browser for the Google sign-in flow.
 */
export async function signInWithGoogle(): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: false,
    },
  });

  if (error) {
    return { url: null, error: error.message };
  }

  return { url: data.url, error: null };
}

/**
 * Sign in with Microsoft/Azure via Supabase OAuth.
 * Opens the system browser for the Microsoft sign-in flow.
 */
export async function signInWithMicrosoft(): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: false,
      scopes: 'email profile openid',
    },
  });

  if (error) {
    return { url: null, error: error.message };
  }

  return { url: data.url, error: null };
}

/**
 * Sign in with email magic link.
 * Sends a magic link to the user's email address.
 */
export async function signInWithEmail(
  email: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: REDIRECT_URI,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Sign out the current user and clear the session.
 */
export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Get the current auth session (if any).
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribe to auth state changes.
 * Returns a subscription object that can be used to unsubscribe.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): Subscription {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}
