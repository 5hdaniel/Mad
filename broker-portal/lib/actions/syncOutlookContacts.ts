'use server';

/**
 * Sync Outlook Contacts Server Action
 *
 * Fetches contacts from Microsoft Graph API and upserts them into the
 * external_contacts Supabase table with source='outlook'.
 *
 * Uses batched upserts (100 rows per batch) for large contact lists.
 * Does NOT delete stale contacts (unsafe if sync is partial).
 *
 * TASK-1912: Microsoft Graph Contacts API Integration
 */

import { createClient } from '@/lib/supabase/server';
import { getMicrosoftToken } from '@/lib/auth/provider-tokens';
import { fetchOutlookContacts } from '@/lib/microsoft/graph';
import { GraphApiError } from '@/lib/microsoft/types';
import type {
  GraphContact,
  SyncResult,
  ExternalContactRow,
} from '@/lib/microsoft/types';

// ============================================================================
// Constants
// ============================================================================

/** Number of rows to upsert per batch */
const UPSERT_BATCH_SIZE = 100;

// ============================================================================
// Mapping
// ============================================================================

/**
 * Map a Graph API contact to an external_contacts row.
 *
 * Takes the first email address, and the first available phone number
 * (mobile > business > home).
 */
function mapGraphContact(
  contact: GraphContact,
  orgId: string,
  userId: string
): ExternalContactRow {
  return {
    organization_id: orgId,
    user_id: userId,
    name: contact.displayName,
    email: contact.emailAddresses?.[0]?.address || null,
    phone:
      contact.mobilePhone ||
      contact.businessPhones?.[0] ||
      contact.homePhones?.[0] ||
      null,
    company: contact.companyName,
    job_title: contact.jobTitle,
    source: 'outlook' as const,
    external_record_id: contact.id,
    synced_at: new Date().toISOString(),
  };
}

// ============================================================================
// Main Action
// ============================================================================

/**
 * Sync contacts from Outlook via Microsoft Graph API.
 *
 * 1. Gets the current user + organization from session
 * 2. Gets Microsoft token via getMicrosoftToken(userId)
 * 3. Fetches contacts from Graph API (with 5000 safety limit)
 * 4. Maps Graph contacts to external_contacts rows
 * 5. Upserts into external_contacts in batches of 100
 * 6. Returns count of synced contacts
 *
 * @returns SyncResult with success status and contact count
 */
export async function syncOutlookContacts(): Promise<SyncResult> {
  const supabase = await createClient();

  // 1. Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, count: 0, error: 'not_connected', message: 'Not authenticated' };
  }

  // Get user's organization membership
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return { success: false, count: 0, error: 'unknown', message: 'No organization membership found' };
  }

  const orgId = membership.organization_id;

  // 2. Get Microsoft token (handles refresh automatically)
  let accessToken = await getMicrosoftToken(user.id);

  if (!accessToken) {
    return {
      success: false,
      count: 0,
      error: 'not_connected',
      message: 'No Microsoft account connected. Please sign in with Microsoft to import contacts.',
    };
  }

  // 3. Fetch contacts from Graph API
  let contacts;
  try {
    contacts = await fetchOutlookContacts(accessToken);
  } catch (err) {
    // Handle 401 by refreshing token and retrying once
    if (err instanceof GraphApiError && err.status === 401) {
      // Force a fresh token by clearing the cached one
      accessToken = await getMicrosoftToken(user.id);
      if (!accessToken) {
        return {
          success: false,
          count: 0,
          error: 'token_expired',
          message: 'Microsoft token expired and could not be refreshed. Please sign in again.',
        };
      }

      try {
        contacts = await fetchOutlookContacts(accessToken);
      } catch (retryErr) {
        if (retryErr instanceof GraphApiError) {
          return mapGraphError(retryErr);
        }
        return { success: false, count: 0, error: 'graph_api_error', message: 'Failed to fetch contacts after token refresh' };
      }
    } else if (err instanceof GraphApiError) {
      return mapGraphError(err);
    } else {
      return { success: false, count: 0, error: 'graph_api_error', message: 'Unexpected error fetching contacts' };
    }
  }

  if (!contacts || contacts.length === 0) {
    return { success: true, count: 0, message: 'No contacts found in Outlook' };
  }

  // 4. Map contacts to external_contacts rows
  const rows = contacts.map((c) => mapGraphContact(c, orgId, user.id));

  // 5. Upsert in batches of 100
  let totalUpserted = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);

    const { error: upsertError } = await supabase
      .from('external_contacts')
      .upsert(batch, {
        onConflict: 'organization_id,source,external_record_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Upsert batch failed at offset', i, ':', upsertError.message);
      // Continue with remaining batches -- partial sync is better than none
      continue;
    }

    totalUpserted += batch.length;
  }

  // 6. Return result
  return {
    success: true,
    count: totalUpserted,
    message: `Successfully synced ${totalUpserted} contacts from Outlook`,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a GraphApiError to a SyncResult.
 */
function mapGraphError(err: GraphApiError): SyncResult {
  if (err.status === 401) {
    return {
      success: false,
      count: 0,
      error: 'token_expired',
      message: 'Microsoft token expired. Please sign in again.',
    };
  }
  if (err.status === 403) {
    return {
      success: false,
      count: 0,
      error: 'permission_denied',
      message: 'Contacts.Read permission not granted. Please re-authorize with Microsoft.',
    };
  }
  return {
    success: false,
    count: 0,
    error: 'graph_api_error',
    message: `Microsoft Graph API returned status ${err.status}`,
  };
}
