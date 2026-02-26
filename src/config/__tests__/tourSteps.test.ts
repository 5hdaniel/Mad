/**
 * Unit tests for tour steps configuration
 * Tests that all tour steps have proper configuration to prevent beacon display
 */

import {
  getDashboardTourSteps,
  getExportTourSteps,
  getTransactionsTourSteps,
  getAuditTourSteps,
  JOYRIDE_STYLES,
  JOYRIDE_LOCALE,
} from "../tourSteps";

describe("tourSteps configuration", () => {
  describe("getDashboardTourSteps", () => {
    const steps = getDashboardTourSteps();

    it("should return an array of steps", () => {
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should have disableBeacon set to true on ALL steps to prevent blue dot from appearing", () => {
      steps.forEach((step, index) => {
        expect(step.disableBeacon).toBe(true);
      });
    });

    it("should have required properties on each step", () => {
      steps.forEach((step) => {
        expect(step).toHaveProperty("target");
        expect(step).toHaveProperty("content");
        expect(step).toHaveProperty("placement");
      });
    });
  });

  describe("getExportTourSteps", () => {
    describe("with Outlook connected", () => {
      const steps = getExportTourSteps(true);

      it("should return an array of steps", () => {
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);
      });

      it("should have disableBeacon set to true on ALL steps to prevent blue dot from appearing", () => {
        steps.forEach((step, index) => {
          expect(step.disableBeacon).toBe(true);
        });
      });

      it("should have required properties on each step", () => {
        steps.forEach((step) => {
          expect(step).toHaveProperty("target");
          expect(step).toHaveProperty("content");
          expect(step).toHaveProperty("placement");
        });
      });
    });

    describe("with Outlook not connected", () => {
      const steps = getExportTourSteps(false);

      it("should return an array of steps", () => {
        expect(Array.isArray(steps)).toBe(true);
        expect(steps.length).toBeGreaterThan(0);
      });

      it("should have disableBeacon set to true on ALL steps to prevent blue dot from appearing", () => {
        steps.forEach((step, index) => {
          expect(step.disableBeacon).toBe(true);
        });
      });

      it("should have different content for Outlook-related steps when not connected", () => {
        const connectedSteps = getExportTourSteps(true);
        const disconnectedSteps = getExportTourSteps(false);

        // Export-all step should differ
        const exportAllConnected = connectedSteps.find(
          (s) => s.target === '[data-tour="export-all"]',
        );
        const exportAllDisconnected = disconnectedSteps.find(
          (s) => s.target === '[data-tour="export-all"]',
        );
        expect(exportAllConnected?.content).not.toBe(
          exportAllDisconnected?.content,
        );

        // Export-emails step should differ
        const exportEmailsConnected = connectedSteps.find(
          (s) => s.target === '[data-tour="export-emails"]',
        );
        const exportEmailsDisconnected = disconnectedSteps.find(
          (s) => s.target === '[data-tour="export-emails"]',
        );
        expect(exportEmailsConnected?.content).not.toBe(
          exportEmailsDisconnected?.content,
        );
      });
    });
  });

  describe("getTransactionsTourSteps", () => {
    const steps = getTransactionsTourSteps();

    it("should return an array of steps", () => {
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should have disableBeacon set to true on ALL steps to prevent blue dot from appearing", () => {
      steps.forEach((step) => {
        expect(step.disableBeacon).toBe(true);
      });
    });

    it("should have required properties on each step", () => {
      steps.forEach((step) => {
        expect(step).toHaveProperty("target");
        expect(step).toHaveProperty("content");
        expect(step).toHaveProperty("placement");
      });
    });

    it("should not exceed 6 steps", () => {
      expect(steps.length).toBeLessThanOrEqual(6);
    });

    it("should target transactions-specific data-tour attributes", () => {
      const targets = steps.map((s) => s.target);
      expect(targets).toContain('[data-tour="transactions-search"]');
      expect(targets).toContain('[data-tour="transactions-filter"]');
      expect(targets).toContain('[data-tour="transaction-card"]');
    });
  });

  describe("getAuditTourSteps", () => {
    const steps = getAuditTourSteps();

    it("should return an array of steps", () => {
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should have disableBeacon set to true on ALL steps to prevent blue dot from appearing", () => {
      steps.forEach((step) => {
        expect(step.disableBeacon).toBe(true);
      });
    });

    it("should have required properties on each step", () => {
      steps.forEach((step) => {
        expect(step).toHaveProperty("target");
        expect(step).toHaveProperty("content");
        expect(step).toHaveProperty("placement");
      });
    });

    it("should not exceed 6 steps", () => {
      expect(steps.length).toBeLessThanOrEqual(6);
    });

    it("should target audit-specific data-tour attributes", () => {
      const targets = steps.map((s) => s.target);
      expect(targets).toContain('[data-tour="audit-address"]');
      expect(targets).toContain('[data-tour="audit-transaction-type"]');
      expect(targets).toContain('[data-tour="audit-dates"]');
    });
  });

  describe("JOYRIDE_STYLES", () => {
    it("should have primary color defined", () => {
      expect(JOYRIDE_STYLES.options.primaryColor).toBe("#3b82f6");
    });

    it("should have high z-index for overlay", () => {
      expect(JOYRIDE_STYLES.options.zIndex).toBe(10000);
    });
  });

  describe("JOYRIDE_LOCALE", () => {
    it("should have custom last button text", () => {
      expect(JOYRIDE_LOCALE.last).toBe("Done");
    });
  });
});
