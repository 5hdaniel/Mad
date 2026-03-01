/**
 * Tests for ContactSourceStep (TASK-2098)
 *
 * Covers:
 * - Meta configuration (hideContinue, platforms, skip)
 * - Platform-specific rendering (both sources on macOS, only Outlook on Windows)
 * - Saving preferences on Continue click
 * - Skipping defaults to all sources enabled
 *
 * @module onboarding/steps/__tests__/ContactSourceStep.test
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContactSourceStep from "../ContactSourceStep";
import type { OnboardingContext } from "../../types";

// Mock the platform context
jest.mock("../../../../contexts/PlatformContext", () => ({
  usePlatform: jest.fn(() => ({ isMacOS: true })),
}));

import { usePlatform } from "../../../../contexts/PlatformContext";

// Mock context for testing
const createMockContext = (
  overrides: Partial<OnboardingContext> = {}
): OnboardingContext => ({
  phoneType: null,
  emailConnected: false,
  connectedEmail: null,
  emailSkipped: false,
  driverSkipped: false,
  driverSetupComplete: false,
  permissionsGranted: false,
  termsAccepted: true,
  emailProvider: null,
  authProvider: "google",
  isNewUser: true,
  isDatabaseInitialized: false,
  platform: "macos",
  userId: "test-user-123",
  isUserVerifiedInLocalDb: false,
  ...overrides,
});

describe("ContactSourceStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: macOS platform
    (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

    // Default: preferences API mocks
    window.api.preferences.update.mockResolvedValue({ success: true });
  });

  // =========================================================================
  // META TESTS
  // =========================================================================

  describe("meta", () => {
    it("has correct meta.id", () => {
      expect(ContactSourceStep.meta.id).toBe("contact-source");
    });

    it("supports both platforms", () => {
      expect(ContactSourceStep.meta.platforms).toContain("macos");
      expect(ContactSourceStep.meta.platforms).toContain("windows");
    });

    it("hides shell Continue button (custom Continue inside component)", () => {
      expect(ContactSourceStep.meta.navigation?.hideContinue).toBe(true);
    });

    it("shows back button", () => {
      expect(ContactSourceStep.meta.navigation?.showBack).toBe(true);
    });

    it("has skip enabled with descriptive label", () => {
      expect(ContactSourceStep.meta.skip?.enabled).toBe(true);
      expect(ContactSourceStep.meta.skip?.label).toBeDefined();
    });
  });

  // =========================================================================
  // PLATFORM RENDERING TESTS
  // =========================================================================

  describe("Content - macOS", () => {
    it("renders both source cards on macOS", () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });

      render(
        <ContactSourceStep.Content
          context={createMockContext()}
          onAction={jest.fn()}
        />
      );

      expect(screen.getByText("macOS Contacts App")).toBeInTheDocument();
      expect(screen.getByText("Outlook / Microsoft 365")).toBeInTheDocument();
    });

    it("renders heading text", () => {
      render(
        <ContactSourceStep.Content
          context={createMockContext()}
          onAction={jest.fn()}
        />
      );

      expect(
        screen.getByText("Where do you save your contacts?")
      ).toBeInTheDocument();
    });
  });

  describe("Content - Windows", () => {
    it("renders only Outlook on Windows", () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: false });

      render(
        <ContactSourceStep.Content
          context={createMockContext({ platform: "windows" })}
          onAction={jest.fn()}
        />
      );

      // macOS Contacts should NOT appear on Windows
      expect(screen.queryByText("macOS Contacts App")).not.toBeInTheDocument();
      // Outlook should appear
      expect(screen.getByText("Outlook / Microsoft 365")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SAVE PREFERENCES TESTS
  // =========================================================================

  describe("Content - Continue saves preferences", () => {
    it("saves preferences on Continue click", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });
      const onAction = jest.fn();

      render(
        <ContactSourceStep.Content
          context={createMockContext()}
          onAction={onAction}
        />
      );

      // Click Continue
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        // Should save preferences with both sources enabled (default)
        expect(window.api.preferences.update).toHaveBeenCalledWith(
          "test-user-123",
          {
            contactSources: {
              direct: {
                macosContacts: true,
                outlookContacts: true,
              },
            },
          }
        );
      });

      // Should navigate next after saving
      await waitFor(() => {
        expect(onAction).toHaveBeenCalledWith({ type: "NAVIGATE_NEXT" });
      });
    });

    it("saves deselected source as false", async () => {
      (usePlatform as jest.Mock).mockReturnValue({ isMacOS: true });
      const onAction = jest.fn();

      render(
        <ContactSourceStep.Content
          context={createMockContext()}
          onAction={onAction}
        />
      );

      // Deselect macOS Contacts by clicking it (it starts selected)
      fireEvent.click(screen.getByText("macOS Contacts App"));

      // Click Continue
      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(window.api.preferences.update).toHaveBeenCalledWith(
          "test-user-123",
          {
            contactSources: {
              direct: {
                macosContacts: false,
                outlookContacts: true,
              },
            },
          }
        );
      });
    });

    it("proceeds without saving when no userId in context", async () => {
      const onAction = jest.fn();

      render(
        <ContactSourceStep.Content
          context={createMockContext({ userId: null })}
          onAction={onAction}
        />
      );

      fireEvent.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(onAction).toHaveBeenCalledWith({ type: "NAVIGATE_NEXT" });
      });

      // Should NOT have called preferences.update
      expect(window.api.preferences.update).not.toHaveBeenCalled();
    });

    it("continues even if preferences save fails (fail-open)", async () => {
      window.api.preferences.update.mockRejectedValue(
        new Error("Save failed")
      );
      const onAction = jest.fn();

      render(
        <ContactSourceStep.Content
          context={createMockContext()}
          onAction={onAction}
        />
      );

      fireEvent.click(screen.getByText("Continue"));

      // Should still navigate next despite error
      await waitFor(() => {
        expect(onAction).toHaveBeenCalledWith({ type: "NAVIGATE_NEXT" });
      });
    });
  });
});
