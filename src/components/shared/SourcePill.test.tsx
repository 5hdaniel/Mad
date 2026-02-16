import React from "react";
import { render, screen } from "@testing-library/react";
import { SourcePill, ContactSource } from "./SourcePill";

describe("SourcePill", () => {
  describe("variant mapping", () => {
    it('renders "Contacts App" for source="imported"', () => {
      render(<SourcePill source="imported" />);
      expect(screen.getByText("Contacts App")).toBeInTheDocument();
      expect(screen.getByTestId("source-pill-contacts_app")).toBeInTheDocument();
    });

    it('renders "Manual" for source="manual"', () => {
      render(<SourcePill source="manual" />);
      expect(screen.getByText("Manual")).toBeInTheDocument();
      expect(screen.getByTestId("source-pill-manual")).toBeInTheDocument();
    });

    it('renders "Contacts App" for source="contacts_app"', () => {
      render(<SourcePill source="contacts_app" />);
      expect(screen.getByText("Contacts App")).toBeInTheDocument();
      expect(screen.getByTestId("source-pill-contacts_app")).toBeInTheDocument();
    });

    it('renders "Contacts App" for source="external"', () => {
      render(<SourcePill source="external" />);
      expect(screen.getByText("Contacts App")).toBeInTheDocument();
      expect(screen.getByTestId("source-pill-contacts_app")).toBeInTheDocument();
    });

    it('renders "Message" for source="sms"', () => {
      render(<SourcePill source="sms" />);
      expect(screen.getByText("Message")).toBeInTheDocument();
      expect(screen.getByTestId("source-pill-message")).toBeInTheDocument();
    });

    it('renders "Outlook" for source="outlook"', () => {
      render(<SourcePill source="outlook" />);
      expect(screen.getByText("Outlook")).toBeInTheDocument();
      expect(screen.getByTestId("source-pill-outlook")).toBeInTheDocument();
    });
  });

  describe("size variants", () => {
    it("applies sm size by default", () => {
      render(<SourcePill source="contacts_app" />);
      const pill = screen.getByTestId("source-pill-contacts_app");
      expect(pill).toHaveClass("px-2", "py-0.5", "text-xs");
    });

    it("applies md size when specified", () => {
      render(<SourcePill source="contacts_app" size="md" />);
      const pill = screen.getByTestId("source-pill-contacts_app");
      expect(pill).toHaveClass("px-2.5", "py-1", "text-sm");
    });
  });

  describe("styling", () => {
    it("applies violet styles for contacts_app variant", () => {
      render(<SourcePill source="contacts_app" />);
      const pill = screen.getByTestId("source-pill-contacts_app");
      expect(pill).toHaveClass("bg-violet-100", "text-violet-700");
    });

    it("applies violet styles for external variant", () => {
      render(<SourcePill source="external" />);
      const pill = screen.getByTestId("source-pill-contacts_app");
      expect(pill).toHaveClass("bg-violet-100", "text-violet-700");
    });

    it("applies amber styles for message variant", () => {
      render(<SourcePill source="sms" />);
      const pill = screen.getByTestId("source-pill-message");
      expect(pill).toHaveClass("bg-amber-100", "text-amber-700");
    });

    it("applies green styles for manual variant", () => {
      render(<SourcePill source="manual" />);
      const pill = screen.getByTestId("source-pill-manual");
      expect(pill).toHaveClass("bg-green-100", "text-green-700");
    });

    it("applies indigo styles for outlook variant", () => {
      render(<SourcePill source="outlook" />);
      const pill = screen.getByTestId("source-pill-outlook");
      expect(pill).toHaveClass("bg-indigo-100", "text-indigo-700");
    });

    it("applies custom className", () => {
      render(<SourcePill source="contacts_app" className="custom-class" />);
      const pill = screen.getByTestId("source-pill-contacts_app");
      expect(pill).toHaveClass("custom-class");
    });
  });

  describe("accessibility", () => {
    it("renders as a span element", () => {
      render(<SourcePill source="contacts_app" />);
      const pill = screen.getByTestId("source-pill-contacts_app");
      expect(pill.tagName).toBe("SPAN");
    });

    it("has correct test IDs for each variant", () => {
      const sources: ContactSource[] = ["contacts_app", "external", "sms"];
      const expectedTestIds = [
        "source-pill-contacts_app",
        "source-pill-contacts_app",
        "source-pill-message",
      ];

      sources.forEach((source, index) => {
        const { unmount } = render(<SourcePill source={source} />);
        expect(screen.getByTestId(expectedTestIds[index])).toBeInTheDocument();
        unmount();
      });
    });
  });
});
