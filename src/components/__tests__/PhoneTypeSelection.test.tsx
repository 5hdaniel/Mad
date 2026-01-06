/**
 * Tests for PhoneTypeSelection.tsx
 * Covers phone type selection UI, platform-specific progress bars, and navigation
 *
 * The component uses a single-click flow:
 * - Clicking a phone card immediately calls onSelectIPhone/onSelectAndroid
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import PhoneTypeSelection from "../PhoneTypeSelection";
import { PlatformProvider } from "../../contexts/PlatformContext";

// Store original window.api
const originalApi = window.api;

// Helper to render with PlatformProvider
function renderWithPlatform(
  ui: React.ReactElement,
  platform: string = "darwin",
) {
  Object.defineProperty(window, "api", {
    value: { ...originalApi, system: { ...originalApi?.system, platform } },
    writable: true,
    configurable: true,
  });

  return render(<PlatformProvider>{ui}</PlatformProvider>);
}

describe("PhoneTypeSelection", () => {
  const mockOnSelectIPhone = jest.fn();
  const mockOnSelectAndroid = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.api
    Object.defineProperty(window, "api", {
      value: originalApi,
      writable: true,
      configurable: true,
    });
  });

  describe("Rendering", () => {
    it("should render the phone type selection screen", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(screen.getByText("What phone do you use?")).toBeInTheDocument();
    });

    it("should show explanation text about syncing", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(
        screen.getByText(/magic audit can sync your text messages/i),
      ).toBeInTheDocument();
    });

    it("should show iPhone option", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(screen.getByText("iPhone")).toBeInTheDocument();
      expect(
        screen.getByText(/sync messages and contacts from your iphone/i),
      ).toBeInTheDocument();
    });

    it("should show Android option", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(screen.getByText("Android")).toBeInTheDocument();
      expect(
        screen.getByText(/samsung, google pixel, and other android phones/i),
      ).toBeInTheDocument();
    });

    it("should show privacy info box", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(
        screen.getByText(/your phone data stays private and secure/i),
      ).toBeInTheDocument();
    });
  });

  describe("Phone Selection Flow", () => {
    it("should call onSelectIPhone when iPhone card is clicked", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      expect(mockOnSelectIPhone).toHaveBeenCalledTimes(1);
      expect(mockOnSelectAndroid).not.toHaveBeenCalled();
    });

    it("should call onSelectAndroid when Android card is clicked", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      expect(mockOnSelectAndroid).toHaveBeenCalledTimes(1);
      expect(mockOnSelectIPhone).not.toHaveBeenCalled();
    });

    it("should disable buttons while submitting", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      // After clicking, button should be disabled (isSubmitting = true)
      expect(iphoneButton).toBeDisabled();
    });
  });

  describe("Progress Indicator - macOS", () => {
    it("should show 4 steps on macOS", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        "darwin",
      );

      expect(screen.getByText("Phone Type")).toBeInTheDocument();
      expect(screen.getByText("Secure Storage")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
      expect(screen.getByText("Permissions")).toBeInTheDocument();
    });

    it("should highlight Phone Type as current step on macOS", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        "darwin",
      );

      // Phone Type should have the blue active styling
      const phoneTypeLabel = screen.getByText("Phone Type");
      expect(phoneTypeLabel).toHaveClass("text-blue-600", "font-medium");
    });
  });

  describe("Progress Indicator - Windows", () => {
    it("should show 3 steps on Windows with Install Tools instead of Permissions", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        "win32",
      );

      expect(screen.getByText("Phone Type")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
      expect(screen.getByText("Install Tools")).toBeInTheDocument();

      // macOS-only steps should NOT be present
      expect(screen.queryByText("Secure Storage")).not.toBeInTheDocument();
      expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
    });

    it("should highlight Phone Type as current step on Windows", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        "win32",
      );

      const phoneTypeLabel = screen.getByText("Phone Type");
      expect(phoneTypeLabel).toHaveClass("text-blue-600", "font-medium");
    });
  });

  describe("Accessibility", () => {
    it("should have accessible iPhone button", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      expect(iphoneButton).toBeInTheDocument();
    });

    it("should have accessible Android button", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      expect(androidButton).toBeInTheDocument();
    });
  });

  describe("Visual Feedback", () => {
    it("should show blue border when iPhone is pre-selected", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
          selectedType="iphone"
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      expect(iphoneButton).toHaveClass(
        "border-blue-500",
        "bg-blue-50",
        "ring-2",
        "ring-blue-200",
      );
    });

    it("should show green border when Android is pre-selected", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
          selectedType="android"
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      expect(androidButton).toHaveClass(
        "border-green-500",
        "bg-green-50",
        "ring-2",
        "ring-green-200",
      );
    });

    it("should show checkmark when iPhone is pre-selected", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
          selectedType="iphone"
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      // The checkmark SVG should appear within the iPhone button
      const checkmarks = iphoneButton?.querySelectorAll("svg");
      // Should have Apple logo SVG + checkmark SVG when selected
      expect(checkmarks?.length).toBeGreaterThan(1);
    });

    it("should show checkmark when Android is pre-selected", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
          selectedType="android"
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      // The checkmark SVG should appear within the Android button
      const checkmarks = androidButton?.querySelectorAll("svg");
      // Should have Android logo SVG + checkmark SVG when selected
      expect(checkmarks?.length).toBeGreaterThan(1);
    });
  });
});
