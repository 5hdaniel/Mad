import { ValidationService, ValidationError } from "../validationService";

describe("ValidationService", () => {
  describe("validateUserId", () => {
    it("should validate valid UUID", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      expect(ValidationService.validateUserId(uuid)).toBe(uuid);
    });

    it("should throw ValidationError for invalid UUID", () => {
      expect(() => ValidationService.validateUserId("invalid-uuid")).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validateUserId("invalid-uuid")).toThrow(
        "Invalid UUID format",
      );
    });

    it("should throw ValidationError for empty string", () => {
      expect(() => ValidationService.validateUserId("")).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validateUserId("  ")).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError for non-string", () => {
      expect(() => ValidationService.validateUserId(123)).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validateUserId(null)).toThrow(
        ValidationError,
      );
    });
  });

  describe("validateEmail", () => {
    it("should validate and normalize email", () => {
      expect(ValidationService.validateEmail("Test@Example.COM")).toBe(
        "test@example.com",
      );
      expect(ValidationService.validateEmail(" user@domain.com ")).toBe(
        "user@domain.com",
      );
    });

    it("should accept valid email formats", () => {
      const validEmails = [
        "simple@example.com",
        "user.name@example.com",
        "user+tag@example.co.uk",
        "user_name@example.com",
        "user123@example.com",
        "a@b.co",
      ];

      validEmails.forEach((email) => {
        expect(() => ValidationService.validateEmail(email)).not.toThrow();
      });
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "invalid",
        "@example.com",
        "user@",
        "user name@example.com",
        "user@example",
      ];

      invalidEmails.forEach((email) => {
        expect(() => ValidationService.validateEmail(email)).toThrow(
          ValidationError,
        );
      });
    });

    it("should reject emails exceeding 255 characters", () => {
      const longEmail = "a".repeat(250) + "@example.com";
      expect(() => ValidationService.validateEmail(longEmail)).toThrow(
        "Email exceeds maximum length",
      );
    });
  });

  describe("validatePhone", () => {
    it("should validate phone numbers", () => {
      const validPhones = [
        "+1 (555) 123-4567",
        "555-123-4567",
        "5551234567",
        "+44 20 7123 4567",
        "(555) 123-4567",
      ];

      validPhones.forEach((phone) => {
        expect(() =>
          ValidationService.validatePhone(phone, true),
        ).not.toThrow();
      });
    });

    it("should return null for empty phone when not required", () => {
      expect(ValidationService.validatePhone("", false)).toBeNull();
      expect(ValidationService.validatePhone(null, false)).toBeNull();
    });

    it("should throw ValidationError when required but empty", () => {
      expect(() => ValidationService.validatePhone("", true)).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validatePhone(null, true)).toThrow(
        "Phone number is required",
      );
    });

    it("should reject invalid phone formats", () => {
      const invalidPhones = ["abc", "123", "12345"];

      invalidPhones.forEach((phone) => {
        expect(() => ValidationService.validatePhone(phone, true)).toThrow(
          ValidationError,
        );
      });
    });
  });

  describe("validateZipCode", () => {
    it("should validate ZIP codes", () => {
      expect(ValidationService.validateZipCode("12345")).toBe("12345");
      expect(ValidationService.validateZipCode("12345-6789")).toBe(
        "12345-6789",
      );
    });

    it("should return null for empty ZIP when not required", () => {
      expect(ValidationService.validateZipCode("", false)).toBeNull();
      expect(ValidationService.validateZipCode(null, false)).toBeNull();
    });

    it("should throw ValidationError for invalid ZIP codes", () => {
      expect(() => ValidationService.validateZipCode("1234", false)).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validateZipCode("abcde", false)).toThrow(
        ValidationError,
      );
    });
  });

  describe("validateUserData", () => {
    it("should validate complete user data", () => {
      const userData = {
        email: "user@example.com",
        oauth_provider: "google",
        subscription_tier: "premium",
      };

      const validated = ValidationService.validateUserData(userData);
      expect(validated.email).toBe("user@example.com");
      expect(validated.oauth_provider).toBe("google");
      expect(validated.subscription_tier).toBe("premium");
    });

    it("should require email for new users", () => {
      const userData = { oauth_provider: "google" };
      expect(() => ValidationService.validateUserData(userData, true)).toThrow(
        "Email is required",
      );
    });

    it("should validate OAuth provider", () => {
      const userData = { email: "test@example.com", oauth_provider: "invalid" };
      expect(() => ValidationService.validateUserData(userData)).toThrow(
        ValidationError,
      );
    });

    it("should validate subscription tier", () => {
      const validData = {
        email: "test@example.com",
        subscription_tier: "free",
      };
      expect(() => ValidationService.validateUserData(validData)).not.toThrow();

      const invalidData = {
        email: "test@example.com",
        subscription_tier: "invalid",
      };
      expect(() => ValidationService.validateUserData(invalidData)).toThrow(
        ValidationError,
      );
    });
  });

  describe("validateTransactionData", () => {
    it("should validate complete transaction data", () => {
      const transactionData = {
        property_address: "123 Main St, Anytown, USA",
        transaction_type: "purchase",
        latitude: 40.7128,
        longitude: -74.006,
      };

      const validated =
        ValidationService.validateTransactionData(transactionData);
      expect(validated.property_address).toBe("123 Main St, Anytown, USA");
      expect(validated.transaction_type).toBe("purchase");
      expect(validated.latitude).toBe(40.7128);
      expect(validated.longitude).toBe(-74.006);
    });

    it("should require property address for new transactions", () => {
      const transactionData = { transaction_type: "purchase" };
      expect(() =>
        ValidationService.validateTransactionData(transactionData, true),
      ).toThrow("Property address is required");
    });

    it("should validate transaction type", () => {
      const validData = {
        property_address: "123 Main St",
        transaction_type: "sale",
      };
      expect(() =>
        ValidationService.validateTransactionData(validData),
      ).not.toThrow();

      const invalidData = {
        property_address: "123 Main St",
        transaction_type: "invalid",
      };
      expect(() =>
        ValidationService.validateTransactionData(invalidData),
      ).toThrow(ValidationError);
    });

    it("should validate coordinates", () => {
      const invalidLat = {
        property_address: "123 Main St",
        latitude: 100,
        longitude: 0,
      };
      expect(() =>
        ValidationService.validateTransactionData(invalidLat),
      ).toThrow("Invalid latitude");

      const invalidLng = {
        property_address: "123 Main St",
        latitude: 0,
        longitude: 200,
      };
      expect(() =>
        ValidationService.validateTransactionData(invalidLng),
      ).toThrow("Invalid longitude");
    });

    it("should accept valid coordinates", () => {
      const validCoords = {
        property_address: "123 Main St",
        latitude: 40.7128,
        longitude: -74.006,
      };
      expect(() =>
        ValidationService.validateTransactionData(validCoords),
      ).not.toThrow();
    });
  });

  describe("validateContactData", () => {
    it("should validate complete contact data", () => {
      const contactData = {
        name: "John Doe",
        source: "manual",
      };

      const validated = ValidationService.validateContactData(contactData);
      expect(validated.name).toBe("John Doe");
      expect(validated.source).toBe("manual");
    });

    it("should require name for new contacts", () => {
      const contactData = { source: "manual" };
      expect(() =>
        ValidationService.validateContactData(contactData, true),
      ).toThrow("Name is required");
    });

    it("should validate source", () => {
      const validData = { name: "John Doe", source: "gmail" };
      expect(() =>
        ValidationService.validateContactData(validData),
      ).not.toThrow();

      const invalidData = { name: "John Doe", source: "invalid" };
      expect(() => ValidationService.validateContactData(invalidData)).toThrow(
        ValidationError,
      );
    });

    it("should trim and validate name length", () => {
      const validData = { name: "  John Doe  " };
      const validated = ValidationService.validateContactData(validData);
      expect(validated.name).toBe("John Doe");

      const tooLong = { name: "a".repeat(201) };
      expect(() => ValidationService.validateContactData(tooLong)).toThrow(
        ValidationError,
      );
    });
  });

  describe("validateProvider", () => {
    it("should validate and normalize provider", () => {
      expect(ValidationService.validateProvider("Google")).toBe("google");
      expect(ValidationService.validateProvider("MICROSOFT")).toBe("microsoft");
      expect(ValidationService.validateProvider(" google ")).toBe("google");
    });

    it("should reject invalid providers", () => {
      expect(() => ValidationService.validateProvider("facebook")).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validateProvider("")).toThrow(
        ValidationError,
      );
      expect(() => ValidationService.validateProvider(null)).toThrow(
        ValidationError,
      );
    });
  });

  describe("sanitizeObject", () => {
    it("should remove undefined and null values", () => {
      const obj = {
        name: "Test",
        value: null,
        count: undefined,
        active: true,
      };

      const sanitized = ValidationService.sanitizeObject(obj);
      expect(sanitized).toEqual({ name: "Test", active: true });
      expect(sanitized.value).toBeUndefined();
      expect(sanitized.count).toBeUndefined();
    });

    it("should remove dangerous properties", () => {
      const obj = {
        name: "Test",
        __proto__: {},
        constructor: {},
        prototype: {},
      };

      const sanitized = ValidationService.sanitizeObject(obj);

      expect(sanitized).toEqual({ name: "Test" });
      expect(Object.keys(sanitized)).not.toContain("__proto__");
      expect(Object.keys(sanitized)).not.toContain("constructor");
      expect(Object.keys(sanitized)).not.toContain("prototype");
    });
  });
});
