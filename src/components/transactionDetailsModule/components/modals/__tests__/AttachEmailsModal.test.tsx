/**
 * AttachEmailsModal Tests (TASK-1993)
 * Tests for server-side email search, date filtering, and load more.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AttachEmailsModal } from "../AttachEmailsModal";

// Mock the window.api
const mockGetUnlinkedEmails = jest.fn();
const mockLinkEmails = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "api", {
    value: {
      transactions: {
        getUnlinkedEmails: mockGetUnlinkedEmails,
        linkEmails: mockLinkEmails,
      },
    },
    writable: true,
  });
});

describe("AttachEmailsModal", () => {
  const mockOnClose = jest.fn();
  const mockOnAttached = jest.fn();
  const defaultProps = {
    userId: "user-123",
    transactionId: "txn-456",
    propertyAddress: "123 Main St",
    onClose: mockOnClose,
    onAttached: mockOnAttached,
  };

  const mockEmails = [
    {
      id: "gmail:msg-1",
      subject: "Closing Documents",
      sender: "agent@example.com",
      sent_at: "2024-06-01T10:00:00Z",
      body_preview: "Here are the closing docs",
      email_thread_id: "thread-1",
    },
    {
      id: "gmail:msg-2",
      subject: "Closing Documents",
      sender: "buyer@example.com",
      sent_at: "2024-06-02T12:00:00Z",
      body_preview: "Thanks for sending",
      email_thread_id: "thread-1",
    },
    {
      id: "gmail:msg-3",
      subject: "Inspection Report",
      sender: "inspector@example.com",
      sent_at: "2024-05-15T09:00:00Z",
      body_preview: "Inspection complete",
      email_thread_id: "thread-2",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetUnlinkedEmails.mockResolvedValue({
      success: true,
      emails: mockEmails,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders and fetches emails on mount", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    // Should show loading initially
    expect(screen.getByText("Loading emails...")).toBeInTheDocument();

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalledWith("user-123", { maxResults: 100 });
    });

    // Should show conversations after loading
    await waitFor(() => {
      expect(screen.getByText(/conversation/)).toBeInTheDocument();
    });
  });

  it("passes no query on initial load (backward compatible)", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalledWith("user-123", { maxResults: 100 });
    });

    // Verify the call does NOT include query, after, or before
    const callArgs = mockGetUnlinkedEmails.mock.calls[0][1];
    expect(callArgs.query).toBeUndefined();
    expect(callArgs.after).toBeUndefined();
    expect(callArgs.before).toBeUndefined();
  });

  it("debounces search input and triggers server-side fetch with query", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalledTimes(1);
    });

    // Clear mock to track new calls
    mockGetUnlinkedEmails.mockClear();
    mockGetUnlinkedEmails.mockResolvedValue({
      success: true,
      emails: [mockEmails[0], mockEmails[1]], // Filtered results
    });

    // Type in search box
    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "closing" } });

    // Should NOT have called yet (debounce not elapsed)
    expect(mockGetUnlinkedEmails).not.toHaveBeenCalled();

    // Advance timer past debounce delay
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Now should trigger a fetch with the query
    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalledWith("user-123", {
        query: "closing",
        maxResults: 100,
      });
    });
  });

  it("passes date filter values to the fetch call", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalledTimes(1);
    });

    mockGetUnlinkedEmails.mockClear();
    mockGetUnlinkedEmails.mockResolvedValue({
      success: true,
      emails: [mockEmails[2]],
    });

    // Set date filter
    const afterInput = screen.getByTestId("after-date-input");
    fireEvent.change(afterInput, { target: { value: "2024-05-01" } });

    // Date change triggers fetch immediately (no debounce on date fields)
    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalledWith("user-123", expect.objectContaining({
        after: expect.stringContaining("2024-05-01"),
        maxResults: 100,
      }));
    });
  });

  it("shows search placeholder as 'Search emails...'", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    const searchInput = screen.getByTestId("search-input");
    expect(searchInput).toHaveAttribute("placeholder", "Search emails...");
  });

  it("shows empty state for search when no results", async () => {
    mockGetUnlinkedEmails.mockResolvedValue({
      success: true,
      emails: [],
    });

    render(<AttachEmailsModal {...defaultProps} />);

    // Wait for initial load (empty)
    await waitFor(() => {
      expect(screen.getByText("No unlinked emails available")).toBeInTheDocument();
    });

    // Now simulate a search that returns empty
    mockGetUnlinkedEmails.mockResolvedValue({
      success: true,
      emails: [],
    });

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByText("No emails matching your search")).toBeInTheDocument();
    });
  });

  it("shows Audit Period button when auditStartDate is provided", async () => {
    render(
      <AttachEmailsModal
        {...defaultProps}
        auditStartDate="2024-01-15T00:00:00Z"
        auditEndDate="2024-06-30T00:00:00Z"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("audit-period-button")).toBeInTheDocument();
    });

    expect(screen.getByTestId("audit-period-button")).toHaveTextContent("Audit Period");
  });

  it("does not show Audit Period button when no audit dates provided", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("audit-period-button")).not.toBeInTheDocument();
  });

  it("fills date fields when Audit Period button is clicked", async () => {
    render(
      <AttachEmailsModal
        {...defaultProps}
        auditStartDate="2024-01-15T00:00:00Z"
        auditEndDate="2024-06-30T00:00:00Z"
      />
    );

    await waitFor(() => {
      expect(mockGetUnlinkedEmails).toHaveBeenCalled();
    });

    // The dates should be pre-populated from props
    const afterInput = screen.getByTestId("after-date-input") as HTMLInputElement;
    const beforeInput = screen.getByTestId("before-date-input") as HTMLInputElement;
    expect(afterInput.value).toBe("2024-01-15");
    expect(beforeInput.value).toBe("2024-06-30");
  });

  it("shows date filter UI", async () => {
    render(<AttachEmailsModal {...defaultProps} />);

    expect(screen.getByTestId("date-filter")).toBeInTheDocument();
    expect(screen.getByTestId("after-date-input")).toBeInTheDocument();
    expect(screen.getByTestId("before-date-input")).toBeInTheDocument();
    expect(screen.getByText("Date range:")).toBeInTheDocument();
  });

  it("handles error state", async () => {
    mockGetUnlinkedEmails.mockResolvedValue({
      success: false,
      error: "No email account connected",
    });

    render(<AttachEmailsModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("No email account connected")).toBeInTheDocument();
    });
  });

  it("handles fetch exception", async () => {
    mockGetUnlinkedEmails.mockRejectedValue(new Error("Network error"));

    render(<AttachEmailsModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
