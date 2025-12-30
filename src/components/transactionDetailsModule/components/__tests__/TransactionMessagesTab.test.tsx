/**
 * Tests for TransactionMessagesTab component
 * Verifies rendering of loading, empty, error, and thread-based message list states
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TransactionMessagesTab } from "../TransactionMessagesTab";
import type { Communication } from "../../types";

describe("TransactionMessagesTab", () => {
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

    it("should render all messages", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Check for message content
      expect(screen.getByText("Got your message about the property!")).toBeInTheDocument();
      expect(screen.getByText("Can we schedule a showing tomorrow?")).toBeInTheDocument();
      expect(screen.getByText("Thanks for the update!")).toBeInTheDocument();
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

  describe("message bubble styling", () => {
    it("should render inbound messages with left alignment", () => {
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

      const messageBubble = screen.getByTestId("message-bubble");
      expect(messageBubble).toHaveClass("justify-start");
    });

    it("should render outbound messages with right alignment", () => {
      const outboundMessage: Partial<Communication>[] = [
        {
          id: "outbound-msg",
          user_id: "user-456",
          channel: "sms",
          body_text: "Outbound message",
          sent_at: "2024-01-20T10:00:00Z",
          direction: "outbound",
          has_attachments: false,
          is_false_positive: false,
        },
      ];

      render(
        <TransactionMessagesTab
          messages={outboundMessage as Communication[]}
          loading={false}
          error={null}
        />
      );

      const messageBubble = screen.getByTestId("message-bubble");
      expect(messageBubble).toHaveClass("justify-end");
    });
  });

  describe("date formatting", () => {
    it("should display timestamp in message bubbles", () => {
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

      // Timestamp element should exist
      expect(screen.getByTestId("message-timestamp")).toBeInTheDocument();
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
});
