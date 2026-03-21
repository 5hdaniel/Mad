/**
 * SCIM 2.0 Error Response Helpers
 *
 * Builds standardized SCIM error responses per RFC 7644 Section 3.12.
 */

import { CORS_HEADERS, SCIM_CONTENT_TYPE, SCIM_ERROR_SCHEMA } from "./types.ts";

/** Build a SCIM error response (RFC 7644 Section 3.12). */
export function scimError(
  status: number,
  detail: string,
  scimType?: string,
): Response {
  return new Response(
    JSON.stringify({
      schemas: [SCIM_ERROR_SCHEMA],
      detail,
      scimType: scimType || "invalidValue",
      status,
    }),
    {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
    },
  );
}
