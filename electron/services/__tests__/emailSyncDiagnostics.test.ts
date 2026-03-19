/**
 * TASK-2273: Tests for email sync failure classification and Sentry diagnostics
 *
 * Validates that classifyEmailSyncError correctly classifies errors into
 * structured failure reasons for Sentry reporting.
 */
import { classifyEmailSyncError, type EmailSyncFailureReason } from "../emailSyncService";

describe("classifyEmailSyncError", () => {
  describe("token_expired", () => {
    it("should classify 401 HTTP status as token_expired", () => {
      const error = { response: { status: 401 }, message: "Unauthorized" };
      expect(classifyEmailSyncError(error)).toBe("token_expired");
    });

    it("should classify AADSTS error codes as token_expired", () => {
      const error = new Error("AADSTS50173: The provided token has expired.");
      expect(classifyEmailSyncError(error)).toBe("token_expired");
    });

    it("should classify invalid_grant as token_expired", () => {
      const error = new Error("invalid_grant: Token has been expired or revoked");
      expect(classifyEmailSyncError(error)).toBe("token_expired");
    });

    it("should classify token refresh failure as token_expired", () => {
      const error = new Error("Microsoft access token expired and refresh failed. Please reconnect Outlook.");
      expect(classifyEmailSyncError(error)).toBe("token_expired");
    });
  });

  describe("rate_limited", () => {
    it("should classify 429 HTTP status as rate_limited", () => {
      const error = { response: { status: 429 }, message: "Too Many Requests" };
      expect(classifyEmailSyncError(error)).toBe("rate_limited");
    });

    it("should classify 429 with retry-after header as rate_limited", () => {
      const error = {
        response: { status: 429, headers: { "retry-after": "30" } },
        message: "Rate limit exceeded",
      };
      expect(classifyEmailSyncError(error)).toBe("rate_limited");
    });
  });

  describe("network_error", () => {
    it("should classify ENOTFOUND as network_error", () => {
      const error = { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND graph.microsoft.com" };
      expect(classifyEmailSyncError(error)).toBe("network_error");
    });

    it("should classify ECONNRESET as network_error", () => {
      const error = { code: "ECONNRESET", message: "Connection reset" };
      expect(classifyEmailSyncError(error)).toBe("network_error");
    });

    it("should classify ETIMEDOUT as network_error", () => {
      const error = { code: "ETIMEDOUT", message: "Connection timed out" };
      expect(classifyEmailSyncError(error)).toBe("network_error");
    });

    it("should classify fetch failed message as network_error", () => {
      const error = new Error("fetch failed");
      expect(classifyEmailSyncError(error)).toBe("network_error");
    });

    it("should classify axios error without response as network_error", () => {
      const error = {
        isAxiosError: true,
        request: {},
        message: "Network Error",
      };
      expect(classifyEmailSyncError(error)).toBe("network_error");
    });
  });

  describe("storage_error", () => {
    it("should classify ENOSPC as storage_error", () => {
      const error = new Error("ENOSPC: no space left on device");
      expect(classifyEmailSyncError(error)).toBe("storage_error");
    });

    it("should classify disk-related message as storage_error", () => {
      const error = new Error("disk full, cannot write");
      expect(classifyEmailSyncError(error)).toBe("storage_error");
    });

    it("should classify space-related message as storage_error", () => {
      const error = new Error("Not enough space on device");
      expect(classifyEmailSyncError(error)).toBe("storage_error");
    });
  });

  describe("api_error", () => {
    it("should classify 400 HTTP status as api_error", () => {
      const error = { response: { status: 400 }, message: "Bad Request" };
      expect(classifyEmailSyncError(error)).toBe("api_error");
    });

    it("should classify 403 HTTP status as api_error", () => {
      const error = { response: { status: 403 }, message: "Forbidden" };
      expect(classifyEmailSyncError(error)).toBe("api_error");
    });

    it("should classify 500 HTTP status as api_error", () => {
      const error = { response: { status: 500 }, message: "Internal Server Error" };
      expect(classifyEmailSyncError(error)).toBe("api_error");
    });

    it("should classify 503 HTTP status as api_error", () => {
      const error = { response: { status: 503 }, message: "Service Unavailable" };
      expect(classifyEmailSyncError(error)).toBe("api_error");
    });
  });

  describe("unknown", () => {
    it("should classify unrecognized errors as unknown", () => {
      const error = new Error("Something completely unexpected happened");
      expect(classifyEmailSyncError(error)).toBe("unknown");
    });

    it("should classify null as unknown", () => {
      expect(classifyEmailSyncError(null)).toBe("unknown");
    });

    it("should classify undefined as unknown", () => {
      expect(classifyEmailSyncError(undefined)).toBe("unknown");
    });

    it("should classify string error as unknown", () => {
      expect(classifyEmailSyncError("some error string")).toBe("unknown");
    });

    it("should classify empty object as unknown", () => {
      expect(classifyEmailSyncError({})).toBe("unknown");
    });
  });

  describe("priority ordering", () => {
    it("should prioritize token_expired over api_error for 401", () => {
      // 401 is both a token error and an HTTP error >= 400
      // token_expired should take priority
      const error = { response: { status: 401 }, message: "Unauthorized" };
      expect(classifyEmailSyncError(error)).toBe("token_expired");
    });

    it("should prioritize network_error over storage_error for network errors", () => {
      // An error with a network code should be classified as network even if message contains "disk"
      const error = { code: "ECONNRESET", message: "disk connection reset" };
      expect(classifyEmailSyncError(error)).toBe("network_error");
    });
  });

  describe("type safety", () => {
    it("should return a valid EmailSyncFailureReason type", () => {
      const validReasons: EmailSyncFailureReason[] = [
        "token_expired",
        "rate_limited",
        "network_error",
        "storage_error",
        "api_error",
        "unknown",
      ];

      const result = classifyEmailSyncError(new Error("test"));
      expect(validReasons).toContain(result);
    });
  });
});
