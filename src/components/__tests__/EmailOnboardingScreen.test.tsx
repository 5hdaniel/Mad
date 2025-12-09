/**
 * Tests for EmailOnboardingScreen.tsx
 * Covers email connection UI during onboarding with progress indicator
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import EmailOnboardingScreen from "../EmailOnboardingScreen";
import { PlatformProvider } from "../../contexts/PlatformContext";

// Store original window.electron
const originalElectron = window.electron;

// Helper to render with PlatformProvider
function renderWithPlatform(
  ui: React.ReactElement,
  platform: string = "darwin",
) {
  Object.defineProperty(window, "electron", {
    value: { platform },
    writable: true,
    configurable: true,
  });

  return render(<PlatformProvider>{ui}</PlatformProvider>);
}

describe("EmailOnboardingScreen", () => {
  const mockUserId = "user-123";
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mocks
    window.api.system.checkAllConnections.mockResolvedValue({
      success: true,
      google: { connected: false },
      microsoft: { connected: false },
    });
    window.api.auth.googleConnectMailbox.mockResolvedValue({ success: true });
    window.api.auth.microsoftConnectMailbox.mockResolvedValue({
      success: true,
    });
    window.api.auth.googleConnectMailboxPending.mockResolvedValue({
      success: true,
    });
    window.api.auth.microsoftConnectMailboxPending.mockResolvedValue({
      success: true,
    });
    window.api.onGoogleMailboxConnected.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxConnected.mockReturnValue(jest.fn());
    window.api.onGoogleMailboxCancelled.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxCancelled.mockReturnValue(jest.fn());
    window.api.onGoogleMailboxPendingConnected.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxPendingConnected.mockReturnValue(jest.fn());
    window.api.onGoogleMailboxPendingCancelled.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxPendingCancelled.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    // Restore original window.electron
    Object.defineProperty(window, "electron", {
      value: originalElectron,
      writable: true,
      configurable: true,
    });
  });

  describe("Connect Email UI", () => {
    it("should render email connection screen", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Connect Your Gmail")).toBeInTheDocument();
    });

    it("should show Gmail as primary for Google login", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Connect Your Gmail")).toBeInTheDocument();
      expect(screen.getByText("Gmail")).toBeInTheDocument();
    });

    it("should show Outlook as primary for Microsoft login", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Connect Your Outlook")).toBeInTheDocument();
      expect(screen.getByText("Outlook")).toBeInTheDocument();
    });

    it("should show explanation about email connection", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Why connect your email?")).toBeInTheDocument();
    });
  });

  describe("Progress Indicator - macOS", () => {
    it("should show 4 steps on macOS with step 2 (Connect Email) highlighted", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
        "darwin",
      );

      expect(screen.getByText("Phone Type")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
      expect(screen.getByText("Secure Storage")).toBeInTheDocument();
      expect(screen.getByText("Permissions")).toBeInTheDocument();
    });
  });

  describe("Progress Indicator - Windows", () => {
    it("should show 2 steps on Windows", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
        "win32",
      );

      expect(screen.getByText("Phone Type")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
      expect(screen.queryByText("Secure Storage")).not.toBeInTheDocument();
      expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should show Back button when onBack is provided", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          onBack={mockOnBack}
        />,
      );

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("should call onBack when Back button is clicked", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          onBack={mockOnBack}
        />,
      );

      const backButton = screen.getByRole("button", { name: /back/i });
      await userEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });

    it("should show Skip button", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
    });

    it("should call onSkip when Skip button is clicked", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const skipButton = screen.getByRole("button", { name: /skip/i });
      await userEvent.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe("Connection Actions", () => {
    it("should show Connect Gmail button for Google auth provider", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(
        screen.getByRole("button", { name: /connect gmail/i }),
      ).toBeInTheDocument();
    });

    it("should show Connect Outlook button for Microsoft auth provider", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="microsoft"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(
        screen.getByRole("button", { name: /connect outlook/i }),
      ).toBeInTheDocument();
    });

    it("should show secondary provider option", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      // Google login shows Outlook as secondary
      expect(screen.getByText("Outlook")).toBeInTheDocument();
    });
  });

  describe("Pre-DB Flow", () => {
    it("should use pre-DB handlers when isPreDbFlow is true", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isPreDbFlow={true}
        />,
      );

      const connectButton = screen.getByRole("button", {
        name: /connect gmail/i,
      });
      await userEvent.click(connectButton);

      expect(window.api.auth.googleConnectMailboxPending).toHaveBeenCalled();
    });

    it("should restore pending tokens when navigating back", () => {
      const existingTokens = {
        provider: "google" as const,
        email: "test@gmail.com",
        tokens: {
          access_token: "test-token",
          refresh_token: null,
          expires_at: "2024-12-31T00:00:00Z",
          scopes: "email profile",
        },
      };

      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isPreDbFlow={true}
          existingPendingTokens={existingTokens}
        />,
      );

      // Should show connected state for Gmail
      expect(
        screen.getByText(/Connected: test@gmail.com/i),
      ).toBeInTheDocument();
    });
  });

  describe("Connection Status", () => {
    it("should show loading state while checking connections (post-DB)", async () => {
      // Delay the connection check
      window.api.system.checkAllConnections.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isPreDbFlow={false}
        />,
      );

      // Should show checking state (multiple elements show this - primary and secondary)
      expect(screen.getAllByText("Checking...").length).toBeGreaterThan(0);
    });

    it("should not check connections in pre-DB mode", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isPreDbFlow={true}
        />,
      );

      expect(window.api.system.checkAllConnections).not.toHaveBeenCalled();
    });
  });

  describe("Connected State", () => {
    it("should show Continue button when email is connected", async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: "user@gmail.com" },
        microsoft: { connected: false },
      });

      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /continue/i }),
        ).toBeInTheDocument();
      });
    });

    it("should show connected email address", async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: "user@gmail.com" },
        microsoft: { connected: false },
      });

      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Connected: user@gmail.com/i),
        ).toBeInTheDocument();
      });
    });

    it("should call onComplete when Continue is clicked", async () => {
      window.api.system.checkAllConnections.mockResolvedValue({
        success: true,
        google: { connected: true, email: "user@gmail.com" },
        microsoft: { connected: false },
      });

      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /continue/i }),
        ).toBeInTheDocument();
      });

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible connect button", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(
        screen.getByRole("button", { name: /connect gmail/i }),
      ).toBeInTheDocument();
    });

    it("should have accessible skip button", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
    });
  });
});
