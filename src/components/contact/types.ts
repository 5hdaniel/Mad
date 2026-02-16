/**
 * Contact component types
 * Re-exports from centralized types for backwards compatibility
 */

// Re-export types from centralized location
export type {
  ExtendedContact,
  TransactionWithRoles,
  ContactFormData,
  ContactEmailEntry,
  ContactPhoneEntry,
  SourceBadge,
} from "../../types/components";

// Re-export function
export { getSourceBadge } from "../../types/components";
