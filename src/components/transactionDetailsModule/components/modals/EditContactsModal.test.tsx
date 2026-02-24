/**
 * EditContactsModal Component Tests
 *
 * Tests for the 2-screen EditContactsModal flow:
 * - Screen 1: Assigned contacts with role dropdowns
 * - Screen 2: Add contacts overlay
 *
 * @see TASK-1765: EditContactsModal 2-Screen Flow Redesign
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditContactsModal, EditContactsModalProps } from "./EditContactsModal";
import type { Transaction } from "@/types";
import type { ExtendedContact } from "../../../../types/components";

// Mock window.api
const mockGetDetails = jest.fn();
const mockBatchUpdateContacts = jest.fn();

beforeAll(() => {
  (window as unknown as { api: unknown }).api = {
    transactions: {
      getDetails: mockGetDetails,
      batchUpdateContacts: mockBatchUpdateContacts,
    },
  };
});

// Mock ContactsContext
// Use source: "contacts_app" to mark as imported (not message-derived)
// This ensures contacts show by default with the category filter
const mockContacts: ExtendedContact[] = [
  {
    id: "contact-1",
    name: "John Smith",
    display_name: "John Smith",
    email: "john@example.com",
    user_id: "user-1",
    source: "contacts_app",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "contact-2",
    name: "Jane Doe",
    display_name: "Jane Doe",
    email: "jane@example.com",
    user_id: "user-1",
    source: "contacts_app",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "contact-3",
    name: "Bob Wilson",
    display_name: "Bob Wilson",
    email: "bob@example.com",
    user_id: "user-1",
    source: "contacts_app",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

jest.mock("../../../../contexts/ContactsContext", () => ({
  ContactsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useContacts: () => ({
    contacts: mockContacts,
    loading: false,
    error: null,
    refreshContacts: jest.fn(),
  }),
}));

// Mock ContactSearchList
jest.mock("../../../shared/ContactSearchList", () => ({
  ContactSearchList: ({
    contacts,
    selectedIds,
    onSelectionChange,
    className,
  }: {
    contacts: ExtendedContact[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    className?: string;
  }) => (
    <div data-testid="contact-search-list" className={className}>
      {contacts.map((contact) => (
        <div
          key={contact.id}
          data-testid={`search-contact-${contact.id}`}
          onClick={() => {
            const newIds = selectedIds.includes(contact.id)
              ? selectedIds.filter((id) => id !== contact.id)
              : [...selectedIds, contact.id];
            onSelectionChange(newIds);
          }}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(contact.id)}
            readOnly
            data-testid={`search-checkbox-${contact.id}`}
          />
          <span>{contact.display_name}</span>
        </div>
      ))}
    </div>
  ),
}));

// Mock ContactRoleRow
jest.mock("../../../shared/ContactRoleRow", () => ({
  ContactRoleRow: ({
    contact,
    currentRole,
    roleOptions,
    onRoleChange,
  }: {
    contact: ExtendedContact;
    currentRole: string;
    roleOptions: Array<{ value: string; label: string }>;
    onRoleChange: (role: string) => void;
  }) => (
    <div data-testid={`contact-role-row-${contact.id}`}>
      <span data-testid={`contact-name-${contact.id}`}>
        {contact.display_name}
      </span>
      <select
        data-testid={`role-select-${contact.id}`}
        value={currentRole}
        onChange={(e) => onRoleChange(e.target.value)}
      >
        <option value="">Select role...</option>
        {roleOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

// Mock contactService
jest.mock("../../../../services", () => ({
  contactService: {
    create: jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: "new-contact-1",
        name: "New Contact",
        display_name: "New Contact",
        email: "new@example.com",
        user_id: "user-1",
        source: "manual",
      },
    }),
  },
}));

jest.mock("../../../../contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: true,
    isChecking: false,
    lastOnlineAt: null,
    lastOfflineAt: null,
    connectionError: null,
    checkConnection: jest.fn(),
    clearError: jest.fn(),
    setConnectionError: jest.fn(),
  }),
}));

// Test transaction factory
const createTestTransaction = (
  overrides: Partial<Transaction> = {}
): Transaction =>
  ({
    id: "txn-1",
    user_id: "user-1",
    property_address: "123 Main St",
    transaction_type: "purchase",
    status: "active",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  }) as Transaction;

// Default props factory
const createDefaultProps = (
  overrides: Partial<EditContactsModalProps> = {}
): EditContactsModalProps => ({
  transaction: createTestTransaction(),
  onClose: jest.fn(),
  onSave: jest.fn(),
  ...overrides,
});

describe("EditContactsModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: no existing assignments
    mockGetDetails.mockResolvedValue({
      success: true,
      transaction: {
        contact_assignments: [],
      },
    });
    mockBatchUpdateContacts.mockResolvedValue({
      success: true,
      autoLinkResults: [],
    });
  });

  describe("Screen 1: Assigned Contacts View", () => {
    it("renders loading state initially", () => {
      render(<EditContactsModal {...createDefaultProps()} />);

      expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
    });

    it("renders modal header with correct title", async () => {
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(
          screen.getByText("Edit Transaction Contacts")
        ).toBeInTheDocument();
      });
    });

    it("shows empty state when no contacts assigned", async () => {
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("empty-assigned-state")).toBeInTheDocument();
      });
      expect(screen.getByText("No contacts assigned")).toBeInTheDocument();
      expect(
        screen.getByText(/Click "Add Contacts" to get started/)
      ).toBeInTheDocument();
    });

    it("displays assigned contacts with role dropdowns", async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            {
              id: "assign-1",
              contact_id: "contact-1",
              contact_name: "John Smith",
              role: "client",
            },
          ],
        },
      });

      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(
          screen.getByTestId("contact-role-row-contact-1")
        ).toBeInTheDocument();
      });
      expect(screen.getByTestId("role-select-contact-1")).toHaveValue("client");
    });

    it("shows count of assigned contacts", async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
            { id: "a2", contact_id: "contact-2", role: "inspector" },
          ],
        },
      });

      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByText("2 contacts assigned")).toBeInTheDocument();
      });
    });

    it("updates role when dropdown changed", async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });

      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      });

      const select = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(select, "inspector");

      expect(select).toHaveValue("inspector");
    });

    it('shows "Add Contacts" button when contacts are assigned', async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });

      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("add-contacts-button")).toBeInTheDocument();
      });
    });
  });

  describe("Screen 2: Add Contacts Modal", () => {
    it('opens when "Add Contacts" button clicked', async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });

      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("add-contacts-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("add-contacts-button"));

      expect(screen.getByTestId("add-contacts-overlay")).toBeInTheDocument();
    });

    it("opens from empty state button", async () => {
      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(
          screen.getByTestId("empty-state-add-button")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("empty-state-add-button"));

      expect(screen.getByTestId("add-contacts-overlay")).toBeInTheDocument();
    });

    it("shows ContactSearchList component", async () => {
      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("empty-state-add-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("empty-state-add-button"));

      expect(screen.getByTestId("contact-search-list")).toBeInTheDocument();
    });

    it("filters out already assigned contacts", async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });

      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("add-contacts-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("add-contacts-button"));

      // contact-1 is assigned, so should not appear in search list
      expect(
        screen.queryByTestId("search-contact-contact-1")
      ).not.toBeInTheDocument();
      // contact-2 and contact-3 are not assigned, so should appear
      expect(
        screen.getByTestId("search-contact-contact-2")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("search-contact-contact-3")
      ).toBeInTheDocument();
    });

    it('closes when X button clicked', async () => {
      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("empty-state-add-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("empty-state-add-button"));
      expect(screen.getByTestId("add-contacts-overlay")).toBeInTheDocument();

      await user.click(screen.getByTestId("add-contacts-overlay-close"));

      expect(
        screen.queryByTestId("add-contacts-overlay")
      ).not.toBeInTheDocument();
    });

    // Note: "Add Selected" tests removed - SPRINT-066 UX redesign changed to direct-add pattern
    // Contacts are now added by clicking the "+" import button, not multi-select + "Add Selected"
  });

  describe("integration", () => {
    // Note: "added contacts appear in Screen 1" and "save generates correct add operations"
    // tests removed - SPRINT-066 UX redesign changed from multi-select + "Add Selected"
    // to direct-add via "+" import button. The flow no longer uses add-selected-button.

    it("save generates correct remove operations", async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });

      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      });

      // Change role from client to something else (removing original role)
      const select = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(select, "inspector");

      // Save
      await user.click(screen.getByTestId("edit-contacts-modal-save"));

      await waitFor(() => {
        expect(mockBatchUpdateContacts).toHaveBeenCalledWith(
          "txn-1",
          expect.arrayContaining([
            expect.objectContaining({
              action: "remove",
              contactId: "contact-1",
              role: "client",
            }),
            expect.objectContaining({
              action: "add",
              contactId: "contact-1",
              role: "inspector",
            }),
          ])
        );
      });
    });

    it("cancel calls onClose without saving", async () => {
      const onClose = jest.fn();
      const onSave = jest.fn();
      const user = userEvent.setup();

      render(
        <EditContactsModal {...createDefaultProps({ onClose, onSave })} />
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("edit-contacts-modal-cancel")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("edit-contacts-modal-cancel"));

      expect(onClose).toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
      expect(mockBatchUpdateContacts).not.toHaveBeenCalled();
    });
  });

  describe("loading and errors", () => {
    it("shows loading state while fetching contacts", () => {
      // Don't resolve the promise immediately
      mockGetDetails.mockImplementation(
        () => new Promise(() => {})
      );

      render(<EditContactsModal {...createDefaultProps()} />);

      expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
    });

    it("shows error message on load failure", async () => {
      mockGetDetails.mockRejectedValue(new Error("Network error"));

      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load contacts")).toBeInTheDocument();
      });
    });

    it("shows error message on save failure", async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });
      mockBatchUpdateContacts.mockResolvedValue({
        success: false,
        error: "Save failed",
      });

      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      });

      // Change role to trigger save operation
      const select = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(select, "inspector");

      await user.click(screen.getByTestId("edit-contacts-modal-save"));

      await waitFor(() => {
        expect(screen.getByText("Save failed")).toBeInTheDocument();
      });
    });

    it('shows "Saving..." while save in progress', async () => {
      mockGetDetails.mockResolvedValue({
        success: true,
        transaction: {
          contact_assignments: [
            { id: "a1", contact_id: "contact-1", role: "client" },
          ],
        },
      });
      // Delay the save response
      mockBatchUpdateContacts.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 100)
          )
      );

      const user = userEvent.setup();
      render(<EditContactsModal {...createDefaultProps()} />);

      await waitFor(() => {
        expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      });

      // Change role
      const select = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(select, "inspector");

      // Click save
      await user.click(screen.getByTestId("edit-contacts-modal-save"));

      expect(screen.getByTestId("edit-contacts-modal-save")).toHaveTextContent(
        "Saving..."
      );
      expect(screen.getByTestId("edit-contacts-modal-save")).toBeDisabled();
    });
  });

  describe("close button", () => {
    it("closes modal when header X button clicked", async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();

      render(<EditContactsModal {...createDefaultProps({ onClose })} />);

      await waitFor(() => {
        expect(
          screen.getByTestId("edit-contacts-modal-close")
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("edit-contacts-modal-close"));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
