/**
 * @jest-environment node
 */

/**
 * Unit tests for Transaction Database Service
 * Tests the validateTransactionStatus function for proper validation behavior
 */

import {
  validateTransactionStatus,
  VALID_TRANSACTION_STATUSES,
} from "../transactionDbService";
import { DatabaseError } from "../../../types";

describe("transactionDbService", () => {
  describe("VALID_TRANSACTION_STATUSES", () => {
    it("should contain exactly the four canonical status values", () => {
      expect(VALID_TRANSACTION_STATUSES).toEqual(["pending", "active", "closed", "rejected"]);
    });

    it("should be readonly", () => {
      // TypeScript enforces this at compile time, but we can verify the array exists
      expect(Array.isArray(VALID_TRANSACTION_STATUSES)).toBe(true);
      expect(VALID_TRANSACTION_STATUSES.length).toBe(4);
    });
  });

  describe("validateTransactionStatus", () => {
    describe("valid status values", () => {
      it("should return 'pending' when given 'pending'", () => {
        expect(validateTransactionStatus("pending")).toBe("pending");
      });

      it("should return 'active' when given 'active'", () => {
        expect(validateTransactionStatus("active")).toBe("active");
      });

      it("should return 'closed' when given 'closed'", () => {
        expect(validateTransactionStatus("closed")).toBe("closed");
      });

      it("should return 'rejected' when given 'rejected'", () => {
        expect(validateTransactionStatus("rejected")).toBe("rejected");
      });
    });

    describe("default behavior for null/undefined/empty", () => {
      it("should return 'active' when given null", () => {
        expect(validateTransactionStatus(null)).toBe("active");
      });

      it("should return 'active' when given undefined", () => {
        expect(validateTransactionStatus(undefined)).toBe("active");
      });

      it("should return 'active' when given empty string", () => {
        expect(validateTransactionStatus("")).toBe("active");
      });
    });

    describe("invalid status values - should throw", () => {
      it("should throw DatabaseError for legacy 'completed' status", () => {
        expect(() => validateTransactionStatus("completed")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("completed")).toThrow(
          'Invalid transaction status: "completed". Valid values are: pending, active, closed, rejected'
        );
      });

      it("should throw DatabaseError for legacy 'open' status", () => {
        expect(() => validateTransactionStatus("open")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("open")).toThrow(
          'Invalid transaction status: "open". Valid values are: pending, active, closed, rejected'
        );
      });

      it("should throw DatabaseError for legacy 'cancelled' status", () => {
        expect(() => validateTransactionStatus("cancelled")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("cancelled")).toThrow(
          'Invalid transaction status: "cancelled". Valid values are: pending, active, closed, rejected'
        );
      });

      it("should throw DatabaseError for legacy 'archived' status", () => {
        expect(() => validateTransactionStatus("archived")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("archived")).toThrow(
          'Invalid transaction status: "archived". Valid values are: pending, active, closed, rejected'
        );
      });

      it("should throw DatabaseError for unknown status values", () => {
        expect(() => validateTransactionStatus("unknown")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("invalid")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("foo")).toThrow(DatabaseError);
      });

      it("should throw DatabaseError for non-string values", () => {
        expect(() => validateTransactionStatus(123)).toThrow(DatabaseError);
        expect(() => validateTransactionStatus(true)).toThrow(DatabaseError);
        expect(() => validateTransactionStatus({})).toThrow(DatabaseError);
        expect(() => validateTransactionStatus([])).toThrow(DatabaseError);
      });

      it("should include the invalid value in the error message", () => {
        expect(() => validateTransactionStatus("badvalue")).toThrow(
          'Invalid transaction status: "badvalue"'
        );
      });

      it("should include valid values in the error message", () => {
        expect(() => validateTransactionStatus("bad")).toThrow(
          "Valid values are: pending, active, closed, rejected"
        );
      });
    });

    describe("case sensitivity", () => {
      it("should be case sensitive - reject uppercase valid values", () => {
        expect(() => validateTransactionStatus("Active")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("ACTIVE")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("Closed")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("PENDING")).toThrow(DatabaseError);
      });
    });

    describe("whitespace handling", () => {
      it("should reject values with leading/trailing whitespace", () => {
        expect(() => validateTransactionStatus(" active")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus("active ")).toThrow(DatabaseError);
        expect(() => validateTransactionStatus(" active ")).toThrow(DatabaseError);
      });
    });
  });
});
