/**
 * Microsoft Graph API Client
 *
 * Fetches contacts from Microsoft Graph API /me/contacts endpoint.
 * Handles pagination automatically with a safety limit of 5000 contacts.
 *
 * TASK-1912: Microsoft Graph Contacts API Integration
 */

import {
  type GraphContact,
  type GraphContactsResponse,
  GraphApiError,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Maximum contacts to fetch in a single sync (safety limit) */
const MAX_CONTACTS = 5000;

/** Number of contacts to request per page ($top parameter) */
const PAGE_SIZE = 100;

/** Fields to select from Graph API (minimize payload) */
const SELECT_FIELDS = [
  'id',
  'displayName',
  'emailAddresses',
  'mobilePhone',
  'homePhones',
  'businessPhones',
  'companyName',
  'jobTitle',
].join(',');

/** Base URL for the Graph API contacts endpoint */
const CONTACTS_URL = `https://graph.microsoft.com/v1.0/me/contacts?$top=${PAGE_SIZE}&$select=${SELECT_FIELDS}`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Fetch contacts from Microsoft Graph API.
 *
 * Handles pagination automatically via @odata.nextLink.
 * Stops at 5000 contacts as a safety limit to prevent runaway fetching.
 *
 * @param accessToken - A valid Microsoft access token with Contacts.Read scope
 * @returns Array of Graph contact objects
 * @throws GraphApiError if the API returns a non-200 response
 */
export async function fetchOutlookContacts(
  accessToken: string
): Promise<GraphContact[]> {
  const contacts: GraphContact[] = [];
  let url: string | null = CONTACTS_URL;

  // SR REVIEW [MEDIUM]: Safety limit in pagination loop to prevent runaway fetching
  while (url && contacts.length < MAX_CONTACTS) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new GraphApiError(response.status, await response.text());
    }

    const data: GraphContactsResponse = await response.json();
    contacts.push(...data.value);
    url = data['@odata.nextLink'] || null;
  }

  return contacts;
}
