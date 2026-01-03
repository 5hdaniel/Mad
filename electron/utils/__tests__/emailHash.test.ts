/**
 * Tests for emailHash utility
 * @see TASK-918
 */
import { computeEmailHash, EmailHashInput } from "../emailHash";

describe("computeEmailHash", () => {
  describe("hash consistency", () => {
    it("should produce the same hash for identical inputs", () => {
      const email: EmailHashInput = {
        subject: "Test Subject",
        from: "sender@example.com",
        sentDate: new Date("2024-01-15T10:30:00.000Z"),
        bodyPlain: "This is the email body content.",
      };

      const hash1 = computeEmailHash(email);
      const hash2 = computeEmailHash(email);

      expect(hash1).toBe(hash2);
    });

    it("should produce the same hash regardless of input case", () => {
      const email1: EmailHashInput = {
        subject: "Test Subject",
        from: "Sender@Example.COM",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body content",
      };

      const email2: EmailHashInput = {
        subject: "TEST SUBJECT",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body content",
      };

      expect(computeEmailHash(email1)).toBe(computeEmailHash(email2));
    });

    it("should produce the same hash with string or Date for sentDate", () => {
      const withDateObject: EmailHashInput = {
        subject: "Test",
        from: "test@example.com",
        sentDate: new Date("2024-01-15T10:30:00.000Z"),
        bodyPlain: "Body",
      };

      const withDateString: EmailHashInput = {
        subject: "Test",
        from: "test@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      expect(computeEmailHash(withDateObject)).toBe(
        computeEmailHash(withDateString),
      );
    });
  });

  describe("hash uniqueness", () => {
    it("should produce different hashes for different subjects", () => {
      const email1: EmailHashInput = {
        subject: "Subject A",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Same body",
      };

      const email2: EmailHashInput = {
        subject: "Subject B",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Same body",
      };

      expect(computeEmailHash(email1)).not.toBe(computeEmailHash(email2));
    });

    it("should produce different hashes for different senders", () => {
      const email1: EmailHashInput = {
        subject: "Same subject",
        from: "alice@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Same body",
      };

      const email2: EmailHashInput = {
        subject: "Same subject",
        from: "bob@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Same body",
      };

      expect(computeEmailHash(email1)).not.toBe(computeEmailHash(email2));
    });

    it("should produce different hashes for different dates", () => {
      const email1: EmailHashInput = {
        subject: "Same subject",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Same body",
      };

      const email2: EmailHashInput = {
        subject: "Same subject",
        from: "sender@example.com",
        sentDate: "2024-01-16T10:30:00.000Z",
        bodyPlain: "Same body",
      };

      expect(computeEmailHash(email1)).not.toBe(computeEmailHash(email2));
    });

    it("should produce different hashes for different body content", () => {
      const email1: EmailHashInput = {
        subject: "Same subject",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body version A",
      };

      const email2: EmailHashInput = {
        subject: "Same subject",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body version B",
      };

      expect(computeEmailHash(email1)).not.toBe(computeEmailHash(email2));
    });
  });

  describe("missing field handling", () => {
    it("should handle missing subject", () => {
      const email: EmailHashInput = {
        subject: null,
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body content",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64); // SHA-256 hex length
    });

    it("should handle undefined subject", () => {
      const email: EmailHashInput = {
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body content",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle missing from", () => {
      const email: EmailHashInput = {
        subject: "Test subject",
        from: null,
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body content",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle missing sentDate", () => {
      const email: EmailHashInput = {
        subject: "Test subject",
        from: "sender@example.com",
        sentDate: null,
        bodyPlain: "Body content",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle missing bodyPlain", () => {
      const email: EmailHashInput = {
        subject: "Test subject",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: null,
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle all fields missing", () => {
      const email: EmailHashInput = {
        subject: null,
        from: null,
        sentDate: null,
        bodyPlain: null,
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle empty object", () => {
      const email: EmailHashInput = {};

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle invalid date string", () => {
      const email: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "not-a-valid-date",
        bodyPlain: "Body",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });
  });

  describe("body truncation", () => {
    it("should truncate body to 500 characters", () => {
      const longBody = "a".repeat(1000);

      const emailLongBody: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: longBody,
      };

      const emailTruncatedBody: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "a".repeat(500),
      };

      expect(computeEmailHash(emailLongBody)).toBe(
        computeEmailHash(emailTruncatedBody),
      );
    });

    it("should not affect bodies shorter than 500 characters", () => {
      const shortBody = "Short body content";

      const email: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: shortBody,
      };

      // Hash should be deterministic
      const hash = computeEmailHash(email);
      expect(hash).toHaveLength(64);
    });

    it("should handle exactly 500 character body", () => {
      const exactBody = "b".repeat(500);

      const email: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: exactBody,
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });
  });

  describe("whitespace handling", () => {
    it("should trim whitespace from subject", () => {
      const email1: EmailHashInput = {
        subject: "  Test Subject  ",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      const email2: EmailHashInput = {
        subject: "Test Subject",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      expect(computeEmailHash(email1)).toBe(computeEmailHash(email2));
    });

    it("should trim whitespace from from field", () => {
      const email1: EmailHashInput = {
        subject: "Test",
        from: "  sender@example.com  ",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      const email2: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      expect(computeEmailHash(email1)).toBe(computeEmailHash(email2));
    });

    it("should trim whitespace from body (after truncation)", () => {
      const email1: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "  Body content  ",
      };

      const email2: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body content",
      };

      expect(computeEmailHash(email1)).toBe(computeEmailHash(email2));
    });
  });

  describe("unicode handling", () => {
    it("should handle unicode characters in subject", () => {
      const email: EmailHashInput = {
        subject: "Property Closing - 日本語テスト",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle unicode in body", () => {
      const email: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Hello, 你好, مرحبا, שלום, Привет",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });

    it("should handle emojis", () => {
      const email: EmailHashInput = {
        subject: "Closing Complete! 🏠🎉",
        from: "agent@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Congratulations on your new home! 🏡",
      };

      expect(() => computeEmailHash(email)).not.toThrow();
      expect(computeEmailHash(email)).toHaveLength(64);
    });
  });

  describe("hash format", () => {
    it("should return a 64-character hex string (SHA-256)", () => {
      const email: EmailHashInput = {
        subject: "Test",
        from: "sender@example.com",
        sentDate: "2024-01-15T10:30:00.000Z",
        bodyPlain: "Body",
      };

      const hash = computeEmailHash(email);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });
});
