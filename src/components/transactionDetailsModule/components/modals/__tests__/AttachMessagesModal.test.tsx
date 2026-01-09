/**
 * AttachMessagesModal Tests
 * Tests for the contact-first attach messages modal dialog
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttachMessagesModal } from "../AttachMessagesModal";

// Mock the window.api
const mockGetMessageContacts = jest.fn();
const mockGetMessagesByContact = jest.fn();
const mockLinkMessages = jest.fn();

beforeAll(() => {
  // Set up window.api mock
  Object.defineProperty(window, "api", {
    value: {
      transactions: {
        getMessageContacts: mockGetMessageContacts,
        getMessagesByContact: mockGetMessagesByContact,
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

  const mockContacts = [
    {
      contact: "+14155550100",
      contactName: "John Doe",
      messageCount: 5,
      lastMessageAt: "2024-01-18T10:00:00Z",
    },
    {
      contact: "+14155550200",
      contactName: null,
      messageCount: 3,
      lastMessageAt: "2024-01-17T12:00:00Z",
    },
  ];

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
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMessageContacts.mockResolvedValue({
      success: true,
      contacts: [],
    });
    mockGetMessagesByContact.mockResolvedValue({
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

    it("should render Select Contact title in contacts view", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Select Contact")).toBeInTheDocument();
      });
    });

    it("should render property address subtitle when provided", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Link chats to 123 Main St/)).toBeInTheDocument();
      });
    });

    it("should render close button", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId("close-modal-button")).toBeInTheDocument();
      });
    });

    it("should render cancel button", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
      });
    });

    it("should render search input", async () => {
      render(<AttachMessagesModal {...defaultProps} />);
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/Search by name or phone number/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator while loading contacts", async () => {
      // Make the API hang
      mockGetMessageContacts.mockImplementation(() => new Promise(() => {}));

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Loading contacts/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error message when loading contacts fails", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: false,
        error: "Failed to load contacts",
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load contacts")).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no contacts with messages", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: [],
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/No contacts with unlinked messages/i)).toBeInTheDocument();
      });
    });
  });

  describe("Contacts List", () => {
    it("should display contacts list", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        // Should show contact name for first contact, phone for second (no name)
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("+1 (415) 555-0200")).toBeInTheDocument();
      });
    });

    it("should display message counts for contacts", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("5 msgs")).toBeInTheDocument();
        expect(screen.getByText("3 msgs")).toBeInTheDocument();
      });
    });

    it("should filter contacts by search query", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Type search query (search by name)
      const searchInput = screen.getByPlaceholderText(/Search by name or phone number/i);
      fireEvent.change(searchInput, { target: { value: "John" } });

      // Should only show matching contact
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.queryByText("+1 (415) 555-0200")).not.toBeInTheDocument();
    });
  });

  describe("Threads View", () => {
    it("should load threads when contact is selected", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      // Wait for contacts to load
      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Click on a contact
      fireEvent.click(screen.getByText("John Doe"));

      // Should call getMessagesByContact
      await waitFor(() => {
        expect(mockGetMessagesByContact).toHaveBeenCalledWith(
          "user-123",
          "+14155550100"
        );
      });
    });

    it("should show back button in threads view", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Click on a contact
      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("back-button")).toBeInTheDocument();
      });
    });

    it("should navigate back to contacts when back button clicked", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Click on a contact
      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("back-button")).toBeInTheDocument();
      });

      // Click back
      fireEvent.click(screen.getByTestId("back-button"));

      // Should be back to contacts view
      await waitFor(() => {
        expect(screen.getByText("Select Contact")).toBeInTheDocument();
      });
    });
  });

  describe("Thread Selection", () => {
    it("should allow selecting threads", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      // Click to select thread
      fireEvent.click(screen.getByTestId("thread-thread-1"));

      // Should show selection count
      expect(screen.getByText(/1 chat selected/i)).toBeInTheDocument();
    });

    it("should show attach button in threads view", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("attach-button")).toBeInTheDocument();
      });
    });
  });

  describe("Attaching Messages", () => {
    it("should call linkMessages when attach is clicked", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      // Select thread
      fireEvent.click(screen.getByTestId("thread-thread-1"));

      // Click attach
      fireEvent.click(screen.getByTestId("attach-button"));

      await waitFor(() => {
        expect(mockLinkMessages).toHaveBeenCalledWith(
          ["msg-1", "msg-2"],
          "txn-456"
        );
      });
    });

    it("should call onAttached and onClose after successful attach", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      mockLinkMessages.mockResolvedValue({ success: true });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("attach-button"));

      await waitFor(() => {
        expect(mockOnAttached).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe("Close Modal", () => {
    it("should call onClose when close button clicked", async () => {
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("close-modal-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("close-modal-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should call onClose when cancel button clicked", async () => {
      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("cancel-button"));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Error Handling in Attach Flow", () => {
    it("should show error message when linkMessages fails", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      mockLinkMessages.mockResolvedValue({
        success: false,
        error: "Failed to link messages",
      });

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("attach-button"));

      await waitFor(() => {
        expect(screen.getByText("Failed to link messages")).toBeInTheDocument();
      });

      // Should not call onAttached or onClose on failure
      expect(mockOnAttached).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should show error message when linkMessages throws exception", async () => {
      mockGetMessageContacts.mockResolvedValue({
        success: true,
        contacts: mockContacts,
      });
      mockGetMessagesByContact.mockResolvedValue({
        success: true,
        messages: mockMessages,
      });
      mockLinkMessages.mockRejectedValue(new Error("Network error"));

      render(<AttachMessagesModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Doe"));

      await waitFor(() => {
        expect(screen.getByTestId("thread-thread-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("thread-thread-1"));
      fireEvent.click(screen.getByTestId("attach-button"));

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });
});
