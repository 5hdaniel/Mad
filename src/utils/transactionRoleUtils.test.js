import {
  filterRolesByTransactionType,
  getTransactionTypeContext,
  validateRoleAssignments,
} from './transactionRoleUtils';
import { SPECIFIC_ROLES } from '../constants/contactRoles';

describe('transactionRoleUtils', () => {
  describe('filterRolesByTransactionType', () => {
    it('should not filter professional services roles', () => {
      const roles = [
        { role: 'inspector', required: false, multiple: true },
        { role: 'appraiser', required: false, multiple: false },
        { role: 'title_company', required: false, multiple: false },
      ];

      const result = filterRolesByTransactionType(roles, 'purchase', 'Professional Services');

      expect(result).toEqual(roles);
      expect(result.length).toBe(3);
    });

    it('should filter roles for purchase transaction', () => {
      const roles = [
        { role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false },
        { role: SPECIFIC_ROLES.BUYER_AGENT, required: false, multiple: false },
        { role: SPECIFIC_ROLES.SELLER_AGENT, required: false, multiple: false },
        { role: SPECIFIC_ROLES.LISTING_AGENT, required: false, multiple: false },
      ];

      const result = filterRolesByTransactionType(roles, 'purchase', 'Client & Agents');

      expect(result.length).toBe(3);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.CLIENT);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.SELLER_AGENT);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.LISTING_AGENT);
      expect(result.map((r) => r.role)).not.toContain(SPECIFIC_ROLES.BUYER_AGENT);
    });

    it('should filter roles for sale transaction', () => {
      const roles = [
        { role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false },
        { role: SPECIFIC_ROLES.BUYER_AGENT, required: false, multiple: false },
        { role: SPECIFIC_ROLES.SELLER_AGENT, required: false, multiple: false },
        { role: SPECIFIC_ROLES.LISTING_AGENT, required: false, multiple: false },
      ];

      const result = filterRolesByTransactionType(roles, 'sale', 'Client & Agents');

      expect(result.length).toBe(2);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.CLIENT);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.BUYER_AGENT);
      expect(result.map((r) => r.role)).not.toContain(SPECIFIC_ROLES.SELLER_AGENT);
      expect(result.map((r) => r.role)).not.toContain(SPECIFIC_ROLES.LISTING_AGENT);
    });

    it('should always include client role', () => {
      const roles = [{ role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false }];

      const purchaseResult = filterRolesByTransactionType(roles, 'purchase', 'Client & Agents');
      const saleResult = filterRolesByTransactionType(roles, 'sale', 'Client & Agents');

      expect(purchaseResult.some((r) => r.role === SPECIFIC_ROLES.CLIENT)).toBe(true);
      expect(saleResult.some((r) => r.role === SPECIFIC_ROLES.CLIENT)).toBe(true);
    });

    it('should handle empty roles array', () => {
      const result = filterRolesByTransactionType([], 'purchase', 'Client & Agents');
      expect(result.length).toBe(0);
    });
  });

  describe('getTransactionTypeContext', () => {
    it('should return purchase context', () => {
      const result = getTransactionTypeContext('purchase');

      expect(result.title).toBe('Transaction Type: Purchase');
      expect(result.message).toContain('representing the buyer');
      expect(result.message).toContain("seller's agent");
    });

    it('should return sale context', () => {
      const result = getTransactionTypeContext('sale');

      expect(result.title).toBe('Transaction Type: Sale');
      expect(result.message).toContain('representing the seller');
      expect(result.message).toContain("buyer's agent");
    });
  });

  describe('validateRoleAssignments', () => {
    it('should pass when all required roles are assigned', () => {
      const contactAssignments = {
        client: [{ contactId: 'contact-1', isPrimary: true }],
        seller_agent: [{ contactId: 'contact-2', isPrimary: false }],
      };

      const roles = [
        { role: 'client', required: true, multiple: false },
        { role: 'seller_agent', required: false, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(true);
      expect(result.missingRoles.length).toBe(0);
    });

    it('should fail when required role is missing', () => {
      const contactAssignments = {
        seller_agent: [{ contactId: 'contact-2', isPrimary: false }],
      };

      const roles = [
        { role: 'client', required: true, multiple: false },
        { role: 'seller_agent', required: false, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(false);
      expect(result.missingRoles).toContain('client');
      expect(result.missingRoles.length).toBe(1);
    });

    it('should fail when assignment array is empty', () => {
      const contactAssignments = {
        client: [],
      };

      const roles = [{ role: 'client', required: true, multiple: false }];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(false);
      expect(result.missingRoles).toContain('client');
    });

    it('should pass when optional roles are missing', () => {
      const contactAssignments = {
        client: [{ contactId: 'contact-1', isPrimary: true }],
      };

      const roles = [
        { role: 'client', required: true, multiple: false },
        { role: 'inspector', required: false, multiple: true },
        { role: 'appraiser', required: false, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(true);
      expect(result.missingRoles.length).toBe(0);
    });
  });
});
