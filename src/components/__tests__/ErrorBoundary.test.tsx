/**
 * Tests for ErrorBoundary
 * Verifies error catching and fallback UI behavior
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../ErrorBoundary";

// Suppress jsdom unhandled error events globally for error boundary tests
beforeAll(() => {
  window.addEventListener("error", (e) => e.preventDefault());
});

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div data-testid="no-error">No error</div>;
}

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset clipboard mock
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  it("should render children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("should render error UI when child throws", async () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/We encountered an unexpected error/),
    ).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText("Contact Support")).toBeInTheDocument();
  });

  it("should show error message in technical details", async () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("Technical Details")).toBeInTheDocument();
    });
  });

  it("should render custom fallback when provided", async () => {
    render(
      <ErrorBoundary
        fallback={<div data-testid="custom-fallback">Custom fallback</div>}
      >
        <ThrowError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    });
  });

  it("should reset error state when Try Again is clicked", async () => {
    const user = userEvent.setup();

    // Use a component that can toggle throwing
    let shouldThrow = true;
    function ToggleError() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div data-testid="recovered">Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ToggleError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    // Set to not throw before clicking retry
    shouldThrow = false;

    await user.click(screen.getByText("Try Again"));

    // After retry, should show recovered state
    await waitFor(() => {
      expect(screen.getByTestId("recovered")).toBeInTheDocument();
    });
  });

  it("should show View Full Report button", async () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    // Open technical details
    const detailsElement = screen
      .getByText("Technical Details")
      .closest("details");
    if (detailsElement) {
      detailsElement.setAttribute("open", "true");
    }

    expect(
      screen.getByRole("button", { name: /view full report/i }),
    ).toBeInTheDocument();
  });

  it("should open full report modal when View Full Report is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    // Open technical details
    const detailsElement = screen
      .getByText("Technical Details")
      .closest("details");
    if (detailsElement) {
      detailsElement.setAttribute("open", "true");
    }

    const viewReportButton = screen.getByRole("button", {
      name: /view full report/i,
    });
    await user.click(viewReportButton);

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByText("Error Report")).toBeInTheDocument();
    });
    expect(screen.getByText("Send to Support")).toBeInTheDocument();
  });

  it("should show support email information", async () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByText("support@keeprcompliance.com")).toBeInTheDocument();
    });
  });

  it("should fetch diagnostics when error occurs", async () => {
    // Mock getDiagnostics
    window.api.system.getDiagnostics = jest.fn().mockResolvedValue({
      success: true,
      diagnostics: "Test diagnostics info",
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // Wait for diagnostics to be fetched
    await waitFor(() => {
      expect(window.api.system.getDiagnostics).toHaveBeenCalled();
    });
  });
});
