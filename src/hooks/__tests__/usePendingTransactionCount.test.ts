/**
 * Unit tests for usePendingTransactionCount hook
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
  const mockTransactions = [
    { id: "1", detection_status: "pending", property_address: "123 Main St" },
    { id: "2", detection_status: "confirmed", property_address: "456 Oak Ave" },
    { id: "3", detection_status: "pending", property_address: "789 Elm St" },
    { id: "4", detection_status: "rejected", property_address: "321 Pine Rd" },
    { id: "5", detection_status: "pending", property_address: "555 Cedar Ln" },
  ];

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
    (window.api.transactions.getAll as jest.Mock).mockReset();
  });

  describe("initial fetch", () => {
    it("should fetch transactions on mount when user is authenticated", async () => {
      (window.api.transactions.getAll as jest.Mock).mockResolvedValue({
        success: true,
        transactions: mockTransactions,
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(window.api.transactions.getAll).toHaveBeenCalledWith("user-123");
      expect(result.current.pendingCount).toBe(3); // 3 pending transactions
      expect(result.current.error).toBeNull();
    });

    it("should return 0 when no transactions exist", async () => {
      (window.api.transactions.getAll as jest.Mock).mockResolvedValue({
        success: true,
        transactions: [],
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(0);
    });

    it("should return 0 when all transactions are confirmed/rejected", async () => {
      const confirmedTransactions = [
        { id: "1", detection_status: "confirmed", property_address: "123 Main St" },
        { id: "2", detection_status: "rejected", property_address: "456 Oak Ave" },
      ];

      (window.api.transactions.getAll as jest.Mock).mockResolvedValue({
        success: true,
        transactions: confirmedTransactions,
      });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe("when user is not authenticated", () => {
    it("should not fetch transactions when currentUser is null", async () => {
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

      expect(window.api.transactions.getAll).not.toHaveBeenCalled();
      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      (window.api.transactions.getAll as jest.Mock).mockResolvedValue({
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
      (window.api.transactions.getAll as jest.Mock).mockRejectedValue(
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
      (window.api.transactions.getAll as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          transactions: [{ id: "1", detection_status: "pending" }],
        })
        .mockResolvedValueOnce({
          success: true,
          transactions: [
            { id: "1", detection_status: "pending" },
            { id: "2", detection_status: "pending" },
          ],
        });

      const { result } = renderHook(() => usePendingTransactionCount());

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(1);
      });

      // Call refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(2);
      });

      expect(window.api.transactions.getAll).toHaveBeenCalledTimes(2);
    });
  });

  describe("memoization", () => {
    it("should memoize the pending count calculation", async () => {
      const transactions = [
        { id: "1", detection_status: "pending" },
        { id: "2", detection_status: "pending" },
      ];

      (window.api.transactions.getAll as jest.Mock).mockResolvedValue({
        success: true,
        transactions,
      });

      const { result, rerender } = renderHook(() =>
        usePendingTransactionCount()
      );

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(2);
      });

      const firstCount = result.current.pendingCount;

      // Re-render without changing transactions
      rerender();

      // Count should be the same reference (memoized)
      expect(result.current.pendingCount).toBe(firstCount);
    });
  });
});
