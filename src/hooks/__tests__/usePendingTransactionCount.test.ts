/**
 * Unit tests for usePendingTransactionCount hook
 *
 * BACKLOG-1124: Hook now uses getPendingCount IPC (server-side COUNT query)
 * instead of getAll + client-side filter.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { usePendingTransactionCount } from "../usePendingTransactionCount";

// Mock the AuthContext
const mockCurrentUser = { id: "user-123", email: "test@example.com" };

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

// Import useAuth mock to be able to modify it in tests
import { useAuth } from "../../contexts/AuthContext";
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("usePendingTransactionCount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock to default user
    mockUseAuth.mockReturnValue({
      currentUser: mockCurrentUser,
      isAuthenticated: true,
      isLoading: false,
      sessionToken: "token",
      authProvider: null,
      subscription: undefined,
      needsTermsAcceptance: false,
      login: jest.fn(),
      logout: jest.fn(),
      acceptTerms: jest.fn(),
      declineTerms: jest.fn(),
      refreshSession: jest.fn(),
      clearTermsRequirement: jest.fn(),
    });
    // Reset the transactions API mock
    (window.api.transactions.getPendingCount as jest.Mock).mockReset();
  });

  describe("initial fetch", () => {
    it("should fetch pending count on mount when user is authenticated", async () => {
      (window.api.transactions.getPendingCount as jest.Mock).mockResolvedValue({
        success: true,
        count: 3,
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(window.api.transactions.getPendingCount).toHaveBeenCalledWith("user-123");
      expect(result.current.pendingCount).toBe(3);
      expect(result.current.error).toBeNull();
    });

    it("should return 0 when count is zero", async () => {
      (window.api.transactions.getPendingCount as jest.Mock).mockResolvedValue({
        success: true,
        count: 0,
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe("when user is not authenticated", () => {
    it("should not fetch when currentUser is null", async () => {
      mockUseAuth.mockReturnValue({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
        sessionToken: null,
        authProvider: null,
        subscription: undefined,
        needsTermsAcceptance: false,
        login: jest.fn(),
        logout: jest.fn(),
        acceptTerms: jest.fn(),
        declineTerms: jest.fn(),
        refreshSession: jest.fn(),
        clearTermsRequirement: jest.fn(),
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      // Wait a tick to ensure any async operations would have started
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(window.api.transactions.getPendingCount).not.toHaveBeenCalled();
      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      (window.api.transactions.getPendingCount as jest.Mock).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Database error");
      expect(result.current.pendingCount).toBe(0);
    });

    it("should handle exceptions gracefully", async () => {
      (window.api.transactions.getPendingCount as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe("refetch functionality", () => {
    it("should allow manual refetch", async () => {
      (window.api.transactions.getPendingCount as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          count: 1,
        })
        .mockResolvedValueOnce({
          success: true,
          count: 5,
        });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(1);
      });

      // Call refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(5);
      });

      expect(window.api.transactions.getPendingCount).toHaveBeenCalledTimes(2);
    });
  });

  describe("memoization", () => {
    it("should memoize the pending count calculation", async () => {
      (window.api.transactions.getPendingCount as jest.Mock).mockResolvedValue({
        success: true,
        count: 2,
      });

      const { result, rerender } = renderHook(() =>
        usePendingTransactionCount()
      );

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(2);
      });

      const firstCount = result.current.pendingCount;

      // Re-render without changing state
      rerender();

      // Count should be the same value (memoized)
      expect(result.current.pendingCount).toBe(firstCount);
    });
  });
});
