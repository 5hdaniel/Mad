/**
 * Unit tests for useConversations hook
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useConversations, Conversation } from "../useConversations";

describe("useConversations", () => {
  const mockConversations: Conversation[] = [
    {
      id: "1",
      name: "John Doe",
      directChatCount: 1,
      groupChatCount: 0,
      directMessageCount: 10,
      groupMessageCount: 0,
      lastMessageDate: new Date("2024-01-01"),
    },
    {
      id: "2",
      name: "Jane Smith",
      directChatCount: 1,
      groupChatCount: 0,
      directMessageCount: 5,
      groupMessageCount: 0,
      lastMessageDate: new Date("2024-01-02"),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation before each test
    (window.electron.getConversations as jest.Mock).mockReset();
  });

  describe("initial loading", () => {
    it("should start in loading state", async () => {
      // Mock a slow response
      (window.electron.getConversations as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ success: true, conversations: [] }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useConversations());

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.conversations).toEqual([]);
      expect(result.current.error).toBeNull();

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should load conversations on mount", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: true,
        conversations: mockConversations,
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.conversations).toEqual(mockConversations);
      expect(result.current.error).toBeNull();
      expect(window.electron.getConversations).toHaveBeenCalledTimes(1);
    });
  });

  describe("success handling", () => {
    it("should set conversations on successful response", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: true,
        conversations: mockConversations,
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.conversations[0].name).toBe("John Doe");
    });

    it("should handle empty conversations array", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: true,
        conversations: [],
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.conversations).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle undefined conversations", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: true,
        conversations: undefined,
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.conversations).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should set error on failed response", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: false,
        error: "Permission denied",
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Permission denied");
      expect(result.current.conversations).toEqual([]);
    });

    it("should handle thrown errors", async () => {
      (window.electron.getConversations as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Network error");
    });

    it("should handle non-Error thrown values", async () => {
      (window.electron.getConversations as jest.Mock).mockRejectedValue(
        "String error",
      );

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Unknown error occurred");
    });

    it("should use default error message when none provided", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: false,
        error: undefined,
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load contacts");
    });
  });

  describe("reload", () => {
    it("should reload conversations when called", async () => {
      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: true,
        conversations: mockConversations,
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(window.electron.getConversations).toHaveBeenCalledTimes(1);

      // Update mock for reload
      const newConversations = [
        ...mockConversations,
        {
          id: "3",
          name: "New Person",
          directChatCount: 1,
          groupChatCount: 0,
          directMessageCount: 3,
          groupMessageCount: 0,
          lastMessageDate: new Date(),
        },
      ];

      (window.electron.getConversations as jest.Mock).mockResolvedValue({
        success: true,
        conversations: newConversations,
      });

      await act(async () => {
        await result.current.reload();
      });

      expect(window.electron.getConversations).toHaveBeenCalledTimes(2);
      expect(result.current.conversations).toHaveLength(3);
    });

    it("should clear previous error on reload", async () => {
      // First call fails
      (window.electron.getConversations as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: "Initial error",
      });

      const { result } = renderHook(() => useConversations());

      await waitFor(() => {
        expect(result.current.error).toBe("Initial error");
      });

      // Second call succeeds
      (window.electron.getConversations as jest.Mock).mockResolvedValueOnce({
        success: true,
        conversations: mockConversations,
      });

      await act(async () => {
        await result.current.reload();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.conversations).toHaveLength(2);
    });
  });
});
