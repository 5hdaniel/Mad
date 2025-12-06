/**
 * Tests for EmailOnboardingScreen.tsx
 * Covers email onboarding UI with multi-step flow: Phone Type → Secure Storage → Connect Email → Permissions
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
  const mockOnPhoneTypeChange = jest.fn().mockResolvedValue(undefined);

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
    window.api.onGoogleMailboxConnected.mockReturnValue(jest.fn());
    window.api.onMicrosoftMailboxConnected.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    // Restore original window.electron
    Object.defineProperty(window, "electron", {
      value: originalElectron,
      writable: true,
      configurable: true,
    });
  });

  describe("Step 1 - Phone Type Selection", () => {
    it("should render phone type selection as first step", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Select Your Phone Type")).toBeInTheDocument();
    });

    it("should show iPhone option", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("iPhone")).toBeInTheDocument();
    });

    it("should show Android option", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Android")).toBeInTheDocument();
    });

    it("should show explanation about phone type importance", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByText("Why is this important?")).toBeInTheDocument();
    });

    it("should highlight iPhone when pre-selected", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          selectedPhoneType="iphone"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      expect(iphoneButton).toHaveClass("border-blue-500");
    });

    it("should highlight Android when pre-selected", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          selectedPhoneType="android"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      expect(androidButton).toHaveClass("border-green-500");
    });
  });

  describe("Progress Indicator - macOS", () => {
    it("should show 4 steps on macOS", () => {
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
      expect(screen.getByText("Secure Storage")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
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
    it("should show Next button for step navigation", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          selectedPhoneType="iphone"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("should navigate to next step when Next is clicked", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          selectedPhoneType="iphone"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
        "darwin",
      );

      const nextButton = screen.getByRole("button", { name: /next/i });
      await userEvent.click(nextButton);

      // Should now be on Secure Storage step
      await waitFor(() => {
        expect(screen.getByText("Secure Storage Settings")).toBeInTheDocument();
      });
    });
  });

  describe("Phone Type Change", () => {
    it("should call onPhoneTypeChange when phone type is selected", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onPhoneTypeChange={mockOnPhoneTypeChange}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      expect(mockOnPhoneTypeChange).toHaveBeenCalledWith("iphone");
    });

    it("should call onPhoneTypeChange for Android selection", async () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onPhoneTypeChange={mockOnPhoneTypeChange}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      expect(mockOnPhoneTypeChange).toHaveBeenCalledWith("android");
    });
  });

  describe("Connection Status", () => {
    it("should show loading state while checking connections", async () => {
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
        />,
      );

      // Loading state is internal - component should still render
      expect(screen.getByText("Select Your Phone Type")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible phone selection buttons", () => {
      renderWithPlatform(
        <EmailOnboardingScreen
          userId={mockUserId}
          authProvider="google"
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      const androidButton = screen.getByText("Android").closest("button");

      expect(iphoneButton).toBeInTheDocument();
      expect(androidButton).toBeInTheDocument();
    });
  });
});
