import { SPECIFIC_ROLES } from '../constants/contactRoles';

/**
 * Transaction Role Utilities
 * Helper functions for filtering and managing transaction contact roles
 */

/**
 * Get filtered roles based on transaction type
 *
 * Logic:
 * - For PURCHASE: User represents buyer, so show seller's agent
 * - For SALE: User represents seller, so show buyer's agent
 * - Always show client role
 * - Professional services roles are not filtered
 *
 * @param {Array} roles - Array of role configurations
 * @param {string} transactionType - 'purchase' or 'sale'
 * @param {string} stepTitle - Title of the workflow step
 * @returns {Array} Filtered array of role configurations
 */
export function filterRolesByTransactionType(roles, transactionType, stepTitle) {
  // Only filter roles for Client & Agents step
  if (stepTitle !== 'Client & Agents') {
    return roles; // Professional services - no filtering
  }

  return roles.filter((roleConfig) => {
    // Always show client
    if (roleConfig.role === SPECIFIC_ROLES.CLIENT) {
      return true;
    }

    // For purchase transactions: user is buyer's agent, so show seller's agent
    if (transactionType === 'purchase') {
      return (
        roleConfig.role === SPECIFIC_ROLES.SELLER_AGENT ||
        roleConfig.role === SPECIFIC_ROLES.LISTING_AGENT
      );
    }

    // For sale transactions: user is seller's agent/listing agent, so show buyer's agent
    if (transactionType === 'sale') {
      return roleConfig.role === SPECIFIC_ROLES.BUYER_AGENT;
    }

    return false;
  });
}

/**
 * Get context message for transaction type
 *
 * @param {string} transactionType - 'purchase' or 'sale'
 * @returns {Object} Object with title and message
 */
export function getTransactionTypeContext(transactionType) {
  if (transactionType === 'purchase') {
    return {
      title: 'Transaction Type: Purchase',
      message: "You're representing the buyer. Assign the seller's agent you're working with.",
    };
  }

  return {
    title: 'Transaction Type: Sale',
    message: "You're representing the seller. Assign the buyer's agent you're working with.",
  };
}

/**
 * Validate required role assignments
 *
 * @param {Object} contactAssignments - Object mapping roles to contact assignments
 * @param {Array} roles - Array of role configurations
 * @returns {Object} Validation result with { isValid, missingRoles }
 */
export function validateRoleAssignments(contactAssignments, roles) {
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
