/**
 * Tests for MessageBubble component
 * Verifies rendering of inbound/outbound messages with proper styling
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MessageBubble } from "../MessageBubble";
import type { Communication } from "../../types";

describe("MessageBubble", () => {
  // Base mock message for testing
  const createMockMessage = (overrides: Partial<Communication> = {}): Communication => ({
    id: "msg-1",
    user_id: "user-123",
    channel: "sms",
    direction: "inbound",
    body_text: "Hello, this is a test message",
    sent_at: "2024-01-16T14:30:00Z",
    has_attachments: false,
    is_false_positive: false,
    ...overrides,
  } as Communication);

  describe("rendering", () => {
    it("should render message content", () => {
      const message = createMockMessage({ body_text: "Test message content" });

      render(<MessageBubble message={message} />);

      expect(screen.getByText("Test message content")).toBeInTheDocument();
    });

    it("should render with data-testid", () => {
      const message = createMockMessage();

      render(<MessageBubble message={message} />);

      expect(screen.getByTestId("message-bubble")).toBeInTheDocument();
    });

    it("should include direction data attribute", () => {
      const message = createMockMessage({ direction: "inbound" });

      render(<MessageBubble message={message} />);

      expect(screen.getByTestId("message-bubble")).toHaveAttribute(
        "data-direction",
        "inbound"
      );
    });
  });

  describe("inbound messages", () => {
    it("should align to the left", () => {
      const message = createMockMessage({ direction: "inbound" });

      render(<MessageBubble message={message} />);

      const bubble = screen.getByTestId("message-bubble");
      expect(bubble).toHaveClass("justify-start");
    });

    it("should have gray background styling", () => {
      const message = createMockMessage({ direction: "inbound" });

      const { container } = render(<MessageBubble message={message} />);

      const bubbleContent = container.querySelector(".bg-gray-200");
      expect(bubbleContent).toBeInTheDocument();
    });
  });

  describe("undefined direction (safe default)", () => {
    it("should align to the left when direction is undefined", () => {
      const message = createMockMessage({ direction: undefined });

      render(<MessageBubble message={message} />);

      const bubble = screen.getByTestId("message-bubble");
      expect(bubble).toHaveClass("justify-start");
    });

    it("should have gray background when direction is undefined", () => {
      const message = createMockMessage({ direction: undefined });

      const { container } = render(<MessageBubble message={message} />);

      const bubbleContent = container.querySelector(".bg-gray-200");
      expect(bubbleContent).toBeInTheDocument();
    });
  });

  describe("outbound messages", () => {
    it("should align to the right", () => {
      const message = createMockMessage({ direction: "outbound" });

      render(<MessageBubble message={message} />);

      const bubble = screen.getByTestId("message-bubble");
      expect(bubble).toHaveClass("justify-end");
    });

    it("should have blue background styling", () => {
      const message = createMockMessage({ direction: "outbound" });

      const { container } = render(<MessageBubble message={message} />);

      const bubbleContent = container.querySelector(".bg-blue-500");
      expect(bubbleContent).toBeInTheDocument();
    });

    it("should have white text", () => {
      const message = createMockMessage({ direction: "outbound" });

      const { container } = render(<MessageBubble message={message} />);

      const bubbleContent = container.querySelector(".text-white");
      expect(bubbleContent).toBeInTheDocument();
    });
  });

  describe("timestamp display", () => {
    it("should display formatted timestamp", () => {
      const message = createMockMessage({ sent_at: "2024-01-16T14:30:00Z" });

      render(<MessageBubble message={message} />);

      // Should show time (format depends on locale)
      expect(screen.getByTestId("message-timestamp")).toBeInTheDocument();
    });

    it("should use received_at as fallback for inbound", () => {
      const message = createMockMessage({
        direction: "inbound",
        sent_at: undefined,
        received_at: "2024-01-16T15:00:00Z",
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByTestId("message-timestamp")).toBeInTheDocument();
    });

    it("should handle missing timestamps gracefully", () => {
      const message = createMockMessage({
        sent_at: undefined,
        received_at: undefined,
      });

      render(<MessageBubble message={message} />);

      // Should not show timestamp element when no timestamp
      expect(screen.queryByTestId("message-timestamp")).not.toBeInTheDocument();
    });
  });

  describe("body text fallbacks", () => {
    it("should use body_text as primary content", () => {
      const message = createMockMessage({
        body_text: "Primary text",
        body_plain: "Fallback text",
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByText("Primary text")).toBeInTheDocument();
      expect(screen.queryByText("Fallback text")).not.toBeInTheDocument();
    });

    it("should use body_plain as fallback", () => {
      const message = createMockMessage({
        body_text: undefined,
        body_plain: "Fallback plain text",
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByText("Fallback plain text")).toBeInTheDocument();
    });

    it("should use body as final fallback", () => {
      const message = createMockMessage({
        body_text: undefined,
        body_plain: undefined,
        body: "Legacy body content",
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByText("Legacy body content")).toBeInTheDocument();
    });

    it("should handle empty body gracefully", () => {
      const message = createMockMessage({
        body_text: undefined,
        body_plain: undefined,
        body: undefined,
      });

      render(<MessageBubble message={message} />);

      // Should render without error
      expect(screen.getByTestId("message-bubble")).toBeInTheDocument();
    });
  });

  describe("text formatting", () => {
    it("should preserve whitespace in messages", () => {
      const message = createMockMessage({
        body_text: "Line 1\nLine 2\nLine 3",
      });

      const { container } = render(<MessageBubble message={message} />);

      const textElement = container.querySelector(".whitespace-pre-wrap");
      expect(textElement).toBeInTheDocument();
    });

    it("should handle long messages with word break", () => {
      const longWord = "A".repeat(100);
      const message = createMockMessage({ body_text: longWord });

      const { container } = render(<MessageBubble message={message} />);

      const textElement = container.querySelector(".break-words");
      expect(textElement).toBeInTheDocument();
    });
  });
});
