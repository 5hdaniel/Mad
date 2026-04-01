/**
 * Microsoft Graph API client with client credentials (app-only) auth.
 *
 * Duplicated from broker-portal/lib/email/graph-client.ts because the
 * admin-portal is a separate Next.js app and cannot import from broker-portal.
 *
 * Uses ClientSecretCredential from @azure/identity for server-side
 * authentication without user interaction. Requires:
 * - AZURE_TENANT_ID
 * - AZURE_CLIENT_ID
 * - AZURE_CLIENT_SECRET
 *
 * The Azure app registration must have Mail.Send application permission
 * with admin consent.
 *
 * BACKLOG-1492: Admin invite users
 */

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import {
  TokenCredentialAuthenticationProvider,
} from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

let graphClient: Client | null = null;

/**
 * Returns a configured Microsoft Graph API client using client credentials,
 * or null if Azure credentials are not configured.
 *
 * The client is lazily initialised and cached for the lifetime of the process.
 */
export function getGraphClient(): Client | null {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn(
      '[Email] Azure credentials not configured -- emails will not be sent',
    );
    return null;
  }

  if (!graphClient) {
    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret,
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    graphClient = Client.initWithMiddleware({ authProvider });
  }

  return graphClient;
}
