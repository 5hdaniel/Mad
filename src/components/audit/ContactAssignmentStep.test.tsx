/**
 * Tests for ContactAssignmentStep Component
 * TASK-1771: Unified navigation with mode prop
 *
 * Tests the mode-based views (navigation handled by parent modal):
 * - mode="select": Contact selection (ContactSearchList)
 * - mode="roles": Role assignment (ContactRoleRow)
 */

import React, { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ContactAssignmentStep from "./ContactAssignmentStep";
import type { Contact } from "../../../electron/types/models";

// Mock contactService
jest.mock("../../services", () => ({
  contactService: {
    create: jest.fn(),
  },
}));

/**
 * Wrapper component to manage selectedContactIds state for tests
 * since the parent now manages this state
 */
interface WrapperProps {
  mode: 'select' | 'roles';
  initialSelectedIds?: string[];
  contacts: Contact[];
  contactAssignments?: Record<string, { contactId: string; isPrimary: boolean; notes: string }[]>;
  onAssignContact?: jest.Mock;
  onRemoveContact?: jest.Mock;
  onRefreshContacts?: jest.Mock;
  contactsLoading?: boolean;
  contactsError?: string | null;
}

function TestWrapper({
  mode,
  initialSelectedIds = [],
  contacts,
  contactAssignments = {},
  onAssignContact = jest.fn(),
  onRemoveContact = jest.fn(),
  onRefreshContacts = jest.fn(),
  contactsLoading = false,
  contactsError = null,
}: WrapperProps) {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(initialSelectedIds);

  return (
    <ContactAssignmentStep
      mode={mode}
      contacts={contacts}
      contactAssignments={contactAssignments}
      onAssignContact={onAssignContact}
      onRemoveContact={onRemoveContact}
      userId="user-123"
      transactionType="purchase"
      propertyAddress="123 Main St"
      contactsLoading={contactsLoading}
      contactsError={contactsError}
      onRefreshContacts={onRefreshContacts}
      selectedContactIds={selectedContactIds}
      onSelectedContactIdsChange={setSelectedContactIds}
    />
  );
}

describe("ContactAssignmentStep", () => {
  const mockContacts: Contact[] = [
    {
      id: "contact-1",
      user_id: "user-123",
      name: "John Client",
      display_name: "John Client",
      email: "john@example.com",
      phone: "555-1234",
      company: "Homebuyer Inc",
      source: "manual",
      is_message_derived: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "contact-2",
      user_id: "user-123",
      name: "Jane Agent",
      display_name: "Jane Agent",
      email: "jane@realty.com",
      phone: "555-5678",
      company: "Top Realty",
      source: "email",
      is_message_derived: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "contact-3",
      user_id: "user-123",
      name: "Bob Inspector",
      display_name: "Bob Inspector",
      email: "bob@inspect.com",
      phone: "555-9012",
      company: "Home Inspections LLC",
      source: "manual",
      is_message_derived: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("mode='select': Contact Selection", () => {
    it("renders contact selection view when mode is select", () => {
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      expect(screen.getByTestId("contact-assignment-select")).toBeInTheDocument();
      // Header text "Select Contacts" should be present
      expect(screen.getByRole("heading", { name: /select contacts/i })).toBeInTheDocument();
    });

    it("displays ContactSearchList component", () => {
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      expect(screen.getByTestId("contact-search-list")).toBeInTheDocument();
    });

    it("shows all contacts in the list", () => {
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      expect(screen.getByText("Bob Inspector")).toBeInTheDocument();
    });

    it("allows selecting multiple contacts", async () => {
      const user = userEvent.setup();
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      // Click on contacts to select them
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      const janeRow = screen.getByText("Jane Agent").closest("[data-testid^='contact-row-']");

      if (johnRow) await user.click(johnRow);
      if (janeRow) await user.click(janeRow);

      // Check selection count in header
      await waitFor(() => {
        expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      });
    });

    it("shows selection count when contacts are selected", async () => {
      render(
        <TestWrapper
          mode="select"
          contacts={mockContacts}
          initialSelectedIds={["contact-1", "contact-2"]}
        />
      );

      // Should show selection count
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it("shows loading state when contacts are loading", () => {
      render(
        <TestWrapper mode="select" contacts={mockContacts} contactsLoading={true} />
      );

      // Loading message appears in multiple places
      const loadingMessages = screen.getAllByText(/loading contacts/i);
      expect(loadingMessages.length).toBeGreaterThan(0);
    });

    it("shows error state when there is an error", () => {
      render(
        <TestWrapper
          mode="select"
          contacts={mockContacts}
          contactsError="Failed to load contacts"
        />
      );

      // Error message appears in both the component error display and ContactSearchList
      const errorMessages = screen.getAllByText(/failed to load contacts/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it("does not render internal navigation buttons (parent controls navigation)", () => {
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      // No internal "Next" button - parent modal has the navigation
      expect(screen.queryByTestId("next-to-roles-button")).not.toBeInTheDocument();
    });
  });

  describe("Mode switching (parent-controlled)", () => {
    // TASK-1771: Navigation is now controlled by the parent modal
    // These tests verify that the component renders correctly for each mode

    it("renders select view when mode=select", () => {
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      expect(screen.getByTestId("contact-assignment-select")).toBeInTheDocument();
      expect(screen.queryByTestId("contact-assignment-roles")).not.toBeInTheDocument();
    });

    it("renders roles view when mode=roles", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1"]}
        />
      );

      expect(screen.getByTestId("contact-assignment-roles")).toBeInTheDocument();
      expect(screen.queryByTestId("contact-assignment-select")).not.toBeInTheDocument();
    });
  });

  describe("mode='roles': Role Assignment", () => {
    it("shows selected contacts with role dropdowns", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1", "contact-2"]}
        />
      );

      // Should show both selected contacts
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();

      // Should have role dropdowns
      expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      expect(screen.getByTestId("role-select-contact-2")).toBeInTheDocument();
    });

    it("displays assigned count", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1", "contact-2"]}
        />
      );

      // Initially 0 of 2 have roles assigned
      expect(screen.getByText(/0 of 2 contacts? have roles assigned/i)).toBeInTheDocument();
    });

    it("updates role when dropdown changes", async () => {
      const onAssignContact = jest.fn();
      const user = userEvent.setup();

      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1"]}
          onAssignContact={onAssignContact}
        />
      );

      // Select a role for the contact
      const roleSelect = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(roleSelect, "client");

      // Should call onAssignContact
      expect(onAssignContact).toHaveBeenCalledWith("client", "contact-1", false, "");
    });

    it("shows role options based on transaction type", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1"]}
        />
      );

      const roleSelect = screen.getByTestId("role-select-contact-1");

      // Should have role options (depends on transaction type = purchase)
      expect(within(roleSelect).getByText("Select role...")).toBeInTheDocument();
      // Client role should be present
      expect(within(roleSelect).getByText(/client/i)).toBeInTheDocument();
      // Role options are filtered by transaction type
      const options = within(roleSelect).getAllByRole("option");
      expect(options.length).toBeGreaterThan(1); // At least "Select role..." + some roles
    });

    it("shows empty state when no contacts selected", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={[]}
        />
      );

      expect(screen.getByText(/no contacts selected/i)).toBeInTheDocument();
      expect(screen.getByText(/use the back button/i)).toBeInTheDocument();
    });

    it("does not render internal navigation buttons (parent controls navigation)", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1"]}
        />
      );

      // No internal "Back to Select" button - parent modal has the navigation
      expect(screen.queryByTestId("back-to-select-button")).not.toBeInTheDocument();
    });
  });

  // TASK-1771: Navigation tests removed - navigation is now handled by parent modal
  // The parent modal manages step changes via the mode prop

  describe("Search functionality (mode=select)", () => {
    it("filters contacts based on search query", async () => {
      const user = userEvent.setup();
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      const searchInput = screen.getByTestId("contact-search-input");
      await user.type(searchInput, "John");

      // Should only show John Client
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.queryByText("Jane Agent")).not.toBeInTheDocument();
      expect(screen.queryByText("Bob Inspector")).not.toBeInTheDocument();
    });

    it("shows all contacts when search is cleared", async () => {
      const user = userEvent.setup();
      render(<TestWrapper mode="select" contacts={mockContacts} />);

      const searchInput = screen.getByTestId("contact-search-input");
      await user.type(searchInput, "John");
      await user.clear(searchInput);

      // Should show all contacts
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      expect(screen.getByText("Bob Inspector")).toBeInTheDocument();
    });
  });

  describe("Empty states", () => {
    it("shows empty state when no contacts are available (mode=select)", () => {
      render(<TestWrapper mode="select" contacts={[]} />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it("shows message when no contacts selected (mode=roles)", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={[]}
        />
      );

      expect(screen.getByText(/no contacts selected/i)).toBeInTheDocument();
    });

    it("shows selected contacts in roles mode", () => {
      render(
        <TestWrapper
          mode="roles"
          contacts={mockContacts}
          initialSelectedIds={["contact-1"]}
        />
      );

      // Should show the contact (John Client)
      expect(screen.getByText("John Client")).toBeInTheDocument();
    });
  });
});
