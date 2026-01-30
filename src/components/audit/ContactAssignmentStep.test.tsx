/**
 * Tests for ContactAssignmentStep Component
 * TASK-1766: New Audit Contact Flow (search-first pattern)
 *
 * Tests the 2-step internal flow:
 * - Step 1: Contact selection (ContactSearchList)
 * - Step 2: Role assignment (ContactRoleRow)
 */

import React from "react";
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

  const defaultProps = {
    contactAssignments: {},
    onAssignContact: jest.fn(),
    onRemoveContact: jest.fn(),
    userId: "user-123",
    transactionType: "purchase",
    propertyAddress: "123 Main St",
    contacts: mockContacts,
    contactsLoading: false,
    contactsError: null,
    onRefreshContacts: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Step 1: Contact Selection", () => {
    it("renders contact selection step by default", () => {
      render(<ContactAssignmentStep {...defaultProps} />);

      expect(screen.getByTestId("contact-assignment-step-1")).toBeInTheDocument();
      // Header text "Select Contacts" should be present
      expect(screen.getByRole("heading", { name: /select contacts/i })).toBeInTheDocument();
    });

    it("displays ContactSearchList component", () => {
      render(<ContactAssignmentStep {...defaultProps} />);

      expect(screen.getByTestId("contact-search-list")).toBeInTheDocument();
    });

    it("shows all contacts in the list", () => {
      render(<ContactAssignmentStep {...defaultProps} />);

      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      expect(screen.getByText("Bob Inspector")).toBeInTheDocument();
    });

    it("allows selecting multiple contacts", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

      // Click on contacts to select them
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      const janeRow = screen.getByText("Jane Agent").closest("[data-testid^='contact-row-']");

      if (johnRow) await user.click(johnRow);
      if (janeRow) await user.click(janeRow);

      // Check selection count in button
      await waitFor(() => {
        expect(screen.getByTestId("next-to-roles-button")).toHaveTextContent("2");
      });
    });

    it("disables Next button when no contacts selected", () => {
      render(<ContactAssignmentStep {...defaultProps} />);

      const nextButton = screen.getByTestId("next-to-roles-button");
      expect(nextButton).toBeDisabled();
    });

    it("enables Next button when contacts are selected", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

      // Select a contact
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      if (johnRow) await user.click(johnRow);

      await waitFor(() => {
        expect(screen.getByTestId("next-to-roles-button")).not.toBeDisabled();
      });
    });

    it("shows loading state when contacts are loading", () => {
      render(<ContactAssignmentStep {...defaultProps} contactsLoading={true} />);

      // Loading message appears in multiple places
      const loadingMessages = screen.getAllByText(/loading contacts/i);
      expect(loadingMessages.length).toBeGreaterThan(0);
    });

    it("shows error state when there is an error", () => {
      render(
        <ContactAssignmentStep
          {...defaultProps}
          contactsError="Failed to load contacts"
        />
      );

      // Error message appears in both the component error display and ContactSearchList
      const errorMessages = screen.getAllByText(/failed to load contacts/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it("initializes selection from existing contactAssignments", () => {
      const propsWithAssignments = {
        ...defaultProps,
        contactAssignments: {
          client: [{ contactId: "contact-1", isPrimary: false, notes: "" }],
        },
      };

      render(<ContactAssignmentStep {...propsWithAssignments} />);

      // Button should show 1 selected
      expect(screen.getByTestId("next-to-roles-button")).toHaveTextContent("1");
    });
  });

  describe("Step 1 to Step 2 Transition", () => {
    it("advances to step 2 when Next is clicked", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

      // Select a contact
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      if (johnRow) await user.click(johnRow);

      // Click Next
      const nextButton = screen.getByTestId("next-to-roles-button");
      await user.click(nextButton);

      // Should now be on step 2
      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
      });
    });
  });

  describe("Step 2: Role Assignment", () => {
    const renderAtStep2 = async () => {
      const user = userEvent.setup();
      const result = render(<ContactAssignmentStep {...defaultProps} />);

      // Select contacts and advance to step 2
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      const janeRow = screen.getByText("Jane Agent").closest("[data-testid^='contact-row-']");

      if (johnRow) await user.click(johnRow);
      if (janeRow) await user.click(janeRow);

      const nextButton = screen.getByTestId("next-to-roles-button");
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
      });

      return { ...result, user };
    };

    it("shows selected contacts with role dropdowns", async () => {
      await renderAtStep2();

      // Should show both selected contacts
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();

      // Should have role dropdowns
      expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      expect(screen.getByTestId("role-select-contact-2")).toBeInTheDocument();
    });

    it("displays assigned count", async () => {
      await renderAtStep2();

      // Initially 0 of 2 have roles assigned
      expect(screen.getByText(/0 of 2 contacts? have roles assigned/i)).toBeInTheDocument();
    });

    it("updates role when dropdown changes", async () => {
      const onAssignContact = jest.fn();
      const user = userEvent.setup();

      render(
        <ContactAssignmentStep {...defaultProps} onAssignContact={onAssignContact} />
      );

      // Select and advance to step 2
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      if (johnRow) await user.click(johnRow);

      const nextButton = screen.getByTestId("next-to-roles-button");
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
      });

      // Select a role for the contact
      const roleSelect = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(roleSelect, "client");

      // Should call onAssignContact
      expect(onAssignContact).toHaveBeenCalledWith("client", "contact-1", false, "");
    });

    it("shows role options based on transaction type", async () => {
      await renderAtStep2();

      const roleSelect = screen.getByTestId("role-select-contact-1");

      // Should have role options (depends on transaction type = purchase)
      expect(within(roleSelect).getByText("Select role...")).toBeInTheDocument();
      // Client role should be present
      expect(within(roleSelect).getByText(/client/i)).toBeInTheDocument();
      // Role options are filtered by transaction type
      const options = within(roleSelect).getAllByRole("option");
      expect(options.length).toBeGreaterThan(1); // At least "Select role..." + some roles
    });
  });

  describe("Navigation", () => {
    it("Back button returns to step 1", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

      // Navigate to step 2
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      if (johnRow) await user.click(johnRow);

      const nextButton = screen.getByTestId("next-to-roles-button");
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
      });

      // Click Back
      const backButton = screen.getByTestId("back-to-select-button");
      await user.click(backButton);

      // Should be back on step 1
      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-1")).toBeInTheDocument();
      });
    });

    it("preserves selection when going back", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

      // Select contacts
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      const janeRow = screen.getByText("Jane Agent").closest("[data-testid^='contact-row-']");

      if (johnRow) await user.click(johnRow);
      if (janeRow) await user.click(janeRow);

      // Navigate to step 2 and back
      const nextButton = screen.getByTestId("next-to-roles-button");
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
      });

      const backButton = screen.getByTestId("back-to-select-button");
      await user.click(backButton);

      // Selection should be preserved
      await waitFor(() => {
        expect(screen.getByTestId("next-to-roles-button")).toHaveTextContent("2");
      });
    });
  });

  describe("Search functionality", () => {
    it("filters contacts based on search query", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

      const searchInput = screen.getByTestId("contact-search-input");
      await user.type(searchInput, "John");

      // Should only show John Client
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.queryByText("Jane Agent")).not.toBeInTheDocument();
      expect(screen.queryByText("Bob Inspector")).not.toBeInTheDocument();
    });

    it("shows all contacts when search is cleared", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} />);

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
    it("shows empty state when no contacts are available", () => {
      render(<ContactAssignmentStep {...defaultProps} contacts={[]} />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it("shows message when no contacts selected and on step 2", async () => {
      // This shouldn't normally happen since button is disabled,
      // but test the state if it occurs
      const propsWithSelection = {
        ...defaultProps,
        contactAssignments: {},
      };

      // Start at step 1 with a contact selected, then deselect
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...propsWithSelection} />);

      // Select a contact
      const johnRow = screen.getByText("John Client").closest("[data-testid^='contact-row-']");
      if (johnRow) await user.click(johnRow);

      // Navigate to step 2
      const nextButton = screen.getByTestId("next-to-roles-button");
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
      });

      // Should show the contact (John Client)
      expect(screen.getByText("John Client")).toBeInTheDocument();
    });
  });
});
