/**
 * Tests for LicenseGate component
 * TASK-2159: Migrated from useLicense to useFeatureGate
 *
 * Verifies conditional rendering based on plan feature access via useFeatureGate.
 * Feature mapping:
 *   - "individual" -> isAllowed("text_export") || isAllowed("email_export")
 *   - "team"       -> isAllowed("broker_submission")
 *   - "enterprise" -> isAllowed("broker_submission")
 *   - "ai_addon"   -> isAllowed("ai_detection")
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LicenseGate } from "../LicenseGate";

// Mock the useFeatureGate hook
const mockIsAllowed = jest.fn();
const mockLoading = { value: false };
jest.mock("@/hooks/useFeatureGate", () => ({
  useFeatureGate: () => ({
    isAllowed: mockIsAllowed,
    features: {},
    loading: mockLoading.value,
    refresh: jest.fn(),
  }),
}));

/**
 * Helper to configure which features are allowed.
 * Pass a set of allowed feature keys.
 */
function setAllowedFeatures(allowed: Set<string>) {
  mockIsAllowed.mockImplementation((key: string) => allowed.has(key));
}

describe("LicenseGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading.value = false;
    // Default: no features allowed
    setAllowedFeatures(new Set());
  });

  describe("Loading state", () => {
    it("should render nothing while feature gate is loading", () => {
      mockLoading.value = true;
      setAllowedFeatures(new Set(["text_export", "email_export"]));

      render(
        <LicenseGate requires="individual">
          <span data-testid="content">Content</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });

  describe("Individual license gate (export features)", () => {
    it("should show children when text_export is allowed", () => {
      setAllowedFeatures(new Set(["text_export"]));

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("should show children when email_export is allowed", () => {
      setAllowedFeatures(new Set(["email_export"]));

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("should show children when both exports are allowed", () => {
      setAllowedFeatures(new Set(["text_export", "email_export"]));

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("should hide children when no export features are allowed", () => {
      setAllowedFeatures(new Set(["broker_submission"])); // Only submission, no export

      render(
        <LicenseGate requires="individual">
          <span data-testid="export-button">Export</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("export-button")).not.toBeInTheDocument();
    });

    it("should show fallback when gate fails", () => {
      setAllowedFeatures(new Set(["broker_submission"])); // No export

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

  describe("Team license gate (broker_submission)", () => {
    it("should show children when broker_submission is allowed", () => {
      setAllowedFeatures(new Set(["broker_submission"]));

      render(
        <LicenseGate requires="team">
          <span data-testid="submit-button">Submit for Review</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    });

    it("should hide children when broker_submission is not allowed", () => {
      setAllowedFeatures(new Set(["text_export"])); // Only export, no submission

      render(
        <LicenseGate requires="team">
          <span data-testid="submit-button">Submit for Review</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("submit-button")).not.toBeInTheDocument();
    });
  });

  describe("Enterprise license gate (broker_submission)", () => {
    it("should show children when broker_submission is allowed", () => {
      setAllowedFeatures(new Set(["broker_submission"]));

      render(
        <LicenseGate requires="enterprise">
          <span data-testid="enterprise-feature">Enterprise Feature</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("enterprise-feature")).toBeInTheDocument();
    });

    it("should hide children when broker_submission is not allowed", () => {
      setAllowedFeatures(new Set(["text_export"])); // Only export

      render(
        <LicenseGate requires="enterprise">
          <span data-testid="enterprise-feature">Enterprise Feature</span>
        </LicenseGate>
      );

      expect(screen.queryByTestId("enterprise-feature")).not.toBeInTheDocument();
    });
  });

  describe("AI add-on gate (ai_detection)", () => {
    it("should show children when ai_detection is allowed", () => {
      setAllowedFeatures(new Set(["ai_detection"]));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("ai-feature")).toBeInTheDocument();
    });

    it("should show children when ai_detection is allowed alongside other features", () => {
      setAllowedFeatures(new Set(["text_export", "ai_detection"]));

      render(
        <LicenseGate requires="ai_addon">
          <span data-testid="ai-feature">Auto Detect</span>
        </LicenseGate>
      );

      expect(screen.getByTestId("ai-feature")).toBeInTheDocument();
    });

    it("should hide children when ai_detection is not allowed", () => {
      setAllowedFeatures(new Set(["text_export", "email_export"])); // No AI

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
      setAllowedFeatures(new Set(["text_export"])); // Only export, no submission

      const { container } = render(
        <LicenseGate requires="team">
          <span>Hidden content</span>
        </LicenseGate>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("should render fallback element when provided and gate fails", () => {
      setAllowedFeatures(new Set(["text_export"])); // Only export

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
      setAllowedFeatures(new Set(["broker_submission"]));

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
    it("should handle plan with export + AI: can export and use AI features", () => {
      setAllowedFeatures(new Set(["text_export", "email_export", "ai_detection"]));

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

    it("should handle plan with submission only: can submit but no export or AI", () => {
      setAllowedFeatures(new Set(["broker_submission"]));

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

    it("should handle plan with submission + AI: can submit and use AI features", () => {
      setAllowedFeatures(new Set(["broker_submission", "ai_detection"]));

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

    it("should handle plan with all features", () => {
      setAllowedFeatures(new Set(["text_export", "email_export", "broker_submission", "ai_detection"]));

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
      expect(screen.getByTestId("submit")).toBeInTheDocument();
      expect(screen.getByTestId("ai")).toBeInTheDocument();
    });

    it("should handle plan with no features", () => {
      setAllowedFeatures(new Set()); // No features

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
      expect(screen.queryByTestId("submit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ai")).not.toBeInTheDocument();
    });
  });
});
