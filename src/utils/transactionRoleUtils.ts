import { SPECIFIC_ROLES, ROLE_DISPLAY_NAMES } from "../constants/contactRoles";

/**
 * Format a role string as a human-readable label.
 *
 * First attempts to look up the role in ROLE_DISPLAY_NAMES.
 * If not found, formats the string by splitting on underscores
 * and title-casing each word.
 *
 * Examples:
 *   "seller_agent" -> "Seller Agent"
 *   "buyer_agent" -> "Buyer Agent"
 *   "inspector" -> "Inspector"
 *
 * @param role - The role string (e.g., "seller_agent", "buyer_agent")
 * @returns Human-readable label (e.g., "Seller Agent", "Buyer Agent")
 */
export function formatRoleLabel(role: string): string {
  // First check if we have a known display name
  if (role in ROLE_DISPLAY_NAMES) {
    return ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES];
  }

  // Fallback: format the role string by splitting on underscores and title-casing
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Transaction Role Utilities
 * Helper functions for filtering and managing transaction contact roles
 */

/**
 * Role configuration structure from workflow steps
 */
export interface RoleConfig {
  role: string;
  required: boolean;
  multiple: boolean;
}

/**
 * Transaction type - represents which side of the deal the user represents
 */
export type TransactionType = "purchase" | "sale" | "other";

/**
 * Contact assignments mapping roles to assigned contacts
 */
export interface ContactAssignments {
  [role: string]: string[] | undefined;
}

/**
 * Context message for transaction type
 */
export interface TransactionTypeContext {
  title: string;
  message: string;
}

/**
 * Validation result for role assignments
 */
export interface RoleValidationResult {
  isValid: boolean;
  missingRoles: string[];
}

/**
 * Get filtered roles based on transaction type
 *
 * Logic:
 * - For PURCHASE: User represents buyer, so show seller's agent
 * - For SALE: User represents seller, so show buyer's agent
 * - Always show client role
 * - Professional services roles are not filtered
 *
 * @param roles - Array of role configurations
 * @param transactionType - 'purchase' or 'sale'
 * @param stepTitle - Title of the workflow step
 * @returns Filtered array of role configurations
 */
export function filterRolesByTransactionType(
  roles: RoleConfig[],
  transactionType: TransactionType,
  stepTitle: string,
): RoleConfig[] {
  // Only filter roles for Client & Agents step
  if (stepTitle !== "Client & Agents") {
    return roles; // Professional services - no filtering
  }

  return roles.filter((roleConfig) => {
    // Always show client
    if (roleConfig.role === SPECIFIC_ROLES.CLIENT) {
      return true;
    }

    // For purchase transactions: user is buyer's agent, so show seller's agent
    if (transactionType === "purchase") {
      return (
        roleConfig.role === SPECIFIC_ROLES.SELLER_AGENT ||
        roleConfig.role === SPECIFIC_ROLES.LISTING_AGENT
      );
    }

    // For sale transactions: user is seller's agent/listing agent, so show buyer's agent
    if (transactionType === "sale") {
      return roleConfig.role === SPECIFIC_ROLES.BUYER_AGENT;
    }

    return false;
  });
}

/**
 * Get context message for transaction type
 *
 * @param transactionType - 'purchase' or 'sale'
 * @returns Object with title and message
 */
export function getTransactionTypeContext(
  transactionType: TransactionType,
): TransactionTypeContext {
  if (transactionType === "purchase") {
    return {
      title: "Transaction Type: Purchase",
      message:
        "You're representing the buyer. Assign the seller's agent you're working with.",
    };
  }

  return {
    title: "Transaction Type: Sale",
    message:
      "You're representing the seller. Assign the buyer's agent you're working with.",
  };
}

/**
 * Validate required role assignments
 *
 * @param contactAssignments - Object mapping roles to contact assignments
 * @param roles - Array of role configurations
 * @returns Validation result with { isValid, missingRoles }
 */
export function validateRoleAssignments(
  contactAssignments: ContactAssignments,
  roles: RoleConfig[],
): RoleValidationResult {
  const missingRoles = roles
    .filter((roleConfig) => roleConfig.required)
    .filter((roleConfig) => {
      const assignments = contactAssignments[roleConfig.role];
      return !assignments || assignments.length === 0;
    })
    .map((roleConfig) => roleConfig.role);

  return {
    isValid: missingRoles.length === 0,
    missingRoles,
  };
}

/**
 * Get role display name based on transaction type
 *
 * For CLIENT role:
 * - Purchase: "Client (Buyer)" - agent represents the buyer
 * - Sale: "Client (Seller)" - agent represents the seller
 *
 * @param role - The specific role constant
 * @param transactionType - 'purchase' or 'sale'
 * @returns Display name for the role
 */
export function getRoleDisplayName(
  role: string,
  transactionType: TransactionType,
): string {
  // Special handling for CLIENT role - changes based on transaction type
  if (role === SPECIFIC_ROLES.CLIENT) {
    if (transactionType === "purchase") {
      return "Client (Buyer)";
    } else if (transactionType === "sale") {
      return "Client (Seller)";
    }
  }

  // For all other roles, use the standard display name
  return ROLE_DISPLAY_NAMES[role] || role;
}
