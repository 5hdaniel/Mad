import {
  filterRolesByTransactionType,
  getTransactionTypeContext,
  validateRoleAssignments,
  getRoleDisplayName,
  type RoleConfig,
  type ContactAssignments,
} from "./transactionRoleUtils";
import { SPECIFIC_ROLES } from "../constants/contactRoles";

describe("transactionRoleUtils", () => {
  describe("filterRolesByTransactionType", () => {
    it("should not filter professional services roles", () => {
      const roles: RoleConfig[] = [
        { role: "inspector", required: false, multiple: true },
        { role: "appraiser", required: false, multiple: false },
        { role: "title_company", required: false, multiple: false },
      ];

      const result = filterRolesByTransactionType(
        roles,
        "purchase",
        "Professional Services",
      );

      expect(result).toEqual(roles);
      expect(result.length).toBe(3);
    });

    it("should filter roles for purchase transaction", () => {
      const roles: RoleConfig[] = [
        { role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false },
        { role: SPECIFIC_ROLES.BUYER_AGENT, required: false, multiple: false },
        { role: SPECIFIC_ROLES.SELLER_AGENT, required: false, multiple: false },
        {
          role: SPECIFIC_ROLES.LISTING_AGENT,
          required: false,
          multiple: false,
        },
      ];

      const result = filterRolesByTransactionType(
        roles,
        "purchase",
        "Client & Agents",
      );

      expect(result.length).toBe(3);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.CLIENT);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.SELLER_AGENT);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.LISTING_AGENT);
      expect(result.map((r) => r.role)).not.toContain(
        SPECIFIC_ROLES.BUYER_AGENT,
      );
    });

    it("should filter roles for sale transaction", () => {
      const roles: RoleConfig[] = [
        { role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false },
        { role: SPECIFIC_ROLES.BUYER_AGENT, required: false, multiple: false },
        { role: SPECIFIC_ROLES.SELLER_AGENT, required: false, multiple: false },
        {
          role: SPECIFIC_ROLES.LISTING_AGENT,
          required: false,
          multiple: false,
        },
      ];

      const result = filterRolesByTransactionType(
        roles,
        "sale",
        "Client & Agents",
      );

      expect(result.length).toBe(2);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.CLIENT);
      expect(result.map((r) => r.role)).toContain(SPECIFIC_ROLES.BUYER_AGENT);
      expect(result.map((r) => r.role)).not.toContain(
        SPECIFIC_ROLES.SELLER_AGENT,
      );
      expect(result.map((r) => r.role)).not.toContain(
        SPECIFIC_ROLES.LISTING_AGENT,
      );
    });

    it("should always include client role", () => {
      const roles: RoleConfig[] = [
        { role: SPECIFIC_ROLES.CLIENT, required: true, multiple: false },
      ];

      const purchaseResult = filterRolesByTransactionType(
        roles,
        "purchase",
        "Client & Agents",
      );
      const saleResult = filterRolesByTransactionType(
        roles,
        "sale",
        "Client & Agents",
      );

      expect(purchaseResult.some((r) => r.role === SPECIFIC_ROLES.CLIENT)).toBe(
        true,
      );
      expect(saleResult.some((r) => r.role === SPECIFIC_ROLES.CLIENT)).toBe(
        true,
      );
    });

    it("should handle empty roles array", () => {
      const result = filterRolesByTransactionType(
        [],
        "purchase",
        "Client & Agents",
      );
      expect(result.length).toBe(0);
    });
  });

  describe("getTransactionTypeContext", () => {
    it("should return purchase context", () => {
      const result = getTransactionTypeContext("purchase");

      expect(result.title).toBe("Transaction Type: Purchase");
      expect(result.message).toContain("representing the buyer");
      expect(result.message).toContain("seller's agent");
    });

    it("should return sale context", () => {
      const result = getTransactionTypeContext("sale");

      expect(result.title).toBe("Transaction Type: Sale");
      expect(result.message).toContain("representing the seller");
      expect(result.message).toContain("buyer's agent");
    });
  });

  describe("validateRoleAssignments", () => {
    it("should pass when all required roles are assigned", () => {
      const contactAssignments: ContactAssignments = {
        client: ["contact-1"],
        seller_agent: ["contact-2"],
      };

      const roles: RoleConfig[] = [
        { role: "client", required: true, multiple: false },
        { role: "seller_agent", required: false, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(true);
      expect(result.missingRoles.length).toBe(0);
    });

    it("should fail when required role is missing", () => {
      const contactAssignments: ContactAssignments = {
        seller_agent: ["contact-2"],
      };

      const roles: RoleConfig[] = [
        { role: "client", required: true, multiple: false },
        { role: "seller_agent", required: false, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(false);
      expect(result.missingRoles).toContain("client");
      expect(result.missingRoles.length).toBe(1);
    });

    it("should fail when assignment array is empty", () => {
      const contactAssignments: ContactAssignments = {
        client: [],
      };

      const roles: RoleConfig[] = [
        { role: "client", required: true, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(false);
      expect(result.missingRoles).toContain("client");
    });

    it("should pass when optional roles are missing", () => {
      const contactAssignments: ContactAssignments = {
        client: ["contact-1"],
      };

      const roles: RoleConfig[] = [
        { role: "client", required: true, multiple: false },
        { role: "inspector", required: false, multiple: true },
        { role: "appraiser", required: false, multiple: false },
      ];

      const result = validateRoleAssignments(contactAssignments, roles);

      expect(result.isValid).toBe(true);
      expect(result.missingRoles.length).toBe(0);
    });
  });

  describe("getRoleDisplayName", () => {
    it('should return "Client (Buyer)" for CLIENT role in purchase transaction', () => {
      const result = getRoleDisplayName(SPECIFIC_ROLES.CLIENT, "purchase");
      expect(result).toBe("Client (Buyer)");
    });

    it('should return "Client (Seller)" for CLIENT role in sale transaction', () => {
      const result = getRoleDisplayName(SPECIFIC_ROLES.CLIENT, "sale");
      expect(result).toBe("Client (Seller)");
    });

    it("should return standard display name for non-CLIENT roles", () => {
      const result = getRoleDisplayName(SPECIFIC_ROLES.BUYER_AGENT, "purchase");
      expect(result).toBe("Buyer Agent");
    });

    it("should return standard display name for inspector", () => {
      const result = getRoleDisplayName(SPECIFIC_ROLES.INSPECTOR, "sale");
      expect(result).toBe("Inspector");
    });

    it("should return standard display name for transaction coordinator", () => {
      const result = getRoleDisplayName(
        SPECIFIC_ROLES.TRANSACTION_COORDINATOR,
        "purchase",
      );
      expect(result).toBe("Transaction Coordinator (TC)");
    });
  });
});
