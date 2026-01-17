/**
 * Tests for TransactionMessagesTab component
 * Verifies rendering of loading, empty, error, and thread-based message list states
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TransactionMessagesTab } from "../TransactionMessagesTab";
import type { Communication } from "../../types";

// Mock the window.api
const mockUnlinkMessages = jest.fn();
const mockGetMessageContacts = jest.fn();
const mockGetMessagesByContact = jest.fn();
const mockLinkMessages = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "api", {
    value: {
      transactions: {
        unlinkMessages: mockUnlinkMessages,
        getMessageContacts: mockGetMessageContacts,
        getMessagesByContact: mockGetMessagesByContact,
        linkMessages: mockLinkMessages,
      },
    },
    writable: true,
  });
});

describe("TransactionMessagesTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnlinkMessages.mockResolvedValue({ success: true });
    mockGetMessageContacts.mockResolvedValue({ success: true, contacts: [] });
    mockGetMessagesByContact.mockResolvedValue({ success: true, messages: [] });
    mockLinkMessages.mockResolvedValue({ success: true });
  });

  // Mock messages for testing
  const mockMessages: Partial<Communication>[] = [
    {
      id: "msg-1",
      user_id: "user-456",
      channel: "sms",
      body_text: "Got your message about the property!",
      sent_at: "2024-01-16T11:00:00Z",
      direction: "inbound",
      thread_id: "thread-1",
      participants: JSON.stringify({ from: "+14155550100", to: ["+14155550101"] }),
      has_attachments: false,
      is_false_positive: false,
    },
    {
      id: "msg-2",
      user_id: "user-456",
      channel: "imessage",
      body_text: "Can we schedule a showing tomorrow?",
      sent_at: "2024-01-17T12:00:00Z",
      direction: "outbound",
      thread_id: "thread-1",
      participants: JSON.stringify({ from: "+14155550101", to: ["+14155550100"] }),
      has_attachments: false,
      is_false_positive: false,
    },
    {
      id: "msg-3",
      user_id: "user-456",
      channel: "sms",
      body_text: "Thanks for the update!",
      sent_at: "2024-01-19T09:00:00Z",
      direction: "inbound",
      thread_id: "thread-2",
      participants: JSON.stringify({ from: "+14155550200", to: ["+14155550101"] }),
      has_attachments: false,
      is_false_positive: false,
    },
  ];

  describe("loading state", () => {
    it("should display loading spinner when loading is true", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={true}
          error={null}
        />
      );

      expect(screen.getByText("Loading messages...")).toBeInTheDocument();
    });

    it("should display spinning animation element", () => {
      const { container } = render(
        <TransactionMessagesTab
          messages={[]}
          loading={true}
          error={null}
        />
      );

      // Check for the spinner element with animate-spin class
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("should display error message when error is set", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error="Failed to load messages"
        />
      );

      expect(screen.getByText("Failed to load messages")).toBeInTheDocument();
    });

    it("should display support message with error", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error="Network error"
        />
      );

      expect(
        screen.getByText("Please try again or contact support if the issue persists.")
      ).toBeInTheDocument();
    });

    it("should display error icon", () => {
      const { container } = render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error="Some error"
        />
      );

      // Check for SVG with error color styling
      const errorIcon = container.querySelector("svg.text-red-300");
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should display empty state when no messages and not loading", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("No text messages linked")).toBeInTheDocument();
    });

    it("should display explanation text in empty state", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error={null}
        />
      );

      expect(
        screen.getByText(/Click.*Attach Messages.*to link message threads to this transaction/i)
      ).toBeInTheDocument();
    });

    it("should display message icon in empty state", () => {
      const { container } = render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error={null}
        />
      );

      // Check for SVG with gray styling
      const messageIcon = container.querySelector("svg.text-gray-300");
      expect(messageIcon).toBeInTheDocument();
    });
  });

  describe("messages list", () => {
    it("should display message count header when messages exist", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Text Messages (3)")).toBeInTheDocument();
    });

    it("should render thread cards with preview text for 1:1 chats", () => {
      // 1:1 chat messages - single external participant per thread
      const singleParticipantMessages: Partial<Communication>[] = [
        {
          id: "msg-1",
          user_id: "user-456",
          channel: "sms",
          body_text: "Single chat message 1",
          sent_at: "2024-01-16T11:00:00Z",
          direction: "inbound",
          thread_id: "thread-single",
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
          has_attachments: false,
          is_false_positive: false,
        },
        {
          id: "msg-2",
          user_id: "user-456",
          channel: "sms",
          body_text: "Single chat message 2",
          sent_at: "2024-01-17T12:00:00Z",
          direction: "outbound",
          thread_id: "thread-single",
          participants: JSON.stringify({ from: "me", to: ["+14155550100"] }),
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={singleParticipantMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // 1:1 chat should show preview text
      const preview = screen.getByTestId("thread-preview");
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveTextContent("Single chat message 2");
    });

    it("should render group chats without preview (different display)", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Mock data uses phone numbers for both from/to, making threads appear as group chats
      // (the real iMessage import uses "me" for the user's side)
      // Group chats display participant count and date range instead of preview text
      const threadCards = screen.getAllByTestId("message-thread-card");
      expect(threadCards.length).toBe(2);

      // Group chats no longer show "X people" badge - participant list at bottom instead
      const participantBadges = screen.queryAllByText(/\d+ people/);
      expect(participantBadges.length).toBe(0);
      const participantNames = screen.getAllByTestId("thread-participants");
      expect(participantNames.length).toBeGreaterThanOrEqual(1);
    });

    it("should group messages into threads", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Should have thread list container
      expect(screen.getByTestId("message-thread-list")).toBeInTheDocument();

      // Should have 2 thread cards (thread-1 and thread-2)
      const threadCards = screen.getAllByTestId("message-thread-card");
      expect(threadCards.length).toBe(2);
    });

    it("should display conversation count when multiple threads", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Should show "in 2 conversations"
      expect(screen.getByText("in 2 conversations")).toBeInTheDocument();
    });

    it("should display phone numbers as thread headers", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Thread headers should show phone numbers from participants
      const contactNames = screen.getAllByTestId("thread-contact-name");
      expect(contactNames.length).toBe(2);
    });

    it("should handle messages without thread_id", () => {
      const messagesWithoutThreadId: Partial<Communication>[] = [
        {
          id: "solo-msg-1",
          user_id: "user-456",
          channel: "sms",
          body_text: "Solo message 1",
          sent_at: "2024-01-16T11:00:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
        {
          id: "solo-msg-2",
          user_id: "user-456",
          channel: "sms",
          body_text: "Solo message 2",
          sent_at: "2024-01-17T11:00:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messagesWithoutThreadId as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Each message without thread_id should be in its own "thread"
      const threadCards = screen.getAllByTestId("message-thread-card");
      expect(threadCards.length).toBe(2);
    });

    it("should display Unknown for messages without participants", () => {
      const messageWithoutParticipants: Partial<Communication>[] = [
        {
          id: "no-participants",
          user_id: "user-456",
          channel: "sms",
          body_text: "Message without participants",
          sent_at: "2024-01-20T10:00:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messageWithoutParticipants as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Should show "Unknown" in the thread header
      expect(screen.getByTestId("thread-contact-name")).toHaveTextContent("Unknown");
    });

    it("should use legacy sender field as fallback", () => {
      const messageWithLegacySender: Partial<Communication>[] = [
        {
          id: "legacy-sender",
          user_id: "user-456",
          channel: "sms",
          body_text: "Message with legacy sender",
          sent_at: "2024-01-20T10:00:00Z",
          sender: "John Doe",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messageWithLegacySender as Communication[]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByTestId("thread-contact-name")).toHaveTextContent("John Doe");
    });
  });

  describe("thread card display", () => {
    it("should display View button to open conversation modal", () => {
      const inboundMessage: Partial<Communication>[] = [
        {
          id: "inbound-msg",
          user_id: "user-456",
          channel: "sms",
          body_text: "Inbound message",
          sent_at: "2024-01-20T10:00:00Z",
          direction: "inbound",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={inboundMessage as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Thread card should have View button
      expect(screen.getByTestId("toggle-thread-button")).toHaveTextContent("View");
    });

    it("should display message count badge", () => {
      const messages: Partial<Communication>[] = [
        {
          id: "msg-1",
          user_id: "user-456",
          channel: "sms",
          body_text: "Message 1",
          sent_at: "2024-01-20T10:00:00Z",
          direction: "outbound",
          thread_id: "thread-1",
          has_attachments: false,
          is_false_positive: false,
        },
        {
          id: "msg-2",
          user_id: "user-456",
          channel: "sms",
          body_text: "Message 2",
          sent_at: "2024-01-20T11:00:00Z",
          direction: "inbound",
          thread_id: "thread-1",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Should show message count
      expect(screen.getByText("2 messages")).toBeInTheDocument();
    });
  });

  describe("date formatting", () => {
    it("should render thread card for message with date", () => {
      const messageWithDate: Partial<Communication>[] = [
        {
          id: "dated-msg",
          user_id: "user-456",
          channel: "sms",
          body_text: "Dated message",
          sent_at: "2024-01-16T11:30:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messageWithDate as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Thread card should be rendered
      expect(screen.getByTestId("message-thread-card")).toBeInTheDocument();
      // Preview should show the message text
      expect(screen.getByTestId("thread-preview")).toHaveTextContent("Dated message");
    });

    it("should use received_at as fallback for date", () => {
      const messageWithReceivedAt: Partial<Communication>[] = [
        {
          id: "received-msg",
          user_id: "user-456",
          channel: "sms",
          body_text: "Received message",
          received_at: "2024-01-17T14:00:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messageWithReceivedAt as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Should render without error and show the message
      expect(screen.getByText("Received message")).toBeInTheDocument();
    });
  });

  describe("body text fallbacks", () => {
    it("should use body_plain as fallback", () => {
      const messageWithBodyPlain: Partial<Communication>[] = [
        {
          id: "plain-msg",
          user_id: "user-456",
          channel: "sms",
          body_plain: "Plain body content",
          sent_at: "2024-01-20T10:00:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messageWithBodyPlain as Communication[]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Plain body content")).toBeInTheDocument();
    });

    it("should use body as final fallback", () => {
      const messageWithBody: Partial<Communication>[] = [
        {
          id: "body-msg",
          user_id: "user-456",
          channel: "sms",
          body: "Legacy body content",
          sent_at: "2024-01-20T10:00:00Z",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messageWithBody as Communication[]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Legacy body content")).toBeInTheDocument();
    });
  });

  describe("thread sorting", () => {
    it("should sort threads by most recent message", () => {
      // Thread 1 has older messages, Thread 2 has newer
      const messagesForSorting: Partial<Communication>[] = [
        {
          id: "old-msg",
          user_id: "user-456",
          channel: "sms",
          body_text: "Old message",
          sent_at: "2024-01-15T10:00:00Z",
          thread_id: "thread-old",
          has_attachments: false,
          is_false_positive: false,
        },
        {
          id: "new-msg",
          user_id: "user-456",
          channel: "sms",
          body_text: "New message",
          sent_at: "2024-01-17T10:00:00Z",
          thread_id: "thread-new",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={messagesForSorting as Communication[]}
          loading={false}
          error={null}
        />
      );

      const threadCards = screen.getAllByTestId("message-thread-card");
      // Newest thread should be first
      expect(threadCards[0]).toHaveAttribute("data-thread-id", "thread-new");
      expect(threadCards[1]).toHaveAttribute("data-thread-id", "thread-old");
    });
  });

  describe("unlink flow", () => {
    const messagesWithUserId: Partial<Communication>[] = [
      {
        id: "msg-1",
        user_id: "user-456",
        channel: "sms",
        body_text: "Test message 1",
        sent_at: "2024-01-16T11:00:00Z",
        direction: "inbound",
        thread_id: "thread-1",
        participants: JSON.stringify({ from: "+14155550100", to: ["+14155550101"] }),
        has_attachments: false,
        is_false_positive: false,
      },
      {
        id: "msg-2",
        user_id: "user-456",
        channel: "sms",
        body_text: "Test message 2",
        sent_at: "2024-01-17T11:00:00Z",
        direction: "outbound",
        thread_id: "thread-1",
        participants: JSON.stringify({ from: "+14155550101", to: ["+14155550100"] }),
        has_attachments: false,
        is_false_positive: false,
      },
    ];

    it("should show unlink button when userId and transactionId are provided", () => {
      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
        />
      );

      // Unlink button should be visible
      expect(screen.getByTestId("unlink-thread-button")).toBeInTheDocument();
    });

    it("should not show unlink button when userId or transactionId is missing", () => {
      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Unlink button should not exist
      expect(screen.queryByTestId("unlink-thread-button")).not.toBeInTheDocument();
    });

    it("should open unlink confirmation modal when unlink button is clicked", () => {
      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
        />
      );

      // Click the unlink button
      fireEvent.click(screen.getByTestId("unlink-thread-button"));

      // Modal should appear
      expect(screen.getByTestId("unlink-message-modal")).toBeInTheDocument();
      expect(screen.getByText("Remove Messages from Transaction?")).toBeInTheDocument();
    });

    it("should show phone number and message count in unlink modal", () => {
      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
        />
      );

      fireEvent.click(screen.getByTestId("unlink-thread-button"));

      // Should show modal with correct message count
      const modal = screen.getByTestId("unlink-message-modal");
      expect(modal).toBeInTheDocument();
      // Modal should contain the phone number somewhere
      expect(modal).toHaveTextContent("+14155550100");
      expect(modal).toHaveTextContent("2 messages");
    });

    it("should close modal when cancel is clicked", () => {
      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
        />
      );

      fireEvent.click(screen.getByTestId("unlink-thread-button"));
      expect(screen.getByTestId("unlink-message-modal")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("unlink-cancel-button"));
      expect(screen.queryByTestId("unlink-message-modal")).not.toBeInTheDocument();
    });

    it("should call unlinkMessages API when confirmed", async () => {
      const mockOnMessagesChanged = jest.fn();
      const mockOnShowSuccess = jest.fn();

      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
          onMessagesChanged={mockOnMessagesChanged}
          onShowSuccess={mockOnShowSuccess}
        />
      );

      fireEvent.click(screen.getByTestId("unlink-thread-button"));
      fireEvent.click(screen.getByTestId("unlink-confirm-button"));

      await waitFor(() => {
        expect(mockUnlinkMessages).toHaveBeenCalledWith(["msg-1", "msg-2"]);
      });

      await waitFor(() => {
        expect(mockOnShowSuccess).toHaveBeenCalledWith("Messages removed from transaction");
        expect(mockOnMessagesChanged).toHaveBeenCalled();
      });
    });

    it("should show error message when unlink fails", async () => {
      mockUnlinkMessages.mockResolvedValue({
        success: false,
        error: "Network error occurred",
      });

      const mockOnShowError = jest.fn();

      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
          onShowError={mockOnShowError}
        />
      );

      fireEvent.click(screen.getByTestId("unlink-thread-button"));
      fireEvent.click(screen.getByTestId("unlink-confirm-button"));

      await waitFor(() => {
        expect(mockOnShowError).toHaveBeenCalledWith("Network error occurred");
      });
    });

    it("should handle API exception during unlink", async () => {
      mockUnlinkMessages.mockRejectedValue(new Error("Connection failed"));

      const mockOnShowError = jest.fn();

      render(
        <TransactionMessagesTab
          messages={messagesWithUserId as Communication[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
          onShowError={mockOnShowError}
        />
      );

      fireEvent.click(screen.getByTestId("unlink-thread-button"));
      fireEvent.click(screen.getByTestId("unlink-confirm-button"));

      await waitFor(() => {
        expect(mockOnShowError).toHaveBeenCalledWith("Connection failed");
      });
    });
  });

  describe("attach flow", () => {
    it("should show Attach Messages button when userId and transactionId are provided", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
        />
      );

      expect(screen.getByTestId("attach-messages-button")).toBeInTheDocument();
    });

    it("should not show Attach Messages button when userId or transactionId is missing", () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error={null}
        />
      );

      expect(screen.queryByTestId("attach-messages-button")).not.toBeInTheDocument();
    });

    it("should open attach modal when Attach Messages button is clicked", async () => {
      render(
        <TransactionMessagesTab
          messages={[]}
          loading={false}
          error={null}
          userId="user-456"
          transactionId="txn-123"
        />
      );

      fireEvent.click(screen.getByTestId("attach-messages-button"));

      await waitFor(() => {
        expect(screen.getByTestId("attach-messages-modal")).toBeInTheDocument();
      });
    });
  });
});
