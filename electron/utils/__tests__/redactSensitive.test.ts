import { redactEmail, redactToken, redactId } from "../redactSensitive";

describe("redactSensitive", () => {
  describe("redactEmail", () => {
    it("redacts a standard email, keeping first char and domain", () => {
      expect(redactEmail("user@example.com")).toBe("u***@example.com");
    });

    it("handles single-character local part", () => {
      expect(redactEmail("a@b.co")).toBe("a***@b.co");
    });

    it("returns *** for empty string", () => {
      expect(redactEmail("")).toBe("***");
    });

    it("returns *** for string without @", () => {
      expect(redactEmail("no-at-sign")).toBe("***");
    });

    it("returns *** for @ at position 0 (no local part)", () => {
      expect(redactEmail("@domain.com")).toBe("***");
    });

    it("handles email with subdomain", () => {
      expect(redactEmail("admin@mail.example.org")).toBe("a***@mail.example.org");
    });

    it("handles email with plus addressing", () => {
      expect(redactEmail("user+tag@example.com")).toBe("u***@example.com");
    });
  });

  describe("redactToken", () => {
    it("shows first 4 and last 4 chars for long tokens", () => {
      expect(redactToken("eyJhbGciOiJIUzI1NiJ9")).toBe("eyJh...NiJ9");
    });

    it("returns *** for short tokens (8 chars or less)", () => {
      expect(redactToken("12345678")).toBe("***");
      expect(redactToken("short")).toBe("***");
    });

    it("returns *** for empty string", () => {
      expect(redactToken("")).toBe("***");
    });

    it("handles 9-character token (minimum for redaction)", () => {
      expect(redactToken("123456789")).toBe("1234...6789");
    });

    it("handles very long JWT-like token", () => {
      const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      expect(redactToken(jwt)).toBe("eyJh...sR8U");
    });
  });

  describe("redactId", () => {
    it("shows first 8 chars of a UUID", () => {
      expect(redactId("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400...");
    });

    it("handles short IDs (8 chars or less)", () => {
      expect(redactId("abc")).toBe("abc...");
      expect(redactId("12345678")).toBe("12345678...");
    });

    it("returns *** for empty string", () => {
      expect(redactId("")).toBe("***");
    });

    it("handles exactly 9 characters", () => {
      expect(redactId("123456789")).toBe("12345678...");
    });
  });
});
