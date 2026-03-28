/**
 * Tests for GoogleExport.tsx (TASK-1416)
 * Covers export flow, authentication check, and IPC communication
 * Mirrors OutlookExport.test.tsx patterns
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import GoogleExport from "../GoogleExport";

describe("GoogleExport", () => {
  const mockConversations = [
    {
      id: "conv-1",
      name: "John Client",
      emails: ["john@example.com"],
      phones: ["555-1234"],
    },
    {
      id: "conv-2",
      name: "Jane Agent",
      emails: ["jane@realty.com"],
      phones: ["555-5678"],
    },
    {
      id: "conv-3",
      name: "Bob Buyer",
      emails: [],
      phones: ["555-9999"],
    },
  ];

  const mockSelectedIds = new Set(["conv-1", "conv-2"]);
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks - not authenticated
    window.api.googleExport.initialize.mockResolvedValue({ success: true });
    window.api.googleExport.isAuthenticated.mockResolvedValue(false);
    window.api.googleExport.exportEmails.mockResolvedValue({
      success: true,
      exportPath: "/path/to/export",
      results: [
        {
          contactName: "John Client",
          success: true,
          textMessageCount: 10,
          emailCount: 5,
          error: null,
        },
        {
          contactName: "Jane Agent",
          success: true,
          textMessageCount: 5,
          emailCount: 3,
          error: null,
        },
      ],
    });
    window.api.shell.openFolder.mockResolvedValue({ success: true });
    window.api.googleExport.onExportProgress.mockReturnValue(jest.fn());
  });

  describe("Initialization", () => {
    it("should show loading state during initialization", () => {
      window.api.googleExport.initialize.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.getByText(/initializing google/i)).toBeInTheDocument();
    });

    it("should call initialize on mount", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(window.api.googleExport.initialize).toHaveBeenCalled();
      });
    });

    it("should check authentication status after initialization", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(window.api.googleExport.isAuthenticated).toHaveBeenCalled();
      });
    });

    it("should show error when initialization fails", async () => {
      window.api.googleExport.initialize.mockResolvedValue({
        success: false,
        error: "Gmail API unavailable",
      });

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
        expect(
          screen.getByText(/gmail api unavailable/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Authentication", () => {
    it("should show connect screen when not authenticated", async () => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(false);

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/connect google/i)).toBeInTheDocument();
      });
    });

    it("should show export screen when authenticated", async () => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(
        () => {
          expect(
            screen.getAllByText(/full audit export/i).length,
          ).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Export Screen", () => {
    beforeEach(() => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);
    });

    it("should display selected contacts with emails", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(
        () => {
          expect(
            screen.getAllByText(/full audit export/i).length,
          ).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(
            screen.queryByText("John Client") ||
              screen.queryByText("Jane Agent"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("should show contacts without email separately", async () => {
      const selectedWithoutEmail = new Set(["conv-3"]);

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={selectedWithoutEmail}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getAllByText(/full audit export/i).length,
        ).toBeGreaterThan(0);
      });

      expect(screen.getByText("Bob Buyer")).toBeInTheDocument();
      expect(screen.getByText(/no email address found/i)).toBeInTheDocument();
    });

    it("should show export button", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getAllByText(/full audit export/i).length,
        ).toBeGreaterThan(0);
      });

      expect(
        screen.getByRole("button", { name: /export 2 audits/i }),
      ).toBeInTheDocument();
    });

    it("should show back button", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getAllByText(/full audit export/i).length,
        ).toBeGreaterThan(0);
      });

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });
  });

  describe("Export Process", () => {
    beforeEach(() => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);
    });

    it("should call export API when export button is clicked", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      expect(window.api.googleExport.exportEmails).toHaveBeenCalledWith([
        expect.objectContaining({ name: "John Client" }),
        expect.objectContaining({ name: "Jane Agent" }),
      ]);
    });

    it("should show success results after export", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/export complete/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/15 text messages/i)).toBeInTheDocument();
    });

    it("should show open folder button after successful export", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /open export folder/i }),
        ).toBeInTheDocument();
      });
    });

    it("should call openFolder when open folder button is clicked", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /open export folder/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /open export folder/i }),
      );

      expect(window.api.shell.openFolder).toHaveBeenCalledWith(
        "/path/to/export",
      );
    });

    it("should show error when export fails", async () => {
      window.api.googleExport.exportEmails.mockResolvedValue({
        success: false,
        error: "Export failed: disk full",
      });

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/export failed: disk full/i),
        ).toBeInTheDocument();
      });
    });

    it("should disable back button while exporting", async () => {
      window.api.googleExport.exportEmails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        const backButton = screen.getByRole("button", { name: /back/i });
        expect(backButton).toBeDisabled();
      });
    });
  });

  describe("Cancellation", () => {
    it("should call onCancel when cancel button is clicked", async () => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(false);

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /cancel/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("should call onCancel when back button is clicked", async () => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /back/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("should call onCancel when export is cancelled", async () => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);
      window.api.googleExport.exportEmails.mockResolvedValue({
        success: false,
        canceled: true,
      });

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });
  });

  describe("Detailed Results", () => {
    beforeEach(() => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);
    });

    it("should show more details button after export", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /more details/i }),
        ).toBeInTheDocument();
      });
    });

    it("should show individual contact results in detailed view", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /export 2 audits/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /export 2 audits/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /more details/i }),
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", { name: /more details/i }),
      );

      // Should show individual results
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
    });
  });

  describe("IPC Communication", () => {
    it("should register export progress listener on mount", async () => {
      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={mockSelectedIds}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(window.api.googleExport.onExportProgress).toHaveBeenCalled();
      });
    });

    it("should have all required Electron APIs available", () => {
      expect(window.api.googleExport.initialize).toBeDefined();
      expect(window.api.googleExport.isAuthenticated).toBeDefined();
      expect(window.api.googleExport.exportEmails).toBeDefined();
      expect(window.api.shell.openFolder).toBeDefined();
      expect(window.api.googleExport.onExportProgress).toBeDefined();
    });
  });

  describe("Empty Selection", () => {
    it("should disable export button when no contacts selected", async () => {
      window.api.googleExport.isAuthenticated.mockResolvedValue(true);

      render(
        <GoogleExport
          conversations={mockConversations}
          selectedIds={new Set()}
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        const exportButton = screen.getByRole("button", {
          name: /export 0 audits/i,
        });
        expect(exportButton).toBeDisabled();
      });
    });
  });
});
