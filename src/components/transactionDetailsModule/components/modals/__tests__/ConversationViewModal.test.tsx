/**
 * ConversationViewModal Tests
 * Tests for the conversation view modal with attachment display (TASK-1012)
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ConversationViewModal } from "../ConversationViewModal";

// Mock the window.api for attachment fetching
const mockGetMessageAttachmentsBatch = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "api", {
    value: {
      messages: {
        getMessageAttachmentsBatch: mockGetMessageAttachmentsBatch,
      },
    },
    writable: true,
  });
});

describe("ConversationViewModal", () => {
  const mockOnClose = jest.fn();

  const defaultMessages = [
    {
      id: "msg-1",
      user_id: "user-123",
      channel: "imessage",
      body_text: "Hello there!",
      sent_at: "2024-01-15T10:00:00Z",
      direction: "inbound" as const,
      has_attachments: false,
      participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
    },
    {
      id: "msg-2",
      user_id: "user-123",
      channel: "imessage",
      body_text: "Hi! How are you?",
      sent_at: "2024-01-15T10:05:00Z",
      direction: "outbound" as const,
      has_attachments: false,
      participants: JSON.stringify({ from: "me", to: ["+14155550100"] }),
    },
  ];

  const defaultProps = {
    messages: defaultMessages,
    contactName: "John Doe",
    phoneNumber: "+14155550100",
    contactNames: {},
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMessageAttachmentsBatch.mockResolvedValue({});
  });

  describe("Basic Rendering", () => {
    it("renders modal with header and messages", () => {
      render(<ConversationViewModal {...defaultProps} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("2 messages")).toBeInTheDocument();
      expect(screen.getByText("Hello there!")).toBeInTheDocument();
      expect(screen.getByText("Hi! How are you?")).toBeInTheDocument();
    });

    it("displays phone number when no contact name", () => {
      render(
        <ConversationViewModal
          {...defaultProps}
          contactName={undefined}
        />
      );

      expect(screen.getByText("+14155550100")).toBeInTheDocument();
    });

    it("shows participant names in header for group chats", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from sender 1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from sender 2",
          sent_at: "2024-01-15T10:05:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
      ];

      const contactNamesForGroup = {
        "+14155550100": "Alice Smith",
        "+14155550200": "Bob Jones",
      };

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={contactNamesForGroup}
        />
      );

      // Should show participant names instead of single contact name
      expect(screen.getByText("Alice Smith, Bob Jones")).toBeInTheDocument();
    });

    it("shows phone numbers for unknown contacts in group chat header", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from sender 1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from sender 2",
          sent_at: "2024-01-15T10:05:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
      ];

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={{}}
        />
      );

      // Should show phone numbers when no contact names available
      expect(screen.getByText("+14155550100, +14155550200")).toBeInTheDocument();
    });

    it("shows +X more for groups with more than 3 participants", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message 1",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message 2",
          sent_at: "2024-01-15T10:01:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
        {
          id: "msg-3",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message 3",
          sent_at: "2024-01-15T10:02:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550300", to: ["me"] }),
        },
        {
          id: "msg-4",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message 4",
          sent_at: "2024-01-15T10:03:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550400", to: ["me"] }),
        },
        {
          id: "msg-5",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message 5",
          sent_at: "2024-01-15T10:04:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550500", to: ["me"] }),
        },
      ];

      const contactNamesForGroup = {
        "+14155550100": "Alice",
        "+14155550200": "Bob",
        "+14155550300": "Carol",
        "+14155550400": "Dave",
        "+14155550500": "Eve",
      };

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={contactNamesForGroup}
        />
      );

      // Should show first 3 names plus "+2 more"
      expect(screen.getByText(/Alice, Bob, Carol \+2 more/)).toBeInTheDocument();
    });
  });

  describe("Sender Name Display in Group Chats", () => {
    it("shows sender name on inbound messages in group chats", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Hello from Alice",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Hello from Bob",
          sent_at: "2024-01-15T10:05:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
      ];

      const contactNamesForGroup = {
        "+14155550100": "Alice",
        "+14155550200": "Bob",
      };

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={contactNamesForGroup}
        />
      );

      // Should show sender names on messages
      const senderElements = screen.getAllByTestId("group-message-sender");
      expect(senderElements).toHaveLength(2);
      expect(senderElements[0]).toHaveTextContent("Alice");
      expect(senderElements[1]).toHaveTextContent("Bob");
    });

    it("hides sender name for consecutive messages from same sender", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "First message from Alice",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Second message from Alice",
          sent_at: "2024-01-15T10:01:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-3",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from Bob",
          sent_at: "2024-01-15T10:02:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
      ];

      const contactNamesForGroup = {
        "+14155550100": "Alice",
        "+14155550200": "Bob",
      };

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={contactNamesForGroup}
        />
      );

      // Should only show sender name for first Alice message and for Bob
      const senderElements = screen.getAllByTestId("group-message-sender");
      expect(senderElements).toHaveLength(2);
      expect(senderElements[0]).toHaveTextContent("Alice");
      expect(senderElements[1]).toHaveTextContent("Bob");
    });

    it("does not show sender name on outbound messages", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from Alice",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "My reply",
          sent_at: "2024-01-15T10:01:00Z",
          direction: "outbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "me", to: ["+14155550100", "+14155550200"] }),
        },
        {
          id: "msg-3",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from Bob",
          sent_at: "2024-01-15T10:02:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
      ];

      const contactNamesForGroup = {
        "+14155550100": "Alice",
        "+14155550200": "Bob",
      };

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={contactNamesForGroup}
        />
      );

      // Should only show sender names for inbound messages
      const senderElements = screen.getAllByTestId("group-message-sender");
      expect(senderElements).toHaveLength(2);
      expect(senderElements[0]).toHaveTextContent("Alice");
      expect(senderElements[1]).toHaveTextContent("Bob");
    });

    it("falls back to phone number when contact name not available", () => {
      const groupMessages = [
        {
          id: "msg-1",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from known contact",
          sent_at: "2024-01-15T10:00:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550100", to: ["me"] }),
        },
        {
          id: "msg-2",
          user_id: "user-123",
          channel: "imessage",
          body_text: "Message from unknown contact",
          sent_at: "2024-01-15T10:01:00Z",
          direction: "inbound" as const,
          has_attachments: false,
          participants: JSON.stringify({ from: "+14155550200", to: ["me"] }),
        },
      ];

      const contactNamesForGroup = {
        "+14155550100": "Alice",
        // +14155550200 intentionally not in contactNames
      };

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={groupMessages}
          contactNames={contactNamesForGroup}
        />
      );

      const senderElements = screen.getAllByTestId("group-message-sender");
      expect(senderElements).toHaveLength(2);
      expect(senderElements[0]).toHaveTextContent("Alice");
      expect(senderElements[1]).toHaveTextContent("+14155550200");
    });
  });

  describe("Attachment Display (TASK-1012)", () => {
    it("loads attachments for messages with has_attachments flag", async () => {
      const messagesWithAttachments = [
        {
          ...defaultMessages[0],
          id: "msg-with-attachment",
          has_attachments: true,
        },
      ];

      mockGetMessageAttachmentsBatch.mockResolvedValue({
        "msg-with-attachment": [
          {
            id: "att-1",
            message_id: "msg-with-attachment",
            filename: "photo.jpg",
            mime_type: "image/jpeg",
            file_size_bytes: 12345,
            data: "base64data",
          },
        ],
      });

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={messagesWithAttachments}
        />
      );

      await waitFor(() => {
        expect(mockGetMessageAttachmentsBatch).toHaveBeenCalledWith([
          "msg-with-attachment",
        ]);
      });
    });

    it("does not call API when no messages have attachments", () => {
      render(<ConversationViewModal {...defaultProps} />);

      expect(mockGetMessageAttachmentsBatch).not.toHaveBeenCalled();
    });

    it("shows loading state while fetching attachments", async () => {
      // Create a promise that we can control
      let resolveAttachments: (value: unknown) => void;
      const attachmentPromise = new Promise((resolve) => {
        resolveAttachments = resolve;
      });
      mockGetMessageAttachmentsBatch.mockReturnValue(attachmentPromise);

      const messagesWithAttachments = [
        {
          ...defaultMessages[0],
          id: "msg-loading",
          has_attachments: true,
        },
      ];

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={messagesWithAttachments}
        />
      );

      // Should show loading state
      expect(screen.getByText("Loading attachment...")).toBeInTheDocument();

      // Resolve the promise
      resolveAttachments!({});

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText("Loading attachment...")).not.toBeInTheDocument();
      });
    });

    it("shows placeholder text for HEIC attachments (not displayable)", async () => {
      const messagesWithAttachments = [
        {
          ...defaultMessages[0],
          id: "msg-with-heic",
          has_attachments: true,
        },
      ];

      // HEIC files are filtered out as non-displayable
      mockGetMessageAttachmentsBatch.mockResolvedValue({
        "msg-with-heic": [
          {
            id: "att-1",
            message_id: "msg-with-heic",
            filename: "photo.heic",
            mime_type: "image/heic",
            file_size_bytes: 12345,
            data: "base64data",
          },
        ],
      });

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={messagesWithAttachments}
        />
      );

      // The message text should still be shown
      await waitFor(() => {
        expect(screen.getByText("Hello there!")).toBeInTheDocument();
      });
    });

    it("renders image when attachment data is available", async () => {
      const messagesWithAttachments = [
        {
          ...defaultMessages[0],
          id: "msg-with-image",
          has_attachments: true,
        },
      ];

      const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      mockGetMessageAttachmentsBatch.mockResolvedValue({
        "msg-with-image": [
          {
            id: "att-1",
            message_id: "msg-with-image",
            filename: "test.png",
            mime_type: "image/png",
            file_size_bytes: 100,
            data: base64Data,
          },
        ],
      });

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={messagesWithAttachments}
        />
      );

      await waitFor(() => {
        const img = screen.getByAltText("test.png");
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute(
          "src",
          `data:image/png;base64,${base64Data}`
        );
      });
    });

    it("shows placeholder when attachment file is missing", async () => {
      const messagesWithAttachments = [
        {
          ...defaultMessages[0],
          id: "msg-missing-file",
          has_attachments: true,
        },
      ];

      mockGetMessageAttachmentsBatch.mockResolvedValue({
        "msg-missing-file": [
          {
            id: "att-1",
            message_id: "msg-missing-file",
            filename: "missing.jpg",
            mime_type: "image/jpeg",
            file_size_bytes: 12345,
            data: null, // File not found
          },
        ],
      });

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={messagesWithAttachments}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("[Image: missing.jpg]")).toBeInTheDocument();
      });
    });

    it("handles API errors gracefully", async () => {
      const messagesWithAttachments = [
        {
          ...defaultMessages[0],
          id: "msg-error",
          has_attachments: true,
        },
      ];

      mockGetMessageAttachmentsBatch.mockRejectedValue(new Error("API Error"));

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={messagesWithAttachments}
        />
      );

      // Should not crash and should show placeholder
      await waitFor(() => {
        expect(screen.getByText("[Attachment]")).toBeInTheDocument();
      });
    });
  });

  describe("Message Sorting", () => {
    it("displays messages in chronological order", () => {
      const unorderedMessages = [
        {
          ...defaultMessages[0],
          id: "msg-later",
          body_text: "Second message text here",
          sent_at: "2024-01-15T11:00:00Z",
        },
        {
          ...defaultMessages[0],
          id: "msg-earlier",
          body_text: "First message text here",
          sent_at: "2024-01-15T09:00:00Z",
        },
      ];

      render(
        <ConversationViewModal
          {...defaultProps}
          messages={unorderedMessages}
        />
      );

      // Check that "First" appears before "Second" in the DOM
      const firstMsg = screen.getByText("First message text here");
      const secondMsg = screen.getByText("Second message text here");

      expect(firstMsg).toBeInTheDocument();
      expect(secondMsg).toBeInTheDocument();

      // Verify ordering by checking DOM positions
      expect(
        firstMsg.compareDocumentPosition(secondMsg) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
  });
});
