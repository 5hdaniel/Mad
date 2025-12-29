/**
 * Tests for TransactionMessagesTab component
 * Verifies rendering of loading, empty, error, and message list states
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
        screen.getByText("Messages will appear here once linked to this transaction")
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

    it("should display channel badge for each message", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Should have SMS and iMessage badges
      const smsBadges = screen.getAllByText("sms");
      expect(smsBadges.length).toBeGreaterThanOrEqual(2);

      expect(screen.getByText("imessage")).toBeInTheDocument();
    });

    it("should display direction badges", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // Check for direction indicators
      const receivedBadges = screen.getAllByText("Received");
      expect(receivedBadges.length).toBe(2); // 2 inbound messages

      expect(screen.getByText("Sent")).toBeInTheDocument(); // 1 outbound message
    });

    it("should display sender information from participants", () => {
      render(
        <TransactionMessagesTab
          messages={mockMessages as Communication[]}
          loading={false}
          error={null}
        />
      );

      // First message has a phone number in participants
      expect(screen.getByText("+14155550100")).toBeInTheDocument();
    });

    it("should truncate long message bodies", () => {
      const longMessage: Partial<Communication> = {
        id: "long-msg",
        user_id: "user-456",
        channel: "sms",
        body_text: "A".repeat(200), // 200 characters
        sent_at: "2024-01-20T10:00:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[longMessage as Communication]}
          loading={false}
          error={null}
        />
      );

      // Message should be truncated with ellipsis
      const messageText = screen.getByText(/^A+\.\.\.$/);
      expect(messageText).toBeInTheDocument();
    });

    it("should handle messages without participants gracefully", () => {
      const messageWithoutParticipants: Partial<Communication> = {
        id: "no-participants",
        user_id: "user-456",
        channel: "sms",
        body_text: "Message without participants field",
        sent_at: "2024-01-20T10:00:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[messageWithoutParticipants as Communication]}
          loading={false}
          error={null}
        />
      );

      // Should show "Unknown" as sender
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("should use legacy sender field as fallback", () => {
      const messageWithLegacySender: Partial<Communication> = {
        id: "legacy-sender",
        user_id: "user-456",
        channel: "sms",
        body_text: "Message with legacy sender",
        sent_at: "2024-01-20T10:00:00Z",
        sender: "John Doe",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[messageWithLegacySender as Communication]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  describe("date formatting", () => {
    it("should format message dates correctly", () => {
      const messageWithDate: Partial<Communication> = {
        id: "dated-msg",
        user_id: "user-456",
        channel: "sms",
        body_text: "Dated message",
        sent_at: "2024-01-16T11:30:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[messageWithDate as Communication]}
          loading={false}
          error={null}
        />
      );

      // Date should be formatted (format depends on locale, but should include month and time)
      // Just verify something date-related is rendered
      const { container } = render(
        <TransactionMessagesTab
          messages={[messageWithDate as Communication]}
          loading={false}
          error={null}
        />
      );

      // Date element should exist
      const dateElement = container.querySelector(".text-gray-500");
      expect(dateElement).toBeInTheDocument();
    });

    it("should use received_at as fallback for date", () => {
      const messageWithReceivedAt: Partial<Communication> = {
        id: "received-msg",
        user_id: "user-456",
        channel: "sms",
        body_text: "Received message",
        received_at: "2024-01-17T14:00:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[messageWithReceivedAt as Communication]}
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
      const messageWithBodyPlain: Partial<Communication> = {
        id: "plain-msg",
        user_id: "user-456",
        channel: "sms",
        body_plain: "Plain body content",
        sent_at: "2024-01-20T10:00:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[messageWithBodyPlain as Communication]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Plain body content")).toBeInTheDocument();
    });

    it("should use body as final fallback", () => {
      const messageWithBody: Partial<Communication> = {
        id: "body-msg",
        user_id: "user-456",
        channel: "sms",
        body: "Legacy body content",
        sent_at: "2024-01-20T10:00:00Z",
        has_attachments: false,
        is_false_positive: false,
      };

      render(
        <TransactionMessagesTab
          messages={[messageWithBody as Communication]}
          loading={false}
          error={null}
        />
      );

      expect(screen.getByText("Legacy body content")).toBeInTheDocument();
    });
  });
});
