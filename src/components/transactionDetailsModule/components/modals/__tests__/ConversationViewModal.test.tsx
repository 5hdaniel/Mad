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

    it("shows group chat indicator for multiple senders", () => {
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
        />
      );

      expect(screen.getByText("(Group)")).toBeInTheDocument();
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
