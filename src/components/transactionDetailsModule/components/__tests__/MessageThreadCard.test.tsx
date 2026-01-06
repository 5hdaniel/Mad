/**
 * Tests for MessageThreadCard component and utility functions
 * Verifies thread display, grouping, and phone number extraction
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MessageThreadCard,
  groupMessagesByThread,
  extractPhoneFromThread,
  sortThreadsByRecent,
} from "../MessageThreadCard";
import type { Communication } from "../../types";

describe("MessageThreadCard", () => {
  // Helper to create mock messages
  const createMockMessage = (overrides: Partial<Communication> = {}): Communication => ({
    id: "msg-1",
    user_id: "user-123",
    channel: "sms",
    direction: "inbound",
    body_text: "Test message",
    sent_at: "2024-01-16T14:30:00Z",
    has_attachments: false,
    is_false_positive: false,
    ...overrides,
  } as Communication);

  describe("component rendering", () => {
    it("should render thread card with testid", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("message-thread-card")).toBeInTheDocument();
    });

    it("should include thread-id data attribute", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="my-thread-id"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("message-thread-card")).toHaveAttribute(
        "data-thread-id",
        "my-thread-id"
      );
    });

    it("should display phone number when no contact name", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("thread-contact-name")).toHaveTextContent(
        "+14155550100"
      );
    });

    it("should display contact name when provided", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          contactName="John Doe"
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("thread-contact-name")).toHaveTextContent(
        "John Doe"
      );
    });

    it("should display phone number below contact name when both provided", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          contactName="Jane Smith"
          phoneNumber="+14155550200"
        />
      );

      expect(screen.getByTestId("thread-contact-name")).toHaveTextContent(
        "Jane Smith"
      );
      expect(screen.getByTestId("thread-phone-number")).toHaveTextContent(
        "+14155550200"
      );
    });
  });

  describe("avatar display", () => {
    it("should show first letter of contact name as avatar", () => {
      const messages = [createMockMessage()];

      const { container } = render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          contactName="Alice"
          phoneNumber="+14155550100"
        />
      );

      const avatar = container.querySelector(
        ".bg-gradient-to-br.from-green-500.to-teal-600"
      );
      expect(avatar).toHaveTextContent("A");
    });

    it("should show hash symbol when no contact name", () => {
      const messages = [createMockMessage()];

      const { container } = render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const avatar = container.querySelector(
        ".bg-gradient-to-br.from-green-500.to-teal-600"
      );
      expect(avatar).toHaveTextContent("#");
    });
  });

  describe("message count badge", () => {
    it("should display singular 'message' for one message", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByText("1 message")).toBeInTheDocument();
    });

    it("should display plural 'messages' for multiple messages", () => {
      const messages = [
        createMockMessage({ id: "msg-1" }),
        createMockMessage({ id: "msg-2" }),
        createMockMessage({ id: "msg-3" }),
      ];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByText("3 messages")).toBeInTheDocument();
    });
  });

  describe("messages container", () => {
    it("should render messages container with testid", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("thread-messages")).toBeInTheDocument();
    });

    it("should render all messages", () => {
      const messages = [
        createMockMessage({ id: "msg-1", body_text: "First message" }),
        createMockMessage({ id: "msg-2", body_text: "Second message" }),
      ];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByText("First message")).toBeInTheDocument();
      expect(screen.getByText("Second message")).toBeInTheDocument();
    });

    it("should have scrollable container", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const messagesContainer = screen.getByTestId("thread-messages");
      expect(messagesContainer).toHaveClass("overflow-y-auto");
    });
  });
});

describe("groupMessagesByThread", () => {
  const createMockMessage = (overrides: Partial<Communication> = {}): Communication => ({
    id: "msg-1",
    user_id: "user-123",
    channel: "sms",
    has_attachments: false,
    is_false_positive: false,
    ...overrides,
  } as Communication);

  it("should group messages by thread_id", () => {
    const messages = [
      createMockMessage({ id: "msg-1", thread_id: "thread-A" }),
      createMockMessage({ id: "msg-2", thread_id: "thread-B" }),
      createMockMessage({ id: "msg-3", thread_id: "thread-A" }),
    ];

    const threads = groupMessagesByThread(messages);

    expect(threads.size).toBe(2);
    expect(threads.get("thread-A")?.length).toBe(2);
    expect(threads.get("thread-B")?.length).toBe(1);
  });

  it("should use message id as thread_id when no thread_id", () => {
    const messages = [
      createMockMessage({ id: "msg-solo-1" }),
      createMockMessage({ id: "msg-solo-2" }),
    ];

    const threads = groupMessagesByThread(messages);

    expect(threads.size).toBe(2);
    // Fallback key format is "msg-{id}"
    expect(threads.has("msg-msg-solo-1")).toBe(true);
    expect(threads.has("msg-msg-solo-2")).toBe(true);
  });

  it("should sort messages within thread chronologically", () => {
    const messages = [
      createMockMessage({
        id: "msg-2",
        thread_id: "thread-A",
        sent_at: "2024-01-16T15:00:00Z",
      }),
      createMockMessage({
        id: "msg-1",
        thread_id: "thread-A",
        sent_at: "2024-01-16T14:00:00Z",
      }),
      createMockMessage({
        id: "msg-3",
        thread_id: "thread-A",
        sent_at: "2024-01-16T16:00:00Z",
      }),
    ];

    const threads = groupMessagesByThread(messages);
    const threadMessages = threads.get("thread-A");

    expect(threadMessages?.[0].id).toBe("msg-1");
    expect(threadMessages?.[1].id).toBe("msg-2");
    expect(threadMessages?.[2].id).toBe("msg-3");
  });

  it("should handle messages with received_at only", () => {
    const messages = [
      createMockMessage({
        id: "msg-2",
        thread_id: "thread-A",
        received_at: "2024-01-16T15:00:00Z",
      }),
      createMockMessage({
        id: "msg-1",
        thread_id: "thread-A",
        received_at: "2024-01-16T14:00:00Z",
      }),
    ];

    const threads = groupMessagesByThread(messages);
    const threadMessages = threads.get("thread-A");

    expect(threadMessages?.[0].id).toBe("msg-1");
    expect(threadMessages?.[1].id).toBe("msg-2");
  });

  it("should return empty map for empty input", () => {
    const threads = groupMessagesByThread([]);
    expect(threads.size).toBe(0);
  });
});

describe("extractPhoneFromThread", () => {
  const createMockMessage = (overrides: Partial<Communication> = {}): Communication => ({
    id: "msg-1",
    user_id: "user-123",
    channel: "sms",
    has_attachments: false,
    is_false_positive: false,
    ...overrides,
  } as Communication);

  it("should extract from field for inbound messages", () => {
    const messages = [
      createMockMessage({
        direction: "inbound",
        participants: JSON.stringify({
          from: "+14155550100",
          to: ["+14155550101"],
        }),
      }),
    ];

    expect(extractPhoneFromThread(messages)).toBe("+14155550100");
  });

  it("should extract to field for outbound messages", () => {
    const messages = [
      createMockMessage({
        direction: "outbound",
        participants: JSON.stringify({
          from: "+14155550101",
          to: ["+14155550100"],
        }),
      }),
    ];

    expect(extractPhoneFromThread(messages)).toBe("+14155550100");
  });

  it("should fallback to sender field", () => {
    const messages = [
      createMockMessage({
        sender: "John Doe <john@example.com>",
      }),
    ];

    expect(extractPhoneFromThread(messages)).toBe(
      "John Doe <john@example.com>"
    );
  });

  it("should return Unknown when no identifiable info", () => {
    const messages = [createMockMessage()];
    expect(extractPhoneFromThread(messages)).toBe("Unknown");
  });

  it("should handle invalid JSON in participants", () => {
    const messages = [
      createMockMessage({
        participants: "invalid json",
        sender: "fallback@example.com",
      }),
    ];

    expect(extractPhoneFromThread(messages)).toBe("fallback@example.com");
  });

  it("should try multiple messages until phone found", () => {
    const messages = [
      createMockMessage({ id: "msg-1" }),
      createMockMessage({
        id: "msg-2",
        direction: "inbound",
        participants: JSON.stringify({
          from: "+14155550200",
          to: ["+14155550101"],
        }),
      }),
    ];

    expect(extractPhoneFromThread(messages)).toBe("+14155550200");
  });
});

describe("sortThreadsByRecent", () => {
  const createMockMessage = (overrides: Partial<Communication> = {}): Communication => ({
    id: "msg-1",
    user_id: "user-123",
    channel: "sms",
    has_attachments: false,
    is_false_positive: false,
    ...overrides,
  } as Communication);

  it("should sort threads by most recent message first", () => {
    const threads = new Map<string, Communication[]>([
      [
        "thread-old",
        [
          createMockMessage({
            id: "old-msg",
            sent_at: "2024-01-15T10:00:00Z",
          }),
        ],
      ],
      [
        "thread-new",
        [
          createMockMessage({
            id: "new-msg",
            sent_at: "2024-01-17T10:00:00Z",
          }),
        ],
      ],
      [
        "thread-middle",
        [
          createMockMessage({
            id: "mid-msg",
            sent_at: "2024-01-16T10:00:00Z",
          }),
        ],
      ],
    ]);

    const sorted = sortThreadsByRecent(threads);

    expect(sorted[0][0]).toBe("thread-new");
    expect(sorted[1][0]).toBe("thread-middle");
    expect(sorted[2][0]).toBe("thread-old");
  });

  it("should use last message in thread for sorting", () => {
    const threads = new Map<string, Communication[]>([
      [
        "thread-A",
        [
          createMockMessage({ id: "a1", sent_at: "2024-01-15T10:00:00Z" }),
          createMockMessage({ id: "a2", sent_at: "2024-01-15T11:00:00Z" }),
        ],
      ],
      [
        "thread-B",
        [
          createMockMessage({ id: "b1", sent_at: "2024-01-15T09:00:00Z" }),
          createMockMessage({ id: "b2", sent_at: "2024-01-15T12:00:00Z" }),
        ],
      ],
    ]);

    const sorted = sortThreadsByRecent(threads);

    // thread-B has the most recent last message (12:00)
    expect(sorted[0][0]).toBe("thread-B");
    expect(sorted[1][0]).toBe("thread-A");
  });

  it("should handle empty threads map", () => {
    const threads = new Map<string, Communication[]>();
    const sorted = sortThreadsByRecent(threads);
    expect(sorted).toEqual([]);
  });

  it("should use received_at as fallback", () => {
    const threads = new Map<string, Communication[]>([
      [
        "thread-sent",
        [
          createMockMessage({
            id: "sent-msg",
            sent_at: "2024-01-15T10:00:00Z",
          }),
        ],
      ],
      [
        "thread-received",
        [
          createMockMessage({
            id: "received-msg",
            received_at: "2024-01-16T10:00:00Z",
          }),
        ],
      ],
    ]);

    const sorted = sortThreadsByRecent(threads);

    expect(sorted[0][0]).toBe("thread-received");
  });
});
