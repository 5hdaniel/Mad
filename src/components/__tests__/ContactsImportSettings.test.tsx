/**
 * Tests for ContactsImportSettings component (TASK-1989)
 *
 * Tests multi-source contacts import settings:
 * - macOS Contacts section (macOS only)
 * - Outlook Contacts section (when Microsoft connected)
 * - No sources available state
 * - reconnectRequired handling
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ContactsImportSettings } from "../settings/MacOSContactsImportSettings";
import { PlatformProvider } from "../../contexts/PlatformContext";

// Mock useSyncOrchestrator
const mockRequestSync = jest.fn();
jest.mock("../../hooks/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({
    queue: [],
    isRunning: false,
    requestSync: mockRequestSync,
  }),
}));

// Store original window.api
const originalApi = window.api;

// Mock contacts API
const mockGetExternalSyncStatus = jest.fn().mockResolvedValue({
  success: true,
  lastSyncAt: null,
  contactCount: 0,
});
const mockSyncOutlookContacts = jest.fn().mockResolvedValue({
  success: true,
  count: 5,
});

/**
 * Helper to render with PlatformProvider with a specific platform
 */
function renderWithPlatform(
  ui: React.ReactElement,
  platform: string = "darwin",
) {
  Object.defineProperty(window, "api", {
    value: {
      ...originalApi,
      system: {
        ...originalApi?.system,
        platform,
      },
      contacts: {
        getExternalSyncStatus: mockGetExternalSyncStatus,
        syncOutlookContacts: mockSyncOutlookContacts,
      },
    },
    writable: true,
    configurable: true,
  });

  return render(<PlatformProvider>{ui}</PlatformProvider>);
}

beforeEach(() => {
  mockRequestSync.mockClear();
  mockGetExternalSyncStatus.mockClear();
  mockSyncOutlookContacts.mockClear();

  // Reset mocks to default success values
  mockGetExternalSyncStatus.mockResolvedValue({
    success: true,
    lastSyncAt: null,
    contactCount: 0,
  });
  mockSyncOutlookContacts.mockResolvedValue({
    success: true,
    count: 5,
  });
});

afterEach(() => {
  Object.defineProperty(window, "api", {
    value: originalApi,
    writable: true,
    configurable: true,
  });
});

describe("ContactsImportSettings", () => {
  describe("macOS platform", () => {
    it("should render macOS Contacts section on macOS", () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" />,
        "darwin"
      );

      expect(screen.getByText("macOS Contacts")).toBeInTheDocument();
      expect(
        screen.getByText(/Import contacts from the macOS Contacts app/)
      ).toBeInTheDocument();
      expect(screen.getByText("Import Contacts")).toBeInTheDocument();
      expect(screen.getByText("Force Re-import")).toBeInTheDocument();
    });

    it("should render both macOS and Outlook sections when Microsoft is connected", () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "darwin"
      );

      expect(screen.getByText("macOS Contacts")).toBeInTheDocument();
      expect(screen.getByText("Outlook Contacts")).toBeInTheDocument();
      expect(screen.getByText("Import Outlook Contacts")).toBeInTheDocument();
    });

    it("should trigger macOS contacts sync when Import Contacts is clicked", () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" />,
        "darwin"
      );

      fireEvent.click(screen.getByText("Import Contacts"));

      expect(mockRequestSync).toHaveBeenCalledWith(["contacts"], "user-1");
    });
  });

  describe("non-macOS platform (Windows)", () => {
    it("should not render macOS Contacts section on Windows", () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" />,
        "win32"
      );

      // On Windows without Microsoft connected, should show "no sources" message
      expect(
        screen.getByText(/Connect a Microsoft account or use macOS/)
      ).toBeInTheDocument();
      expect(screen.queryByText("macOS Contacts")).not.toBeInTheDocument();
    });

    it("should render Outlook section on Windows when Microsoft connected", () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "win32"
      );

      expect(screen.getByText("Outlook Contacts")).toBeInTheDocument();
      expect(screen.getByText("Import Outlook Contacts")).toBeInTheDocument();
      expect(screen.queryByText("macOS Contacts")).not.toBeInTheDocument();
    });
  });

  describe("no sources available", () => {
    it("should show helpful message when no sources available (Windows, no Microsoft)", () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={false} />,
        "win32"
      );

      expect(
        screen.getByText(/Connect a Microsoft account or use macOS/)
      ).toBeInTheDocument();
      // The heading "Import Contacts" in the no-sources fallback
      expect(screen.getByText("Import Contacts")).toBeInTheDocument();
    });
  });

  describe("Outlook contacts import", () => {
    it("should trigger Outlook contacts sync when button is clicked", async () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "darwin"
      );

      fireEvent.click(screen.getByText("Import Outlook Contacts"));

      await waitFor(() => {
        expect(mockSyncOutlookContacts).toHaveBeenCalledWith("user-1");
      });
    });

    it("should show success result after Outlook sync", async () => {
      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "darwin"
      );

      fireEvent.click(screen.getByText("Import Outlook Contacts"));

      await waitFor(() => {
        expect(screen.getByText(/Outlook contacts synced/)).toBeInTheDocument();
      });
    });

    it("should show reconnect required warning when Contacts.Read scope is missing", async () => {
      mockSyncOutlookContacts.mockResolvedValue({
        success: false,
        reconnectRequired: true,
        error: "Contacts.Read scope not granted",
      });

      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "darwin"
      );

      fireEvent.click(screen.getByText("Import Outlook Contacts"));

      await waitFor(() => {
        expect(
          screen.getByText(/disconnect and reconnect your Microsoft mailbox/)
        ).toBeInTheDocument();
      });
    });

    it("should show error message when Outlook sync fails", async () => {
      mockSyncOutlookContacts.mockResolvedValue({
        success: false,
        error: "Network error",
      });

      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "darwin"
      );

      fireEvent.click(screen.getByText("Import Outlook Contacts"));

      await waitFor(() => {
        expect(screen.getByText(/Sync failed: Network error/)).toBeInTheDocument();
      });
    });

    it("should hide Import Outlook Contacts button when reconnect is required", async () => {
      mockSyncOutlookContacts.mockResolvedValue({
        success: false,
        reconnectRequired: true,
      });

      renderWithPlatform(
        <ContactsImportSettings userId="user-1" isMicrosoftConnected={true} />,
        "darwin"
      );

      fireEvent.click(screen.getByText("Import Outlook Contacts"));

      await waitFor(() => {
        expect(
          screen.getByText(/disconnect and reconnect your Microsoft mailbox/)
        ).toBeInTheDocument();
      });

      // The button should not be visible when reconnect is required
      expect(screen.queryByText("Import Outlook Contacts")).not.toBeInTheDocument();
    });
  });

  describe("backward compatibility", () => {
    it("should export MacOSContactsImportSettings as alias", async () => {
      const { MacOSContactsImportSettings } = await import(
        "../settings/MacOSContactsImportSettings"
      );
      expect(MacOSContactsImportSettings).toBe(ContactsImportSettings);
    });
  });
});
