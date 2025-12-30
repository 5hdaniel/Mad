/**
 * Tests for useTransactionMessages hook
 * Verifies fetching and filtering of text messages (SMS/iMessage)
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useTransactionMessages } from "../useTransactionMessages";
import type { Transaction, Communication } from "@/types";

describe("useTransactionMessages", () => {
  // Mock transaction for testing
  const mockTransaction: Transaction = {
    id: "txn-123",
    user_id: "user-456",
    property_address: "123 Main Street",
    status: "active",
    message_count: 10,
    attachment_count: 5,
    export_status: "not_exported",
    export_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  // Mock communications with different channels
  const mockCommunications: Partial<Communication>[] = [
    {
      id: "comm-1",
      user_id: "user-456",
      channel: "email",
      subject: "RE: Offer on 123 Main Street",
      body_text: "Email content here",
      sent_at: "2024-01-15T10:00:00Z",
      has_attachments: false,
      is_false_positive: false,
    },
    {
      id: "comm-2",
      user_id: "user-456",
      channel: "sms",
      body_text: "Got your message about the property!",
      sent_at: "2024-01-16T11:00:00Z",
      direction: "inbound",
      participants: JSON.stringify({ from: "+14155550100", to: ["+14155550101"] }),
      has_attachments: false,
      is_false_positive: false,
    },
    {
      id: "comm-3",
      user_id: "user-456",
      channel: "imessage",
      body_text: "Can we schedule a showing tomorrow?",
      sent_at: "2024-01-17T12:00:00Z",
      direction: "outbound",
      participants: JSON.stringify({ from: "+14155550101", to: ["+14155550100"] }),
      has_attachments: false,
      is_false_positive: false,
    },
    {
      id: "comm-4",
      user_id: "user-456",
      channel: "email",
      subject: "Inspection Report",
      body_text: "Please find the inspection report attached.",
      sent_at: "2024-01-18T14:00:00Z",
      has_attachments: true,
      is_false_positive: false,
    },
    {
      id: "comm-5",
      user_id: "user-456",
      channel: "sms",
      body_text: "Thanks for the update!",
      sent_at: "2024-01-19T09:00:00Z",
      direction: "inbound",
      has_attachments: false,
      is_false_positive: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    window.api.transactions.getDetails.mockResolvedValue({
      success: true,
      transaction: {
        ...mockTransaction,
        communications: mockCommunications,
        contact_assignments: [],
      },
    });
  });

  describe("initial state", () => {
    it("should start with loading true and empty messages", () => {
      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      // Initial state should be loading
      expect(result.current.loading).toBe(true);
      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should have a refresh function", () => {
      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      expect(typeof result.current.refresh).toBe("function");
    });
  });

  describe("fetching messages", () => {
    it("should call transactions.getDetails with correct transaction id", async () => {
      renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(window.api.transactions.getDetails).toHaveBeenCalledWith("txn-123");
      });
    });

    it("should filter out email communications and only return SMS/iMessage", async () => {
      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only have 3 messages (2 SMS + 1 iMessage), no emails
      expect(result.current.messages).toHaveLength(3);

      // Verify no emails are included
      const channels = result.current.messages.map((m) => m.channel);
      expect(channels).not.toContain("email");
      expect(channels).toContain("sms");
      expect(channels).toContain("imessage");
    });

    it("should set loading to false after fetch completes", async () => {
      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it("should handle empty communications array", async () => {
      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: {
          ...mockTransaction,
          communications: [],
          contact_assignments: [],
        },
      });

      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle only email communications (no text messages)", async () => {
      const emailOnlyCommunications = mockCommunications.filter(
        (c) => c.channel === "email"
      );

      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: {
          ...mockTransaction,
          communications: emailOnlyCommunications,
          contact_assignments: [],
        },
      });

      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // No text messages should be returned
      expect(result.current.messages).toEqual([]);
    });

    it("should handle missing communications in response", async () => {
      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: {
          ...mockTransaction,
          // communications field missing entirely
        },
      });

      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should set error message when API call fails", async () => {
      window.api.transactions.getDetails.mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load messages");
      expect(result.current.messages).toEqual([]);
    });

    it("should handle unsuccessful API response", async () => {
      window.api.transactions.getDetails.mockResolvedValue({
        success: false,
        error: "Transaction not found",
      });

      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return empty messages on unsuccessful response
      expect(result.current.messages).toEqual([]);
    });
  });

  describe("refresh function", () => {
    it("should refetch messages when refresh is called", async () => {
      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(window.api.transactions.getDetails).toHaveBeenCalledTimes(1);

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(window.api.transactions.getDetails).toHaveBeenCalledTimes(2);
    });

    it("should update messages with new data after refresh", async () => {
      const { result } = renderHook(() => useTransactionMessages(mockTransaction));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toHaveLength(3);

      // Update mock to return different data
      const newMessage: Partial<Communication> = {
        id: "comm-6",
        user_id: "user-456",
        channel: "sms",
        body_text: "New message!",
        sent_at: "2024-01-20T10:00:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      window.api.transactions.getDetails.mockResolvedValue({
        success: true,
        transaction: {
          ...mockTransaction,
          communications: [...mockCommunications, newMessage],
          contact_assignments: [],
        },
      });

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      // Should now have 4 text messages (3 original + 1 new)
      expect(result.current.messages).toHaveLength(4);
    });
  });

  describe("transaction change", () => {
    it("should refetch when transaction id changes", async () => {
      const { result, rerender } = renderHook(
        ({ transaction }) => useTransactionMessages(transaction),
        { initialProps: { transaction: mockTransaction } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(window.api.transactions.getDetails).toHaveBeenCalledWith("txn-123");

      // Change transaction
      const newTransaction = { ...mockTransaction, id: "txn-456" };
      rerender({ transaction: newTransaction });

      await waitFor(() => {
        expect(window.api.transactions.getDetails).toHaveBeenCalledWith("txn-456");
      });
    });
  });
});
