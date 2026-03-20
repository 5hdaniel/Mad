/**
 * SupportWidget Tests
 * TASK-2282: Tests for the floating "?" support widget
 *
 * Tests that the widget:
 * - Renders the "?" button without auth context
 * - Opens the dialog on click
 * - Passes user info when available
 * - Works without user info (unauthenticated)
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupportWidget } from "../SupportWidget";

// Mock SupportTicketDialog to avoid complex setup
jest.mock("../SupportTicketDialog", () => ({
  SupportTicketDialog: ({
    onClose,
    userEmail,
    userName,
  }: {
    onClose: () => void;
    userEmail: string;
    userName: string;
    autoCaptureScreenshot?: boolean;
  }) => (
    <div data-testid="support-dialog">
      <span data-testid="dialog-email">{userEmail}</span>
      <span data-testid="dialog-name">{userName}</span>
      <button data-testid="close-dialog" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

// Setup support bridge mock
beforeEach(() => {
  // Ensure window.api.support exists for the hook
  if (!window.api.support) {
    (window.api as Record<string, unknown>).support = {
      collectDiagnostics: jest.fn().mockResolvedValue({ success: true, diagnostics: null }),
      captureScreenshot: jest.fn().mockResolvedValue({ success: true, screenshot: null }),
      getCategories: jest.fn().mockResolvedValue({ success: true, categories: [] }),
      submitTicket: jest.fn().mockResolvedValue({ success: true, ticket_number: 1 }),
    };
  }
});

describe("SupportWidget", () => {
  it("renders the '?' button without any props", () => {
    render(<SupportWidget />);

    const button = screen.getByLabelText("Open support dialog");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("?");
  });

  it("renders the '?' button with optional props", () => {
    render(
      <SupportWidget userEmail="test@example.com" userName="Test User" />
    );

    const button = screen.getByLabelText("Open support dialog");
    expect(button).toBeInTheDocument();
  });

  it("opens the dialog when clicked", () => {
    render(<SupportWidget />);

    const button = screen.getByLabelText("Open support dialog");
    fireEvent.click(button);

    expect(screen.getByTestId("support-dialog")).toBeInTheDocument();
  });

  it("closes the dialog when close is clicked", () => {
    render(<SupportWidget />);

    // Open dialog
    fireEvent.click(screen.getByLabelText("Open support dialog"));
    expect(screen.getByTestId("support-dialog")).toBeInTheDocument();

    // Close dialog
    fireEvent.click(screen.getByTestId("close-dialog"));
    expect(screen.queryByTestId("support-dialog")).not.toBeInTheDocument();
  });

  it("passes empty strings when no user detected (unauthenticated)", () => {
    // Default mock returns success: false for getCurrentUser
    render(<SupportWidget />);

    fireEvent.click(screen.getByLabelText("Open support dialog"));

    expect(screen.getByTestId("dialog-email")).toHaveTextContent("");
    expect(screen.getByTestId("dialog-name")).toHaveTextContent("");
  });

  it("passes user info when props are provided (authenticated)", () => {
    render(
      <SupportWidget userEmail="user@example.com" userName="Jane Doe" />
    );

    fireEvent.click(screen.getByLabelText("Open support dialog"));

    expect(screen.getByTestId("dialog-email")).toHaveTextContent(
      "user@example.com"
    );
    expect(screen.getByTestId("dialog-name")).toHaveTextContent("Jane Doe");
  });

  it("detects user info via IPC when no props provided", async () => {
    // Mock getCurrentUser to return user info
    (window.api.auth.getCurrentUser as jest.Mock).mockResolvedValueOnce({
      success: true,
      user: { email: "detected@example.com", display_name: "Detected User" },
    });

    render(<SupportWidget />);

    // Wait for the IPC call to resolve
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText("Open support dialog"));
      expect(screen.getByTestId("dialog-email")).toHaveTextContent(
        "detected@example.com"
      );
      expect(screen.getByTestId("dialog-name")).toHaveTextContent(
        "Detected User"
      );
    });
  });
});
