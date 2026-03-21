/**
 * SCIM 2.0 Group Handlers (Stub)
 *
 * Group CRUD operations are not yet implemented. This module is a placeholder
 * for future SCIM Group provisioning support.
 *
 * When implemented, this will handle:
 *   POST   /scim/v2/Groups       - Create group
 *   GET    /scim/v2/Groups       - List/filter groups
 *   GET    /scim/v2/Groups/:id   - Get single group
 *   PATCH  /scim/v2/Groups/:id   - Update group
 *   DELETE /scim/v2/Groups/:id   - Delete group
 */

import { CORS_HEADERS, SCIM_CONTENT_TYPE, SCIM_LIST_SCHEMA } from "../shared/types.ts";
import { scimError } from "../shared/errors.ts";

/** GET /scim/v2/Groups -- Returns empty list (groups not yet supported) */
export function handleListGroups(): Response {
  return new Response(
    JSON.stringify({
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: 0,
      startIndex: 1,
      itemsPerPage: 0,
      Resources: [],
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": SCIM_CONTENT_TYPE },
    },
  );
}

/** Fallback for any group operation -- returns 501 Not Implemented */
export function handleGroupNotImplemented(method: string): Response {
  return scimError(501, `Group ${method} is not yet implemented`);
}
