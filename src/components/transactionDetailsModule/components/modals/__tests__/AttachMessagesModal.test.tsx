/**
 * AttachMessagesModal Tests
 * Tests for the attach messages modal dialog
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttachMessagesModal } from "../AttachMessagesModal";

// Mock the window.api
const mockGetUnlinkedMessages = jest.fn();
const mockLinkMessages = jest.fn();

beforeAll(() => {
  // Set up window.api mock
  Object.defineProperty(window, "api", {
    value: {
      transactions: {
        getUnlinkedMessages: mockGetUnlinkedMessages,
        linkMessages: mockLinkMessages,
      },
    },
    writable: true,
  });
});

describe("AttachMessagesModal", () => {
  const mockOnClose = jest.fn();
  const mockOnAttached = jest.fn();
  const defaultProps = {
    userId: "user-123",
    transactionId: "txn-456",
    propertyAddress: "123 Main St",
    onClose: mockOnClose,
    onAttached: mockOnAttached,
  };

  const mockMessages = [
    {
      id: "msg-1",
      user_id: "user-123",
      channel: "sms",
      body_text: "Hello from thread 1",
      sent_at: "2024-01-16T11:00:00Z",
      direction: "inbound",
      thread_id: "thread-1",
      participants: JSON.stringify({ from: "+14155550100", to: ["+14155550101"] }),
    },
    {
      id: "msg-2",
      user_id: "user-123",
      channel: "imessage",
      body_text: "Reply from thread 1",
      sent_at: "2024-01-17T12:00:00Z",
      direction: "outbound",
      thread_id: "thread-1",
      participants: JSON.stringify({ from: "+14155550101", to: ["+14155550100"] }),
    },
    {
      id: "msg-3",
      user_id: "user-123",
      channel: "sms",
      body_text: "Message from thread 2",
      sent_at: "2024-01-18T10:00:00Z",
      direction: "inbound",
      thread_id: "thread-2",
      participants: JSON.stringify({ from: "+14155550200", to: ["+14155550101"] }),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnlinkedMessages.mockResolvedValue({
      success: true,
      messages: [],
    });
    mockLinkMessages.mockResolvedValue({
      success: true,
    });
  });

  describe("Basic Rendering", () => {
    it("should render modal with test id", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId("attach-messages-modal")).toBeInTheDocument();
      });
    });

    it("should render modal title", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Attach Messages")).toBeInTheDocument();
      });
    });

    it("should render property address subtitle when provided", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Link messages to 123 Main St/)).toBeInTheDocument();
      });
    });

    it("should render default subtitle when no property address", async () => {
      render(<AttachMessagesModal {...defaultProps} propertyAddress={undefined} />);
      await waitFor(() => {
        expect(screen.getByText("Select message threads to attach")).toBeInTheDocument();
      });
    });

    it("should render close button", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId("close-modal-button")).toBeInTheDocument();
      });
    });

    it("should render search input", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("should show loading spinner initially", () => {
      mockGetUnlinkedMessages.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      render(<AttachMessagesModal {...defaultProps} />);
      expect(screen.getByText("Loading messages...")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no unlinked messages", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [],
      });
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("No unlinked messages available")).toBeInTheDocument();
      });
    });

    it("should show explanation in empty state", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [],
      });
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(
          screen.getByText("All message threads are already linked to transactions")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error State", () => {
    it("should show error message when loading fails", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: false,
        error: "Failed to load messages",
      });
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Failed to load messages")).toBeInTheDocument();
      });
    });

    it("should show error when API throws", async () => {
      mockGetUnlinkedMessages.mockRejectedValue(new Error("Network error"));
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("Thread Display", () => {
    it("should display threads when messages loaded", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("2 conversations available")).toBeInTheDocument();
      });
    });

    it("should display singular form for one conversation", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [mockMessages[2]], // Only one thread
      });
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("1 conversation available")).toBeInTheDocument();
      });
    });
  });

  describe("Thread Selection", () => {
    it("should toggle thread selection on click", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      // Click to select
      fireEvent.click(screen.getByTestId("thread-thread-1"));
      expect(screen.getByText("1 conversation selected")).toBeInTheDocument();

      // Click to deselect
      fireEvent.click(screen.getByTestId("thread-thread-1"));
      expect(screen.getByText("Select conversations to attach")).toBeInTheDocument();
    });

    it("should allow selecting multiple threads", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("thread-thread-2"));
      expect(screen.getByText("2 conversations selected")).toBeInTheDocument();
    });

    it("should have Select All button", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("select-all-button")).toBeInTheDocument();
      });
    });

    it("should select all threads when Select All clicked", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("select-all-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("select-all-button"));
      expect(screen.getByText("2 conversations selected")).toBeInTheDocument();
    });

    it("should deselect all when Deselect All clicked", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("select-all-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("select-all-button")); // Select all
      expect(screen.getByText("Deselect All")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("select-all-button")); // Deselect all
      expect(screen.getByText("Select conversations to attach")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("should filter threads by search query", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });

      // Search for a phone number that only exists in thread-2
      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "5550200" },
      });

      // Only thread-2 should be visible
      expect(screen.getByText("1 conversation available")).toBeInTheDocument();
    });

    it("should show no results message for unmatched search", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("search-input")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("search-input"), {
        target: { value: "nonexistent" },
      });

      expect(screen.getByText("No matching conversations found")).toBeInTheDocument();
    });
  });

  describe("Cancel Action", () => {
    it("should call onClose when Cancel button clicked", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [],
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("cancel-button"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when close button clicked", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [],
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("close-modal-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("close-modal-button"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Attach Action", () => {
    it("should disable attach button when no threads selected", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("attach-button")).toBeDisabled();
      });
    });

    it("should enable attach button when threads selected", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      expect(screen.getByTestId("attach-button")).not.toBeDisabled();
    });

    it("should show count in attach button", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("thread-thread-2"));
      expect(screen.getByTestId("attach-button")).toHaveTextContent("Attach (2)");
    });

    it("should call linkMessages and onAttached on successful attach", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("attach-button"));

      await waitFor(() => {
        expect(mockLinkMessages).toHaveBeenCalledWith(
          expect.arrayContaining(["msg-1", "msg-2"]),
          "txn-456"
        );
        expect(mockOnAttached).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("should show error on failed attach", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      mockLinkMessages.mockResolvedValue({
        success: false,
        error: "Failed to attach",
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("attach-button"));

      await waitFor(() => {
        expect(screen.getByText("Failed to attach")).toBeInTheDocument();
      });
    });

    it("should show loading state while attaching", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      mockLinkMessages.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("attach-button"));

      expect(screen.getByTestId("attach-button")).toHaveTextContent("Attaching...");
    });
  });

  describe("Accessibility", () => {
    it("should have proper button roles", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [],
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it("should have search input placeholder", async () => {
      mockGetUnlinkedMessages.mockResolvedValue({
        success: true,
        messages: [],
      });
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Search by phone number or message content/i)
        ).toBeInTheDocument();
      });
    });
  });
});
