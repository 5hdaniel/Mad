/**
 * Supabase Client for React Native (Keepr Companion)
 *
 * Initializes the Supabase client with AsyncStorage for session persistence.
 * Uses the same Supabase project as the desktop app.
 *
 * The anon key is a public/publishable key — safe to include in client code.
 * Row Level Security (RLS) on the Supabase side protects data access.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://nercleijfrxqcvfjskbc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcmNsZWlqZnJ4cWN2Zmpza2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyNDc5MTUsImV4cCI6MjA3ODgyMzkxNX0.3M2yiV4ITyny4hmgisJM-v1WfcDqaUUDEVav0DpzUvs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Important for React Native — prevents URL detection for OAuth
    detectSessionInUrl: false,
  },
});
