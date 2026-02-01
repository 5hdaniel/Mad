/**
 * Tests for LicenseGate component
 * Verifies conditional rendering based on license type and AI add-on status
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LicenseGate } from "../LicenseGate";
import type { LicenseType } from "../../../../electron/types/models";

// Mock the useLicense hook
jest.mock("@/contexts/LicenseContext", () => ({
  useLicense: jest.fn(),
}));

import { useLicense } from "@/contexts/LicenseContext";

const mockUseLicense = useLicense as jest.MockedFunction<typeof useLicense>;

// Helper to create mock license context value
function createMockLicenseContext(
  licenseType: LicenseType = "individual",
  hasAIAddon = false,
  isLoading = false
) {
  return {
    licenseType,
    hasAIAddon,
    organizationId: licenseType === "individual" ? null : "org-123",
    canExport: licenseType === "individual",
    canSubmit: licenseType === "team" || licenseType === "enterprise",
    canAutoDetect: hasAIAddon,
    isLoading,
    refresh: jest.fn(),
  };
}

describe("LicenseGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state", () => {
    it("should render nothing while license is loading", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, true));

      render(
        <LicenseGate requires="individual">
          <span data-testid="content">Content</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  describe("Individual license gate", () => {
    it("should show children when user has individual license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("should hide children when user has team license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("export-button")).not.toBeInTheDocument();
    });

    it("should hide children when user has enterprise license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("enterprise", false, false));

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("export-button")).not.toBeInTheDocument();
    });

    it("should show fallback when gate fails", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <LicenseGate
          requires="individual"
          fallback={<span data-testid="fallback">Upgrade to export</span>}
        >
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("export-button")).not.toBeInTheDocument();
      expect(screen.getByTestId("fallback")).toBeInTheDocument();
    });
  });

  describe("Team license gate", () => {
    it("should show children when user has team license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <LicenseGate requires="team">
          <span data-testid="submit-button">Submit for Review</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    });

    it("should show children when user has enterprise license (includes team)", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("enterprise", false, false));

      render(
        <LicenseGate requires="team">
          <span data-testid="submit-button">Submit for Review</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    });

    it("should hide children when user has individual license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));

      render(
        <LicenseGate requires="team">
          <span data-testid="submit-button">Submit for Review</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("submit-button")).not.toBeInTheDocument();
    });
  });

  describe("Enterprise license gate", () => {
    it("should show children when user has enterprise license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("enterprise", false, false));

      render(
        <LicenseGate requires="enterprise">
          <span data-testid="enterprise-feature">Enterprise Feature</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("enterprise-feature")).toBeInTheDocument();
    });

    it("should hide children when user has team license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <LicenseGate requires="enterprise">
          <span data-testid="enterprise-feature">Enterprise Feature</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("enterprise-feature")).not.toBeInTheDocument();
    });

    it("should hide children when user has individual license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));

      render(
        <LicenseGate requires="enterprise">
          <span data-testid="enterprise-feature">Enterprise Feature</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("enterprise-feature")).not.toBeInTheDocument();
    });
  });

  describe("AI add-on gate", () => {
    it("should show children when AI add-on is enabled with individual license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", true, false));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("ai-feature")).toBeInTheDocument();
    });

    it("should show children when AI add-on is enabled with team license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", true, false));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("ai-feature")).toBeInTheDocument();
    });

    it("should show children when AI add-on is enabled with enterprise license", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("enterprise", true, false));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("ai-feature")).toBeInTheDocument();
    });

    it("should hide children when AI add-on is not enabled", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("ai-feature")).not.toBeInTheDocument();
    });

    it("should hide children for team license without AI add-on", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("ai-feature")).not.toBeInTheDocument();
    });
  });

  describe("Fallback behavior", () => {
    it("should render null when no fallback provided and gate fails", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));

      const { container } = render(
        <LicenseGate requires="team">
          <span>Hidden content</span>
        </LicenseGate>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("should render fallback element when provided and gate fails", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", false, false));

      render(
        <LicenseGate
          requires="team"
          fallback={<div data-testid="upgrade-prompt">Upgrade to Team</div>}
        >
          <span>Hidden content</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
      expect(screen.getByText("Upgrade to Team")).toBeInTheDocument();
    });

    it("should not render fallback when gate passes", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <LicenseGate
          requires="team"
          fallback={<div data-testid="upgrade-prompt">Upgrade to Team</div>}
        >
          <span data-testid="content">Visible content</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(screen.queryByTestId("upgrade-prompt")).not.toBeInTheDocument();
    });
  });

  describe("Integration scenarios", () => {
    it("should correctly handle Individual with AI: can export and use AI features", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("individual", true, false));

      render(
        <>
          <LicenseGate requires="individual">
            <span data-testid="export">Export</span>
          </LicenseGate>
          <LicenseGate requires="team">
            <span data-testid="submit">Submit</span>
          </LicenseGate>
          <LicenseGate requires="ai_addon">
            <span data-testid="ai">AI Features</span>
          </LicenseGate>
        </>
      );

      expect(screen.getByTestId("export")).toBeInTheDocument();
      expect(screen.queryByTestId("submit")).not.toBeInTheDocument();
      expect(screen.getByTestId("ai")).toBeInTheDocument();
    });

    it("should correctly handle Team without AI: can submit but no AI features", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", false, false));

      render(
        <>
          <LicenseGate requires="individual">
            <span data-testid="export">Export</span>
          </LicenseGate>
          <LicenseGate requires="team">
            <span data-testid="submit">Submit</span>
          </LicenseGate>
          <LicenseGate requires="ai_addon">
            <span data-testid="ai">AI Features</span>
          </LicenseGate>
        </>
      );

      expect(screen.queryByTestId("export")).not.toBeInTheDocument();
      expect(screen.getByTestId("submit")).toBeInTheDocument();
      expect(screen.queryByTestId("ai")).not.toBeInTheDocument();
    });

    it("should correctly handle Team with AI: can submit and use AI features", () => {
      mockUseLicense.mockReturnValue(createMockLicenseContext("team", true, false));

      render(
        <>
          <LicenseGate requires="individual">
            <span data-testid="export">Export</span>
          </LicenseGate>
          <LicenseGate requires="team">
            <span data-testid="submit">Submit</span>
          </LicenseGate>
          <LicenseGate requires="ai_addon">
            <span data-testid="ai">AI Features</span>
          </LicenseGate>
        </>
      );

      expect(screen.queryByTestId("export")).not.toBeInTheDocument();
      expect(screen.getByTestId("submit")).toBeInTheDocument();
      expect(screen.getByTestId("ai")).toBeInTheDocument();
    });
  });
});
