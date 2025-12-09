/**
 * Tests for PhoneTypeSelection.tsx
 * Covers phone type selection UI, platform-specific progress bars, and navigation
 *
 * The component uses a two-step flow:
 * 1. Select phone type (sets local state, shows selection visually)
 * 2. Click Continue button to proceed (calls onSelectIPhone/onSelectAndroid)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import PhoneTypeSelection from "../PhoneTypeSelection";
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

describe("PhoneTypeSelection", () => {
  const mockOnSelectIPhone = jest.fn();
  const mockOnSelectAndroid = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.electron
    Object.defineProperty(window, "electron", {
      value: originalElectron,
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

      expect(screen.getByText("Select Your Phone Type")).toBeInTheDocument();
    });

    it("should show explanation text", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(
        screen.getByText(/why is this important\?/i),
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

    it("should show Continue button", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });

    it("should have Continue button disabled when no selection made", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const continueButton = screen.getByRole("button", { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });
  });

  describe("Phone Selection Flow", () => {
    it("should enable Continue button after selecting iPhone", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it("should call onSelectIPhone when Continue is clicked after selecting iPhone", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnSelectIPhone).toHaveBeenCalledTimes(1);
      expect(mockOnSelectAndroid).not.toHaveBeenCalled();
    });

    it("should enable Continue button after selecting Android", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });

    it("should call onSelectAndroid when Continue is clicked after selecting Android", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnSelectAndroid).toHaveBeenCalledTimes(1);
      expect(mockOnSelectIPhone).not.toHaveBeenCalled();
    });

    it("should allow changing selection before clicking Continue", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      // First select iPhone
      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      // iPhone should be selected
      expect(iphoneButton).toHaveClass("border-blue-500");

      // Then switch to Android
      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      // Android should now be selected
      expect(androidButton).toHaveClass("border-green-500");

      // Click Continue should call Android handler
      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnSelectAndroid).toHaveBeenCalledTimes(1);
      expect(mockOnSelectIPhone).not.toHaveBeenCalled();
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
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
      expect(screen.getByText("Secure Storage")).toBeInTheDocument();
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
    it("should show 2 steps on Windows (no Secure Storage or Permissions)", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
        "win32",
      );

      expect(screen.getByText("Phone Type")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();

      // Secure Storage and Permissions should NOT be present
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

    it("should have accessible Continue button", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe("Visual Feedback", () => {
    it("should show blue border when iPhone is selected", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      expect(iphoneButton).toHaveClass(
        "border-blue-500",
        "bg-blue-50",
        "ring-2",
        "ring-blue-200",
      );
    });

    it("should show green border when Android is selected", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      expect(androidButton).toHaveClass(
        "border-green-500",
        "bg-green-50",
        "ring-2",
        "ring-green-200",
      );
    });

    it("should show Continue button in green when selection is made", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      expect(continueButton).toHaveClass("bg-green-500");
    });

    it("should show checkmark when iPhone is selected", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      await userEvent.click(iphoneButton!);

      // The checkmark SVG should appear within the iPhone button
      const checkmarks = iphoneButton?.querySelectorAll("svg");
      // Should have Apple logo SVG + checkmark SVG when selected
      expect(checkmarks?.length).toBeGreaterThan(1);
    });

    it("should show checkmark when Android is selected", async () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
        />,
      );

      const androidButton = screen.getByText("Android").closest("button");
      await userEvent.click(androidButton!);

      // The checkmark SVG should appear within the Android button
      const checkmarks = androidButton?.querySelectorAll("svg");
      // Should have Android logo SVG + checkmark SVG when selected
      expect(checkmarks?.length).toBeGreaterThan(1);
    });

    it("should pre-select based on selectedType prop", () => {
      renderWithPlatform(
        <PhoneTypeSelection
          onSelectIPhone={mockOnSelectIPhone}
          onSelectAndroid={mockOnSelectAndroid}
          selectedType="iphone"
        />,
      );

      const iphoneButton = screen.getByText("iPhone").closest("button");
      expect(iphoneButton).toHaveClass("border-blue-500");

      // Continue button should be enabled
      const continueButton = screen.getByRole("button", { name: /continue/i });
      expect(continueButton).not.toBeDisabled();
    });
  });
});
