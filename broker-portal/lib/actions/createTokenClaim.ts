'use server';

/**
 * BACKLOG-1603: Create Token Claim server action.
 *
 * Stores OAuth tokens in the token_claims table via the create_token_claim() RPC.
 * Returns a claim_id (UUID) that the desktop app uses to retrieve the tokens
 * securely over HTTPS instead of embedding them in the deep link URL.
 *
 * SOC 2 Control: CC6.1 - Secure credential transmission
 *
 * Uses service role client because:
 * - create_token_claim() is a SECURITY DEFINER function granted to service_role
 * - The browser client (anon key) cannot call it
 * - This server action runs on the Next.js server, never exposed to the client
 */

import { createServiceClient } from '@/lib/supabase/service';

interface TokenClaimPayload {
  access_token: string;
  refresh_token: string;
  provider_token?: string | null;
  provider_refresh_token?: string | null;
}

interface CreateTokenClaimResult {
  success: boolean;
  claimId?: string;
  error?: string;
}

export async function createTokenClaim(
  userId: string,
  payload: TokenClaimPayload,
  provider: string
): Promise<CreateTokenClaimResult> {
  try {
    const supabase = createServiceClient();

    const { data: claimId, error } = await supabase.rpc('create_token_claim', {
      p_user_id: userId,
      p_payload: payload,
      p_provider: provider,
    });

    if (error) {
      console.error('[createTokenClaim] RPC error:', error.message);
      return { success: false, error: error.message };
    }

    if (!claimId) {
      console.error('[createTokenClaim] No claim_id returned');
      return { success: false, error: 'No claim ID returned' };
    }

    return { success: true, claimId: claimId as string };
  } catch (err) {
    console.error('[createTokenClaim] Unexpected error:', err);
    return { success: false, error: 'Failed to create token claim' };
  }
}
