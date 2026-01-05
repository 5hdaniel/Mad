/**
 * Unit tests for useTransactionStatusUpdate hook
 * Tests transaction approval, rejection, and restoration workflows
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useTransactionStatusUpdate } from "../useTransactionStatusUpdate";
import { transactionService } from "../../services/transactionService";

// Mock the transaction service
jest.mock("../../services/transactionService", () => ({
  transactionService: {
    approve: jest.fn(),
    reject: jest.fn(),
    restore: jest.fn(),
  },
}));

describe("useTransactionStatusUpdate", () => {
  const mockUserId = "user-123";
  const mockTransactionId = "txn-456";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      expect(result.current.state).toEqual({
        isApproving: false,
        isRejecting: false,
        isRestoring: false,
        error: null,
      });
    });

    it("should provide all required methods", () => {
      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      expect(typeof result.current.approve).toBe("function");
      expect(typeof result.current.reject).toBe("function");
      expect(typeof result.current.restore).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
    });

    it("should handle undefined userId", () => {
      const { result } = renderHook(() => useTransactionStatusUpdate(undefined));

      expect(result.current.state.error).toBeNull();
    });
  });

  describe("approve", () => {
    it("should approve a transaction successfully", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let approveResult: boolean;
      await act(async () => {
        approveResult = await result.current.approve(mockTransactionId);
      });

      expect(approveResult!).toBe(true);
      expect(result.current.state.isApproving).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(transactionService.approve).toHaveBeenCalledWith(mockTransactionId, mockUserId);
    });

    it("should set isApproving to true during operation", async () => {
      let resolveApprove: (value: { success: boolean }) => void;
      (transactionService.approve as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveApprove = resolve;
          })
      );

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let approvePromise: Promise<boolean>;
      act(() => {
        approvePromise = result.current.approve(mockTransactionId);
      });

      // Should be approving
      await waitFor(() => {
        expect(result.current.state.isApproving).toBe(true);
      });

      // Resolve and check state is reset
      await act(async () => {
        resolveApprove({ success: true });
        await approvePromise;
      });

      expect(result.current.state.isApproving).toBe(false);
    });

    it("should fail when userId is undefined", async () => {
      const { result } = renderHook(() => useTransactionStatusUpdate(undefined));

      let approveResult: boolean;
      await act(async () => {
        approveResult = await result.current.approve(mockTransactionId);
      });

      expect(approveResult!).toBe(false);
      expect(result.current.state.error).toBe("Cannot approve: User ID is required");
      expect(transactionService.approve).not.toHaveBeenCalled();
    });

    it("should handle service error response", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({
        success: false,
        error: "Transaction not found",
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let approveResult: boolean;
      await act(async () => {
        approveResult = await result.current.approve(mockTransactionId);
      });

      expect(approveResult!).toBe(false);
      expect(result.current.state.error).toBe("Transaction not found");
    });

    it("should handle service error with default message", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({
        success: false,
        error: undefined,
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Failed to approve transaction");
    });

    it("should handle thrown errors", async () => {
      (transactionService.approve as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let approveResult: boolean;
      await act(async () => {
        approveResult = await result.current.approve(mockTransactionId);
      });

      expect(approveResult!).toBe(false);
      expect(result.current.state.error).toBe("Network error");
    });

    it("should handle non-Error thrown values", async () => {
      (transactionService.approve as jest.Mock).mockRejectedValue("String error");

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Failed to approve transaction");
    });

    it("should call onSuccess callback on success", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({ success: true });
      const onSuccess = jest.fn();

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.approve(mockTransactionId, { onSuccess });
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should call onError callback on failure", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({
        success: false,
        error: "Server error",
      });
      const onError = jest.fn();

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.approve(mockTransactionId, { onError });
      });

      expect(onError).toHaveBeenCalledWith("Server error");
    });

    it("should call onError when userId is undefined", async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useTransactionStatusUpdate(undefined));

      await act(async () => {
        await result.current.approve(mockTransactionId, { onError });
      });

      expect(onError).toHaveBeenCalledWith("Cannot approve: User ID is required");
    });
  });

  describe("reject", () => {
    it("should reject a transaction successfully", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let rejectResult: boolean;
      await act(async () => {
        rejectResult = await result.current.reject(mockTransactionId);
      });

      expect(rejectResult!).toBe(true);
      expect(result.current.state.isRejecting).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(transactionService.reject).toHaveBeenCalledWith(mockTransactionId, mockUserId, undefined);
    });

    it("should reject with reason", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.reject(mockTransactionId, "Duplicate entry");
      });

      expect(transactionService.reject).toHaveBeenCalledWith(
        mockTransactionId,
        mockUserId,
        "Duplicate entry"
      );
    });

    it("should set isRejecting to true during operation", async () => {
      let resolveReject: (value: { success: boolean }) => void;
      (transactionService.reject as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveReject = resolve;
          })
      );

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let rejectPromise: Promise<boolean>;
      act(() => {
        rejectPromise = result.current.reject(mockTransactionId);
      });

      await waitFor(() => {
        expect(result.current.state.isRejecting).toBe(true);
      });

      await act(async () => {
        resolveReject({ success: true });
        await rejectPromise;
      });

      expect(result.current.state.isRejecting).toBe(false);
    });

    it("should work with undefined userId", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(undefined));

      let rejectResult: boolean;
      await act(async () => {
        rejectResult = await result.current.reject(mockTransactionId);
      });

      // Reject should work without userId (unlike approve)
      expect(rejectResult!).toBe(true);
      expect(transactionService.reject).toHaveBeenCalledWith(mockTransactionId, undefined, undefined);
    });

    it("should handle service error response", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({
        success: false,
        error: "Unauthorized",
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let rejectResult: boolean;
      await act(async () => {
        rejectResult = await result.current.reject(mockTransactionId);
      });

      expect(rejectResult!).toBe(false);
      expect(result.current.state.error).toBe("Unauthorized");
    });

    it("should handle service error with default message", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({
        success: false,
        error: undefined,
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.reject(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Failed to reject transaction");
    });

    it("should handle thrown errors", async () => {
      (transactionService.reject as jest.Mock).mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.reject(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Database error");
    });

    it("should handle non-Error thrown values", async () => {
      (transactionService.reject as jest.Mock).mockRejectedValue(42);

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.reject(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Failed to reject transaction");
    });

    it("should call onSuccess callback on success", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({ success: true });
      const onSuccess = jest.fn();

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.reject(mockTransactionId, undefined, { onSuccess });
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should call onError callback on failure", async () => {
      (transactionService.reject as jest.Mock).mockResolvedValue({
        success: false,
        error: "Validation failed",
      });
      const onError = jest.fn();

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.reject(mockTransactionId, undefined, { onError });
      });

      expect(onError).toHaveBeenCalledWith("Validation failed");
    });
  });

  describe("restore", () => {
    it("should restore a transaction successfully", async () => {
      (transactionService.restore as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.restore(mockTransactionId);
      });

      expect(restoreResult!).toBe(true);
      expect(result.current.state.isRestoring).toBe(false);
      expect(result.current.state.error).toBeNull();
      expect(transactionService.restore).toHaveBeenCalledWith(mockTransactionId, mockUserId);
    });

    it("should set isRestoring to true during operation", async () => {
      let resolveRestore: (value: { success: boolean }) => void;
      (transactionService.restore as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRestore = resolve;
          })
      );

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let restorePromise: Promise<boolean>;
      act(() => {
        restorePromise = result.current.restore(mockTransactionId);
      });

      await waitFor(() => {
        expect(result.current.state.isRestoring).toBe(true);
      });

      await act(async () => {
        resolveRestore({ success: true });
        await restorePromise;
      });

      expect(result.current.state.isRestoring).toBe(false);
    });

    it("should work with undefined userId", async () => {
      (transactionService.restore as jest.Mock).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(undefined));

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.restore(mockTransactionId);
      });

      expect(restoreResult!).toBe(true);
      expect(transactionService.restore).toHaveBeenCalledWith(mockTransactionId, undefined);
    });

    it("should handle service error response", async () => {
      (transactionService.restore as jest.Mock).mockResolvedValue({
        success: false,
        error: "Transaction already active",
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      let restoreResult: boolean;
      await act(async () => {
        restoreResult = await result.current.restore(mockTransactionId);
      });

      expect(restoreResult!).toBe(false);
      expect(result.current.state.error).toBe("Transaction already active");
    });

    it("should handle service error with default message", async () => {
      (transactionService.restore as jest.Mock).mockResolvedValue({
        success: false,
        error: undefined,
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.restore(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Failed to restore transaction");
    });

    it("should handle thrown errors", async () => {
      (transactionService.restore as jest.Mock).mockRejectedValue(new Error("Connection lost"));

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.restore(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Connection lost");
    });

    it("should handle non-Error thrown values", async () => {
      (transactionService.restore as jest.Mock).mockRejectedValue(null);

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.restore(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Failed to restore transaction");
    });

    it("should call onSuccess callback on success", async () => {
      (transactionService.restore as jest.Mock).mockResolvedValue({ success: true });
      const onSuccess = jest.fn();

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.restore(mockTransactionId, { onSuccess });
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should call onError callback on failure", async () => {
      (transactionService.restore as jest.Mock).mockRejectedValue(new Error("Restore failed"));
      const onError = jest.fn();

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.restore(mockTransactionId, { onError });
      });

      expect(onError).toHaveBeenCalledWith("Restore failed");
    });
  });

  describe("clearError", () => {
    it("should clear error state", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({
        success: false,
        error: "Some error",
      });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      // First create an error
      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(result.current.state.error).toBe("Some error");

      // Now clear it
      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });

    it("should be idempotent when no error exists", () => {
      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe("concurrent operations", () => {
    it("should handle approve clearing previous error", async () => {
      // First call fails
      (transactionService.approve as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: "First error",
      });
      // Second call succeeds
      (transactionService.approve as jest.Mock).mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(result.current.state.error).toBe("First error");

      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(result.current.state.error).toBeNull();
    });

    it("should track independent operation states", async () => {
      let resolveApprove: (value: { success: boolean }) => void;
      let resolveReject: (value: { success: boolean }) => void;

      (transactionService.approve as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveApprove = resolve; })
      );
      (transactionService.reject as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveReject = resolve; })
      );

      const { result } = renderHook(() => useTransactionStatusUpdate(mockUserId));

      // Start both operations
      let approvePromise: Promise<boolean>;
      let rejectPromise: Promise<boolean>;
      act(() => {
        approvePromise = result.current.approve(mockTransactionId);
        rejectPromise = result.current.reject("other-txn");
      });

      await waitFor(() => {
        expect(result.current.state.isApproving).toBe(true);
        expect(result.current.state.isRejecting).toBe(true);
      });

      // Resolve approve first
      await act(async () => {
        resolveApprove({ success: true });
        await approvePromise;
      });

      expect(result.current.state.isApproving).toBe(false);
      expect(result.current.state.isRejecting).toBe(true);

      // Resolve reject
      await act(async () => {
        resolveReject({ success: true });
        await rejectPromise;
      });

      expect(result.current.state.isRejecting).toBe(false);
    });
  });

  describe("userId dependency", () => {
    it("should use updated userId when it changes", async () => {
      (transactionService.approve as jest.Mock).mockResolvedValue({ success: true });

      const { result, rerender } = renderHook(
        ({ userId }) => useTransactionStatusUpdate(userId),
        { initialProps: { userId: "user-1" } }
      );

      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(transactionService.approve).toHaveBeenCalledWith(mockTransactionId, "user-1");

      // Change userId
      rerender({ userId: "user-2" });

      await act(async () => {
        await result.current.approve(mockTransactionId);
      });

      expect(transactionService.approve).toHaveBeenLastCalledWith(mockTransactionId, "user-2");
    });
  });
});
