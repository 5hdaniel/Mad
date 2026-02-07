'use server';

/**
 * External Contacts Server Actions
 *
 * Server actions for reading external contacts with search, filtering,
 * and pagination support.
 *
 * TASK-1912: Microsoft Graph Contacts API Integration
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface ExternalContact {
  id: string;
  organization_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  source: 'outlook' | 'gmail' | 'manual';
  external_record_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetExternalContactsOptions {
  source?: 'outlook' | 'gmail' | 'manual';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetExternalContactsResult {
  contacts: ExternalContact[];
  total: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default page size */
const DEFAULT_LIMIT = 50;

/** Maximum page size */
const MAX_LIMIT = 200;

// ============================================================================
// Main Action
// ============================================================================

/**
 * Get external contacts for the current user's organization.
 *
 * Supports filtering by source, searching by name/email/phone,
 * and pagination with limit/offset.
 *
 * @param options - Filter, search, and pagination options
 * @returns Contacts array and total count
 */
export async function getExternalContacts(
  options?: GetExternalContactsOptions
): Promise<GetExternalContactsResult> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { contacts: [], total: 0 };
  }

  // Get user's organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return { contacts: [], total: 0 };
  }

  const orgId = membership.organization_id;
  const limit = Math.min(options?.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = options?.offset || 0;

  // Build query
  let query = supabase
    .from('external_contacts')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId);

  // Apply source filter
  if (options?.source) {
    query = query.eq('source', options.source);
  }

  // Apply search filter (case-insensitive search across name, email, phone)
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(
      `name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`
    );
  }

  // Apply pagination and ordering
  query = query
    .order('name', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching external contacts:', error.message);
    return { contacts: [], total: 0 };
  }

  return {
    contacts: (data as ExternalContact[]) || [],
    total: count || 0,
  };
}
