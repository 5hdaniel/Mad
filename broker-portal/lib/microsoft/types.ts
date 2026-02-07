/**
 * Microsoft Graph API Types
 *
 * TypeScript interfaces for Microsoft Graph API contact responses.
 *
 * TASK-1912: Microsoft Graph Contacts API Integration
 */

// ============================================================================
// Graph API Response Types
// ============================================================================

/**
 * A contact from Microsoft Graph API /me/contacts endpoint.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/contact
 */
export interface GraphContact {
  id: string;
  displayName: string | null;
  emailAddresses: Array<{ name: string; address: string }>;
  mobilePhone: string | null;
  homePhones: string[];
  businessPhones: string[];
  companyName: string | null;
  jobTitle: string | null;
}

/**
 * Paginated response from Microsoft Graph API.
 */
export interface GraphContactsResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: GraphContact[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error for Microsoft Graph API failures.
 * Includes the HTTP status code and response body for debugging.
 */
export class GraphApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Microsoft Graph API error: ${status}`);
    this.name = 'GraphApiError';
  }
}

// ============================================================================
// Sync Result Types
// ============================================================================

/**
 * Result of a contact sync operation.
 */
export interface SyncResult {
  success: boolean;
  count: number;
  error?: 'token_expired' | 'permission_denied' | 'not_connected' | 'graph_api_error' | 'unknown';
  message?: string;
}

/**
 * Row shape for upserting into the external_contacts table.
 */
export interface ExternalContactRow {
  organization_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  source: 'outlook';
  external_record_id: string;
  synced_at: string;
}
