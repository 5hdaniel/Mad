/**
 * Tests for Input Validation Utilities
 * Ensures transaction data validation works correctly, especially for dates and prices
 */

import {
  ValidationError,
  validateContactId,
  validateTransactionId,
  validateTransactionData,
} from "../validation";

describe("Contact Validation", () => {
  describe("validateContactId", () => {
    it("should accept valid UUID strings", () => {
      const validUUID = "9cc92292-400f-406b-a9e6-02522278a65a";
      expect(validateContactId(validUUID)).toBe(validUUID);
    });

    it("should trim whitespace from valid UUIDs", () => {
      const uuidWithSpaces = "  448aa043-9866-4cc7-8d14-8975003dc216  ";
      const trimmedUUID = "448aa043-9866-4cc7-8d14-8975003dc216";
      expect(validateContactId(uuidWithSpaces)).toBe(trimmedUUID);
    });

    it("should reject non-string values", () => {
      expect(() => validateContactId(123)).toThrow(ValidationError);
      expect(() => validateContactId(123)).toThrow(
        "Contact ID must be a string",
      );
    });

    it("should reject invalid UUID format", () => {
      expect(() => validateContactId("not-a-uuid")).toThrow(ValidationError);
      expect(() => validateContactId("not-a-uuid")).toThrow(
        "Contact ID must be a valid UUID",
      );
    });

    it("should reject integer IDs (regression test for the bug)", () => {
      // This tests the original bug - contact IDs were being validated as integers
      expect(() => validateContactId(12345)).toThrow(ValidationError);
      expect(() => validateContactId("12345")).toThrow(ValidationError);
    });

    it("should handle required parameter", () => {
      expect(() => validateContactId(null, true)).toThrow(
        "Contact ID is required",
      );
      expect(validateContactId(null, false)).toBeNull();
      expect(() => validateContactId("", true)).toThrow(
        "Contact ID is required",
      );
      expect(validateContactId("", false)).toBeNull();
    });

    it("should accept UUIDs in different cases", () => {
      const lowerUUID = "a6f3ccec-5e25-48f7-85dc-8be3f4c1048d";
      const upperUUID = "A6F3CCEC-5E25-48F7-85DC-8BE3F4C1048D";
      const mixedUUID = "A6f3CceC-5E25-48f7-85dC-8Be3f4C1048D";

      expect(validateContactId(lowerUUID)).toBe(lowerUUID);
      expect(validateContactId(upperUUID)).toBe(upperUUID);
      expect(validateContactId(mixedUUID)).toBe(mixedUUID);
    });
  });
});

