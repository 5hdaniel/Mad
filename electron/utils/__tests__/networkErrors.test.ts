/**
 * Unit tests for Network Error Detection (TASK-2049)
 *
 * Tests the isNetworkError utility that classifies errors as
 * network connectivity issues vs application-level errors.
 */

import { isNetworkError } from "../networkErrors";

describe("isNetworkError", () => {
  describe("returns true for network error codes", () => {
    const networkCodes = [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ECONNRESET",
      "ECONNABORTED",
      "ETIMEDOUT",
      "EAI_AGAIN",
      "ENETUNREACH",
      "ENETDOWN",
      "EHOSTUNREACH",
      "EPIPE",
    ];

    for (const code of networkCodes) {
      it(`should detect ${code}`, () => {
        const error = Object.assign(new Error(`${code} error`), { code });
        expect(isNetworkError(error)).toBe(true);
      });
    }
  });

  describe("returns true for network error messages", () => {
    const networkMessages = [
      "fetch failed",
      "network error",
      "ERR_INTERNET_DISCONNECTED",
      "Network request failed",
      "socket hang up",
      "getaddrinfo ENOTFOUND api.example.com",
      "DNS lookup failed",
      "Unable to connect to the server",
      "Connection timed out",
      "network is unreachable",
    ];

    for (const message of networkMessages) {
      it(`should detect "${message}"`, () => {
        expect(isNetworkError(new Error(message))).toBe(true);
      });
    }

    it("should be case-insensitive for message matching", () => {
      expect(isNetworkError(new Error("FETCH FAILED"))).toBe(true);
      expect(isNetworkError(new Error("Network Error"))).toBe(true);
      expect(isNetworkError(new Error("SOCKET HANG UP"))).toBe(true);
    });
  });

  describe("returns true for axios errors without response", () => {
    it("should detect axios network error (request sent but no response)", () => {
      const error = Object.assign(new Error("Network Error"), {
        isAxiosError: true,
        request: {},
        // No response property
      });
      expect(isNetworkError(error)).toBe(true);
    });
  });

  describe("returns false for non-network errors", () => {
    it("should not detect null/undefined", () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });

    it("should not detect empty error", () => {
      expect(isNetworkError(new Error())).toBe(false);
    });

    it("should not detect generic application errors", () => {
      expect(isNetworkError(new Error("Something went wrong"))).toBe(false);
    });

    it("should not detect auth errors", () => {
      expect(isNetworkError(new Error("Unauthorized"))).toBe(false);
      expect(isNetworkError(new Error("Token expired"))).toBe(false);
    });

    it("should not detect validation errors", () => {
      expect(isNetworkError(new Error("Invalid parameter"))).toBe(false);
    });

    it("should not detect axios errors with HTTP response", () => {
      const error = Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        request: {},
        response: { status: 400, data: "Bad Request" },
      });
      expect(isNetworkError(error)).toBe(false);
    });

    it("should not detect 401 auth errors", () => {
      const error = Object.assign(new Error("Unauthorized"), {
        response: { status: 401 },
      });
      expect(isNetworkError(error)).toBe(false);
    });

    it("should not detect 404 not found errors", () => {
      const error = Object.assign(new Error("Not Found"), {
        response: { status: 404 },
      });
      expect(isNetworkError(error)).toBe(false);
    });

    it("should not detect 500 server errors (these are server-side, not network)", () => {
      // Server errors indicate the request reached the server
      const error = new Error("Internal Server Error");
      expect(isNetworkError(error)).toBe(false);
    });

    it("should not detect non-Error objects without network properties", () => {
      expect(isNetworkError({ code: "CUSTOM_ERROR" })).toBe(false);
      expect(isNetworkError("string error")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle error with both code and message", () => {
      const error = Object.assign(new Error("something"), { code: "ECONNRESET" });
      expect(isNetworkError(error)).toBe(true);
    });

    it("should handle error with network message but non-network code", () => {
      const error = Object.assign(new Error("fetch failed"), { code: "CUSTOM" });
      expect(isNetworkError(error)).toBe(true);
    });

    it("should handle plain object with message property", () => {
      expect(isNetworkError({ message: "fetch failed" })).toBe(true);
    });

    it("should handle plain object with code property", () => {
      expect(isNetworkError({ code: "ETIMEDOUT" })).toBe(true);
    });
  });
});
