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

    it("should display contact name without phone number in card (phone hidden for cleaner layout)", () => {
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
      // Phone number is intentionally not displayed in the card layout
      expect(screen.queryByTestId("thread-phone-number")).not.toBeInTheDocument();
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

  describe("date range display", () => {
    it("should render date range for individual chat", () => {
      const messages = [
        createMockMessage({ id: "msg-1", sent_at: "2024-01-15T10:00:00Z" }),
        createMockMessage({ id: "msg-2", sent_at: "2024-01-17T10:00:00Z" }),
      ];

      const { container } = render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          contactName="Jane Doe"
          phoneNumber="+14155550100"
        />
      );

      // Should show date range like "Jan 15 - Jan 17"
      expect(container.textContent).toMatch(/Jan\s+15\s*-\s*Jan\s+17/);
    });

    it("should render single date when all messages on same day", () => {
      const messages = [
        createMockMessage({ id: "msg-1", sent_at: "2024-01-15T10:00:00Z" }),
        createMockMessage({ id: "msg-2", sent_at: "2024-01-15T14:00:00Z" }),
      ];

      const { container } = render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      // Should show single date like "Jan 15" (not a range)
      expect(container.textContent).toMatch(/Jan\s+15/);
      // Should NOT contain a dash for date range
      const dateRangePattern = /Jan\s+15\s*-/;
      expect(container.textContent).not.toMatch(dateRangePattern);
    });
  });

  describe("view button and preview", () => {
    it("should show View button to open modal", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("toggle-thread-button")).toHaveTextContent("View");
    });

    it("should show preview text of last message", () => {
      const messages = [
        createMockMessage({ id: "msg-1", body_text: "This is a preview message" }),
      ];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("thread-preview")).toHaveTextContent("This is a preview message");
    });

    it("should truncate long preview text", () => {
      const longText = "A".repeat(100);
      const messages = [
        createMockMessage({ id: "msg-1", body_text: longText }),
      ];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const preview = screen.getByTestId("thread-preview");
      // Should be truncated to 60 chars + "..."
      expect(preview.textContent?.length).toBeLessThan(70);
      expect(preview.textContent).toContain("...");
    });
  });

  describe("group chat cards", () => {
    // Helper to create a group chat message with multiple participants
    const createGroupMessage = (overrides: Partial<Communication> = {}): Communication => ({
      id: "msg-1",
      user_id: "user-123",
      channel: "sms",
      direction: "inbound",
      body_text: "Group message content",
      sent_at: "2024-01-16T14:30:00Z",
      has_attachments: false,
      is_false_positive: false,
      participants: JSON.stringify({
        from: "+14155550100",
        to: ["+14155550101", "+14155550102"],
      }),
      ...overrides,
    } as Communication);

    it("should NOT render message count badge for group chat", () => {
      const messages = [
        createGroupMessage({ id: "msg-1" }),
        createGroupMessage({ id: "msg-2" }),
        createGroupMessage({ id: "msg-3" }),
      ];

      render(
        <MessageThreadCard
          threadId="group-thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      // Message count badge should NOT exist for group chats
      expect(screen.queryByTestId("group-message-count-badge")).not.toBeInTheDocument();
    });

    it("should render preview text for group chat", () => {
      const messages = [
        createGroupMessage({ id: "msg-1", body_text: "Group chat preview message" }),
      ];

      render(
        <MessageThreadCard
          threadId="group-thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      expect(screen.getByTestId("thread-preview")).toHaveTextContent("Group chat preview message");
    });

    it("should display participant names without 'Also includes:' prefix", () => {
      const messages = [createGroupMessage({ id: "msg-1" })];

      render(
        <MessageThreadCard
          threadId="group-thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const participants = screen.getByTestId("thread-participants");
      expect(participants.textContent).not.toContain("Also includes:");
    });

    it("should not display people badge for group chat (removed for cleaner layout)", () => {
      const messages = [createGroupMessage({ id: "msg-1" })];

      render(
        <MessageThreadCard
          threadId="group-thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      // People badge intentionally removed - participant list at bottom shows who's in the chat
      expect(screen.queryByText("3 people")).not.toBeInTheDocument();
    });

    it("should display participant names inline with Group Chat label and hover tooltip", () => {
      const messages = [createGroupMessage({ id: "msg-1" })];

      render(
        <MessageThreadCard
          threadId="group-thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const participants = screen.getByTestId("thread-participants");
      expect(participants).toBeInTheDocument();
      // Should have title attribute for tooltip with full participant list
      expect(participants).toHaveAttribute("title");
      // Should be in the same container as the Group Chat label
      const contactName = screen.getByTestId("thread-contact-name");
      expect(contactName.parentElement).toBe(participants.parentElement);
      // Group Chat label should include colon for inline format
      expect(contactName).toHaveTextContent("Group Chat:");
    });
  });

  describe("unified styling", () => {
    it("should have hover state class on card container", () => {
      const messages = [createMockMessage()];

      render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const card = screen.getByTestId("message-thread-card");
      expect(card.className).toContain("hover:bg-gray-50");
      expect(card.className).toContain("transition-colors");
    });

    it("should have consistent avatar size for individual chat", () => {
      const messages = [createMockMessage()];

      const { container } = render(
        <MessageThreadCard
          threadId="thread-1"
          messages={messages}
          contactName="John"
          phoneNumber="+14155550100"
        />
      );

      const avatar = container.querySelector(".w-10.h-10");
      expect(avatar).toBeInTheDocument();
    });

    it("should have consistent avatar size for group chat", () => {
      const messages = [
        {
          ...createMockMessage(),
          participants: JSON.stringify({
            from: "+14155550100",
            to: ["+14155550101", "+14155550102"],
          }),
        },
      ];

      const { container } = render(
        <MessageThreadCard
          threadId="group-thread-1"
          messages={messages}
          phoneNumber="+14155550100"
        />
      );

      const avatar = container.querySelector(".w-10.h-10");
      expect(avatar).toBeInTheDocument();
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