describe("Transaction Validation", () => {
  describe("validateTransactionId", () => {
    it("should accept valid UUID strings", () => {
      const validUUID = "a6f3ccec-5e25-48f7-85dc-8be3f4c1048d";
      expect(validateTransactionId(validUUID)).toBe(validUUID);
    });

    it("should reject non-string values", () => {
      expect(() => validateTransactionId(123)).toThrow(ValidationError);
      expect(() => validateTransactionId(123)).toThrow(
        "Transaction ID must be a string",
      );
    });

    it("should reject invalid UUID format", () => {
      expect(() => validateTransactionId("not-a-uuid")).toThrow(
        ValidationError,
      );
      expect(() => validateTransactionId("not-a-uuid")).toThrow(
        "Transaction ID must be a valid UUID",
      );
    });

    it("should handle required parameter", () => {
      expect(() => validateTransactionId(null, true)).toThrow(
        "Transaction ID is required",
      );
      expect(validateTransactionId(null, false)).toBeNull();
    });
  });

  describe("validateTransactionData - Date Fields", () => {
    it("should accept and validate representation_start_date", () => {
      const data = {
        representation_start_date: "2024-01-15",
      };
      const validated = validateTransactionData(data, true);
      expect(validated.representation_start_date).toBe("2024-01-15");
    });

    it("should accept and validate closing_date", () => {
      const data = {
        closing_date: "2024-03-30",
      };
      const validated = validateTransactionData(data, true);
      expect(validated.closing_date).toBe("2024-03-30");
    });

    it("should accept and validate closing_date_verified", () => {
      const data = {
        closing_date_verified: 1,
      };
      const validated = validateTransactionData(data, true);
      expect(validated.closing_date_verified).toBe(1);
    });

    it("should reject invalid date formats for representation_start_date", () => {
      const data = {
        representation_start_date: "01/15/2024", // Wrong format
      };
      expect(() => validateTransactionData(data, true)).toThrow(
        ValidationError,
      );
      expect(() => validateTransactionData(data, true)).toThrow(
        "Representation start date must be in YYYY-MM-DD format",
      );
    });

    it("should reject invalid date formats for closing_date", () => {
      const data = {
        closing_date: "03/30/2024", // Wrong format
      };
      expect(() => validateTransactionData(data, true)).toThrow(
        ValidationError,
      );
      expect(() => validateTransactionData(data, true)).toThrow(
        "Closing date must be in YYYY-MM-DD format",
      );
    });

    it("should reject invalid closing_date_verified values", () => {
      const data = {
        closing_date_verified: 2, // Must be 0 or 1
      };
      expect(() => validateTransactionData(data, true)).toThrow(
        ValidationError,
      );
      expect(() => validateTransactionData(data, true)).toThrow(
        "Closing date verified must be 0 or 1",
      );
    });

    it("should allow null values for date fields", () => {
      const data = {
        representation_start_date: null,
        closing_date: null,
        closing_date_verified: null,
      };
      const validated = validateTransactionData(data, true);
      // Null values should not be included in validated object
      expect(validated.representation_start_date).toBeUndefined();
      expect(validated.closing_date).toBeUndefined();
      expect(validated.closing_date_verified).toBeUndefined();
    });
  });

  describe("validateTransactionData - Price Fields", () => {
    it("should accept and validate sale_price", () => {
      const data = {
        sale_price: 500000,
      };
      const validated = validateTransactionData(data, true);
      expect(validated.sale_price).toBe(500000);
    });

    it("should accept and validate listing_price", () => {
      const data = {
        listing_price: 525000,
      };
      const validated = validateTransactionData(data, true);
      expect(validated.listing_price).toBe(525000);
    });

    it("should accept string numbers for prices", () => {
      const data = {
        sale_price: "500000",
        listing_price: "525000",
      };
      const validated = validateTransactionData(data, true);
      expect(validated.sale_price).toBe(500000);
      expect(validated.listing_price).toBe(525000);
    });

    it("should reject negative prices", () => {
      const data = {
        sale_price: -100,
      };
      expect(() => validateTransactionData(data, true)).toThrow(
        ValidationError,
      );
      expect(() => validateTransactionData(data, true)).toThrow(
        "Sale price must be a non-negative number",
      );
    });

    it("should reject invalid price values", () => {
      const data = {
        listing_price: "not-a-number",
      };
      expect(() => validateTransactionData(data, true)).toThrow(
        ValidationError,
      );
      expect(() => validateTransactionData(data, true)).toThrow(
        "Listing price must be a non-negative number",
      );
    });
  });

  describe("validateTransactionData - Full Update Scenario", () => {
    it("should validate complete transaction update with all fields", () => {
      const data = {
        property_address: "123 Main St, Anytown, CA 12345",
        transaction_type: "purchase",
        status: "active",
        representation_start_date: "2024-01-15",
        closing_date: "2024-03-30",
        closing_date_verified: 1,
        sale_price: 500000,
        listing_price: 525000,
        notes: "Test transaction with all fields",
      };

      const validated = validateTransactionData(data, true);

      expect(validated.property_address).toBe("123 Main St, Anytown, CA 12345");
      expect(validated.transaction_type).toBe("purchase");
      expect(validated.status).toBe("active");
      expect(validated.representation_start_date).toBe("2024-01-15");
      expect(validated.closing_date).toBe("2024-03-30");
      expect(validated.closing_date_verified).toBe(1);
      expect(validated.sale_price).toBe(500000);
      expect(validated.listing_price).toBe(525000);
      expect(validated.notes).toBe("Test transaction with all fields");
    });

    it("should validate partial update with only dates", () => {
      const data = {
        representation_start_date: "2024-01-15",
        closing_date: "2024-03-30",
        closing_date_verified: 1,
      };

      const validated = validateTransactionData(data, true);

      expect(validated.representation_start_date).toBe("2024-01-15");
      expect(validated.closing_date).toBe("2024-03-30");
      expect(validated.closing_date_verified).toBe(1);
      // Other fields should not be present
      expect(validated.property_address).toBeUndefined();
      expect(validated.sale_price).toBeUndefined();
    });
  });

  describe("Regression Tests - Date Saving Bug", () => {
    it("should NOT strip out date fields during validation (regression test)", () => {
      // This test ensures the bug where dates were being stripped is fixed
      const updateData = {
        representation_start_date: "2024-01-15",
        closing_date: "2024-03-30",
        closing_date_verified: 1,
      };

      const validated = validateTransactionData(updateData, true);

      // These fields MUST be present in the validated object
      expect(validated).toHaveProperty("representation_start_date");
      expect(validated).toHaveProperty("closing_date");
      expect(validated).toHaveProperty("closing_date_verified");

      // And they must have the correct values
      expect(validated.representation_start_date).toBe("2024-01-15");
      expect(validated.closing_date).toBe("2024-03-30");
      expect(validated.closing_date_verified).toBe(1);
    });

    it("should NOT strip out price fields during validation (regression test)", () => {
      // This test ensures price fields are not stripped
      const updateData = {
        sale_price: 500000,
        listing_price: 525000,
      };

      const validated = validateTransactionData(updateData, true);

      // These fields MUST be present in the validated object
      expect(validated).toHaveProperty("sale_price");
      expect(validated).toHaveProperty("listing_price");

      // And they must have the correct values
      expect(validated.sale_price).toBe(500000);
      expect(validated.listing_price).toBe(525000);
    });
  });
});
