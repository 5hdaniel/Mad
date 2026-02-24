/**
 * Tests for OfflineFallback
 * Verifies offline UI display and interaction behavior
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OfflineFallback from "../OfflineFallback";

// Mock navigator.clipboard
const mockClipboard = {
  writeText: jest.fn(),
};

describe("OfflineFallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
    mockClipboard.writeText.mockResolvedValue(undefined);

    // Reset window.api mocks
    window.api.system.contactSupport = jest
      .fn()
      .mockResolvedValue({ success: true });
    window.api.system.getDiagnostics = jest.fn().mockResolvedValue({
      success: true,
      diagnostics: "Test diagnostics",
    });
    window.api.shell.openExternal = jest.fn().mockResolvedValue(undefined);
  });

  describe("Fullscreen mode", () => {
    it("should render children when online", () => {
      render(
        <OfflineFallback isOffline={false}>
          <div data-testid="child">Child content</div>
        </OfflineFallback>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("should render offline UI when offline", () => {
      render(
        <OfflineFallback isOffline={true}>
          <div data-testid="child">Child content</div>
        </OfflineFallback>,
      );

      expect(screen.queryByTestId("child")).not.toBeInTheDocument();
      expect(screen.getByText("You're Offline")).toBeInTheDocument();
      expect(
        screen.getByText(/It looks like you've lost your internet connection/),
      ).toBeInTheDocument();
    });

    it("should show Try Again button", () => {
      render(<OfflineFallback isOffline={true} />);

      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("should show Contact Support button", () => {
      render(<OfflineFallback isOffline={true} />);

      expect(screen.getByText("Contact Support")).toBeInTheDocument();
    });

    it("should show error details when error is provided", async () => {
      const user = userEvent.setup();

      render(<OfflineFallback isOffline={true} error="Network timeout" />);

      // Click to show details
      await user.click(screen.getByText("Show details"));

      expect(screen.getByText("Network timeout")).toBeInTheDocument();
    });

    it("should call onRetry when Try Again is clicked", async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn().mockResolvedValue(undefined);

      render(<OfflineFallback isOffline={true} onRetry={onRetry} />);

      await user.click(screen.getByText("Try Again"));

      expect(onRetry).toHaveBeenCalled();
    });

    it("should show loading state when retrying", async () => {
      const user = userEvent.setup();
      let resolveRetry: () => void;
      const onRetry = jest.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveRetry = resolve;
        });
      });

      render(<OfflineFallback isOffline={true} onRetry={onRetry} />);

      await user.click(screen.getByText("Try Again"));

      expect(screen.getByText("Checking...")).toBeInTheDocument();

      // Resolve the retry
      await act(async () => {
        resolveRetry!();
      });
    });

    it("should call contactSupport when Contact Support is clicked", async () => {
      const user = userEvent.setup();

      render(<OfflineFallback isOffline={true} />);

      await user.click(screen.getByText("Contact Support"));

      expect(window.api.system.contactSupport).toHaveBeenCalled();
    });

    it("should show support email", () => {
      render(<OfflineFallback isOffline={true} />);

      expect(screen.getByText("support@keeprcompliance.com")).toBeInTheDocument();
    });

    it("should reload page when no onRetry provided", async () => {
      const user = userEvent.setup();
      const originalReload = window.location.reload;
      const mockReload = jest.fn();
      Object.defineProperty(window, "location", {
        value: { reload: mockReload },
        writable: true,
      });

      render(<OfflineFallback isOffline={true} />);

      await user.click(screen.getByText("Try Again"));

      expect(mockReload).toHaveBeenCalled();

      // Restore
      Object.defineProperty(window, "location", {
        value: { reload: originalReload },
        writable: true,
      });
    });
  });

  describe("Banner mode", () => {
    it("should render children when online", () => {
      render(
        <OfflineFallback isOffline={false} mode="banner">
          <div data-testid="child">Child content</div>
        </OfflineFallback>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("should render banner and children when offline", () => {
      render(
        <OfflineFallback isOffline={true} mode="banner">
          <div data-testid="child">Child content</div>
        </OfflineFallback>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("You're offline")).toBeInTheDocument();
      expect(
        screen.getByText(/Some features may be limited/),
      ).toBeInTheDocument();
    });

    it("should show Retry button in banner mode", () => {
      render(<OfflineFallback isOffline={true} mode="banner" />);

      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("should call onRetry when Retry button is clicked in banner mode", async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn().mockResolvedValue(undefined);

      render(
        <OfflineFallback isOffline={true} mode="banner" onRetry={onRetry} />,
      );

      await user.click(screen.getByText("Retry"));

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe("Contact Support fallback", () => {
    it("should use shell.openExternal when contactSupport is not available", async () => {
      const user = userEvent.setup();

      // Remove contactSupport, keep openExternal
      window.api.system.contactSupport = undefined as any;

      render(<OfflineFallback isOffline={true} />);

      await user.click(screen.getByText("Contact Support"));

      expect(window.api.shell.openExternal).toHaveBeenCalledWith(
        expect.stringContaining("mailto:support@keeprcompliance.com"),
      );
    });
  });

  describe("isRetrying prop", () => {
    it("should show loading state when isRetrying is true", () => {
      render(<OfflineFallback isOffline={true} isRetrying={true} />);

      expect(screen.getByText("Checking...")).toBeInTheDocument();
    });

    it("should disable button when isRetrying is true", () => {
      render(<OfflineFallback isOffline={true} isRetrying={true} />);

      const button = screen.getByRole("button", { name: /checking/i });
      expect(button).toBeDisabled();
    });
  });
});
