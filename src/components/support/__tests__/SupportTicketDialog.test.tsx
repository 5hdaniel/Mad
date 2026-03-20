/**
 * SupportTicketDialog Tests
 * TASK-2282: Tests for conditional name/email fields
 *
 * Tests that the dialog:
 * - Shows name/email fields when userEmail/userName are empty (unauthenticated)
 * - Hides name/email fields when userEmail/userName are provided (authenticated)
 * - Shows "Submitting as" text when authenticated
 * - Disables submit when name/email are empty for unauthenticated users
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SupportTicketDialog } from "../SupportTicketDialog";

// Mock the useSupportTicket hook
jest.mock("../../../hooks/useSupportTicket", () => ({
  useSupportTicket: () => ({
    diagnostics: null,
    diagnosticsLoading: false,
    screenshot: null,
    screenshotLoading: false,
    categories: [],
    categoriesLoading: false,
    submitting: false,
    ticketNumber: null,
    error: null,
    success: false,
    collectDiagnostics: jest.fn(),
    captureScreenshot: jest.fn(),
    removeScreenshot: jest.fn(),
    submitTicket: jest.fn(),
    reset: jest.fn(),
  }),
}));

// Mock the child components
jest.mock("../DiagnosticsPreview", () => ({
  DiagnosticsPreview: () => <div data-testid="diagnostics-preview" />,
}));

jest.mock("../ScreenshotCapture", () => ({
  ScreenshotCapture: () => <div data-testid="screenshot-capture" />,
}));

// Setup support bridge mock
beforeEach(() => {
  if (!window.api.support) {
    (window.api as Record<string, unknown>).support = {
      collectDiagnostics: jest.fn().mockResolvedValue({ success: true, diagnostics: null }),
      captureScreenshot: jest.fn().mockResolvedValue({ success: true, screenshot: null }),
      getCategories: jest.fn().mockResolvedValue({ success: true, categories: [] }),
      submitTicket: jest.fn().mockResolvedValue({ success: true, ticket_number: 1 }),
    };
  }
});

describe("SupportTicketDialog", () => {
  const defaultProps = {
    onClose: jest.fn(),
    userEmail: "",
    userName: "",
  };

  describe("unauthenticated state (empty email/name)", () => {
    it("shows name and email input fields", () => {
      render(<SupportTicketDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Your Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Your Email/)).toBeInTheDocument();
    });

    it("does not show 'Submitting as' text", () => {
      render(<SupportTicketDialog {...defaultProps} />);

      expect(screen.queryByText(/Submitting as/)).not.toBeInTheDocument();
    });

    it("disables submit when name and email are empty", () => {
      render(<SupportTicketDialog {...defaultProps} />);

      // Fill subject and description but not name/email
      fireEvent.change(screen.getByLabelText(/Subject/), {
        target: { value: "Test subject" },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: "Test description" },
      });

      const submitButton = screen.getByText("Submit Ticket");
      expect(submitButton).toBeDisabled();
    });

    it("enables submit when all required fields are filled", () => {
      render(<SupportTicketDialog {...defaultProps} />);

      fireEvent.change(screen.getByLabelText(/Your Name/), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByLabelText(/Your Email/), {
        target: { value: "john@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/Subject/), {
        target: { value: "Test subject" },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: "Test description" },
      });

      const submitButton = screen.getByText("Submit Ticket");
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("authenticated state (email/name provided)", () => {
    const authProps = {
      onClose: jest.fn(),
      userEmail: "user@example.com",
      userName: "Test User",
    };

    it("does not show name and email input fields", () => {
      render(<SupportTicketDialog {...authProps} />);

      expect(screen.queryByLabelText(/Your Name/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Your Email/)).not.toBeInTheDocument();
    });

    it("shows 'Submitting as' text with user info", () => {
      render(<SupportTicketDialog {...authProps} />);

      expect(
        screen.getByText(/Submitting as Test User/)
      ).toBeInTheDocument();
      expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
    });

    it("enables submit with just subject and description", () => {
      render(<SupportTicketDialog {...authProps} />);

      fireEvent.change(screen.getByLabelText(/Subject/), {
        target: { value: "Test subject" },
      });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: "Test description" },
      });

      const submitButton = screen.getByText("Submit Ticket");
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("renders diagnostics and screenshot components", () => {
    render(<SupportTicketDialog {...defaultProps} />);

    expect(screen.getByTestId("diagnostics-preview")).toBeInTheDocument();
    expect(screen.getByTestId("screenshot-capture")).toBeInTheDocument();
  });
});
