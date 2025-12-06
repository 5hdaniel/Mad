/**
 * Tests for KeychainExplanation.tsx
 * Covers keychain explanation UI, progress indicator, and user interactions
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import KeychainExplanation from "../KeychainExplanation";

describe("KeychainExplanation", () => {
  const mockOnContinue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Full Explanation Mode", () => {
    it("should render the full explanation screen by default", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      expect(screen.getByText("Secure Storage Setup")).toBeInTheDocument();
      expect(
        screen.getByText("Protect your data with Keychain"),
      ).toBeInTheDocument();
    });

    it("should show returning user text when hasPendingLogin is false", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          hasPendingLogin={false}
        />,
      );

      expect(
        screen.getByText(
          /Magic Audit needs to access your Mac's Keychain to decrypt your local database/i,
        ),
      ).toBeInTheDocument();
    });

    it("should show new user text when hasPendingLogin is true", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          hasPendingLogin={true}
        />,
      );

      expect(
        screen.getByText(
          /Magic Audit needs to set up secure storage on your Mac to protect your data/i,
        ),
      ).toBeInTheDocument();
    });

    it('should show "Always Allow" tip', () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      expect(screen.getByText(/Always Allow/i)).toBeInTheDocument();
    });

    it('should show "Don\'t show again" checkbox', () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      expect(
        screen.getByText(/Don't show this explanation again/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should show Continue button", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      expect(
        screen.getByRole("button", { name: /continue/i }),
      ).toBeInTheDocument();
    });

    it("should call onContinue with false when Continue is clicked without checkbox", async () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnContinue).toHaveBeenCalledWith(false);
    });

    it("should call onContinue with true when Continue is clicked with checkbox checked", async () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      const checkbox = screen.getByRole("checkbox");
      await userEvent.click(checkbox);

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnContinue).toHaveBeenCalledWith(true);
    });
  });

  describe("Progress Indicator", () => {
    it("should show 4 setup steps in full explanation mode", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Secure Storage")).toBeInTheDocument();
      expect(screen.getByText("Connect Email")).toBeInTheDocument();
      expect(screen.getByText("Permissions")).toBeInTheDocument();
    });

    it("should highlight step 2 (Secure Storage) as current step", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      // Step 2 text should have the highlighted style class
      const secureStorageLabel = screen.getByText("Secure Storage");
      expect(secureStorageLabel).toHaveClass("text-blue-600", "font-medium");
    });

    it("should show step 1 (Sign In) as completed", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      // Step 1 should show a checkmark (completed state)
      const signInLabel = screen.getByText("Sign In");
      expect(signInLabel).not.toHaveClass("text-blue-600");
    });
  });

  describe("Loading State", () => {
    it("should show loading spinner when isLoading is true", () => {
      render(
        <KeychainExplanation onContinue={mockOnContinue} isLoading={true} />,
      );

      expect(
        screen.getByText(/Please enter your password in the system dialog/i),
      ).toBeInTheDocument();
    });

    it("should hide Continue button when loading", () => {
      render(
        <KeychainExplanation onContinue={mockOnContinue} isLoading={true} />,
      );

      expect(
        screen.queryByRole("button", { name: /continue/i }),
      ).not.toBeInTheDocument();
    });

    it("should hide checkbox when loading", () => {
      render(
        <KeychainExplanation onContinue={mockOnContinue} isLoading={true} />,
      );

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });
  });

  describe("Simple Waiting Mode (skipExplanation)", () => {
    it("should show simple waiting screen when skipExplanation is true", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={false}
        />,
      );

      expect(screen.getByText("Keychain Access")).toBeInTheDocument();
      expect(
        screen.getByText(/Click continue to enter your Mac password/i),
      ).toBeInTheDocument();
    });

    it("should not show progress indicator in simple waiting mode", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={false}
        />,
      );

      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      expect(screen.queryByText("Secure Storage")).not.toBeInTheDocument();
    });

    it("should show full explanation even with skipExplanation if hasPendingLogin is true", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={true}
        />,
      );

      // Should show full explanation for new users
      expect(screen.getByText("Secure Storage Setup")).toBeInTheDocument();
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    it("should show Continue button in simple waiting mode", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={false}
        />,
      );

      expect(
        screen.getByRole("button", { name: /continue/i }),
      ).toBeInTheDocument();
    });

    it("should call onContinue when Continue is clicked in simple mode", async () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={false}
        />,
      );

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await userEvent.click(continueButton);

      expect(mockOnContinue).toHaveBeenCalledWith(false);
    });

    it("should show loading state in simple waiting mode", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={false}
          isLoading={true}
        />,
      );

      expect(screen.getByText("Waiting for Authorization")).toBeInTheDocument();
      expect(
        screen.getByText(/Please enter your password in the system dialog/i),
      ).toBeInTheDocument();
    });

    it("should hide Continue button when loading in simple mode", () => {
      render(
        <KeychainExplanation
          onContinue={mockOnContinue}
          skipExplanation={true}
          hasPendingLogin={false}
          isLoading={true}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /continue/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible Continue button", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      expect(
        screen.getByRole("button", { name: /continue/i }),
      ).toBeInTheDocument();
    });

    it("should have accessible checkbox with label", () => {
      render(<KeychainExplanation onContinue={mockOnContinue} />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });
  });
});
