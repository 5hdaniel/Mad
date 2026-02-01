/**
 * AttachmentPreviewModal Tests
 * Tests for email attachment preview with image display and system viewer fallback
 * TASK-1778: Email Attachment Preview Modal
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentPreviewModal } from "../AttachmentPreviewModal";

// Helper to create mock attachment data
function createMockAttachment(overrides: Partial<{
  id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}> = {}) {
  return {
    id: "att-1",
    filename: "document.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1024000,
    storage_path: "/path/to/document.pdf",
    ...overrides,
  };
}

describe("AttachmentPreviewModal", () => {
  const mockOnClose = jest.fn();
  const mockOnOpenWithSystem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render attachment filename", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({ filename: "report.pdf" })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // Filename appears in header and fallback area
      expect(screen.getAllByText("report.pdf").length).toBeGreaterThan(0);
    });

    it("should render formatted file size", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({ file_size_bytes: 1048576 })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // 1048576 bytes = 1 MB - appears in header and fallback
      expect(screen.getAllByText("1 MB").length).toBeGreaterThan(0);
    });

    it("should render file size in KB", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({ file_size_bytes: 2048 })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // Size appears in header and fallback
      expect(screen.getAllByText("2 KB").length).toBeGreaterThan(0);
    });

    it("should render 0 B for null file size", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({ file_size_bytes: null })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // Size appears in header and fallback
      expect(screen.getAllByText("0 B").length).toBeGreaterThan(0);
    });

    it("should have close button with aria-label", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment()}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      expect(screen.getByRole("button", { name: "Close preview" })).toBeInTheDocument();
    });
  });

  describe("Image Attachments", () => {
    it("should render image preview for image attachments", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "photo.jpg",
            mime_type: "image/jpeg",
            storage_path: "/path/to/photo.jpg",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      const img = screen.getByTestId("preview-image");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "file:///path/to/photo.jpg");
      expect(img).toHaveAttribute("alt", "photo.jpg");
    });

    it("should render image preview for PNG", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "screenshot.png",
            mime_type: "image/png",
            storage_path: "/path/to/screenshot.png",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      const img = screen.getByTestId("preview-image");
      expect(img).toHaveAttribute("src", "file:///path/to/screenshot.png");
    });

    it("should show error fallback when image fails to load", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "broken.jpg",
            mime_type: "image/jpeg",
            storage_path: "/path/to/broken.jpg",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      const img = screen.getByTestId("preview-image");
      fireEvent.error(img);

      expect(screen.getByTestId("image-error-fallback")).toBeInTheDocument();
      expect(screen.getByText("Failed to load image")).toBeInTheDocument();
    });

    it("should show Open with System Viewer button on image error", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "broken.jpg",
            mime_type: "image/jpeg",
            storage_path: "/path/to/broken.jpg",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      const img = screen.getByTestId("preview-image");
      fireEvent.error(img);

      expect(screen.getByText("Open with System Viewer")).toBeInTheDocument();
    });
  });

  describe("Non-Image Attachments", () => {
    it("should show fallback UI for PDF attachments", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "document.pdf",
            mime_type: "application/pdf",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      expect(screen.getByTestId("non-image-fallback")).toBeInTheDocument();
      // Should show filename in the fallback
      expect(screen.getAllByText("document.pdf").length).toBeGreaterThan(0);
    });

    it("should show fallback UI for Word documents", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "document.docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      expect(screen.getByTestId("non-image-fallback")).toBeInTheDocument();
    });

    it("should show Open with System Viewer button for non-image files", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "spreadsheet.xlsx",
            mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      expect(screen.getByText("Open with System Viewer")).toBeInTheDocument();
    });

    it("should show not downloaded message when storage_path is null", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "missing.pdf",
            mime_type: "application/pdf",
            storage_path: null,
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      expect(screen.getByText("Attachment not downloaded")).toBeInTheDocument();
      // Should NOT show open button
      expect(screen.queryByText("Open with System Viewer")).not.toBeInTheDocument();
    });
  });

  describe("Close Functionality", () => {
    it("should call onClose when close button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment()}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      await user.click(screen.getByRole("button", { name: "Close preview" }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when Escape key is pressed", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment()}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", async () => {
      const user = userEvent.setup();

      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment()}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      const backdrop = screen.getByTestId("attachment-preview-backdrop");
      await user.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should NOT close when clicking inside the modal content", async () => {
      const user = userEvent.setup();

      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment()}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // Click on the filename text inside the modal
      const filename = screen.getAllByText("document.pdf")[0];
      await user.click(filename);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Open With System", () => {
    it("should call onOpenWithSystem when Open button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            storage_path: "/path/to/file.pdf",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      await user.click(screen.getByTestId("open-with-system-button"));
      expect(mockOnOpenWithSystem).toHaveBeenCalledWith("/path/to/file.pdf");
    });

    it("should call onOpenWithSystem from fallback button for non-image files", async () => {
      const user = userEvent.setup();

      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "document.pdf",
            mime_type: "application/pdf",
            storage_path: "/path/to/document.pdf",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      await user.click(screen.getByText("Open with System Viewer"));
      expect(mockOnOpenWithSystem).toHaveBeenCalledWith("/path/to/document.pdf");
    });

    it("should NOT show Open button when storage_path is null", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            storage_path: null,
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      expect(screen.queryByTestId("open-with-system-button")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null mime_type", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            mime_type: null,
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // Should show non-image fallback
      expect(screen.getByTestId("non-image-fallback")).toBeInTheDocument();
    });

    it("should handle empty filename", () => {
      render(
        <AttachmentPreviewModal
          attachment={createMockAttachment({
            filename: "",
          })}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      // Modal should still render
      expect(screen.getByTestId("non-image-fallback")).toBeInTheDocument();
    });

    it("should cleanup escape key listener on unmount", () => {
      const { unmount } = render(
        <AttachmentPreviewModal
          attachment={createMockAttachment()}
          onClose={mockOnClose}
          onOpenWithSystem={mockOnOpenWithSystem}
        />
      );

      unmount();

      // Should not call onClose after unmount
      fireEvent.keyDown(window, { key: "Escape" });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
