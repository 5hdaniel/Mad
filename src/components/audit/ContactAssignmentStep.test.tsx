/**
 * Tests for ContactAssignmentStep Component
 * TASK-1766: New Audit Contact Flow (search-first pattern)
 * TASK-1771: Unified audit modal navigation (parent-controlled step)
 *
 * The component displays different content based on the parent-controlled `step` prop:
 * - Step 2: Contact selection (ContactSearchList)
 * - Step 3: Role assignment (ContactRoleRow)
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    step: 2, // Step 2 = contact selection
    contactAssignments: {},
    selectedContactIds: [] as string[],
    onSelectedContactIdsChange: jest.fn(),
    onAssignContact: jest.fn(),
    onRemoveContact: jest.fn(),
    userId: "user-123",
    transactionType: "purchase",
    propertyAddress: "123 Main St",
    contacts: mockContacts,
    contactsLoading: false,
    contactsError: null,
    onRefreshContacts: jest.fn(),
    onSilentRefreshContacts: jest.fn(),
    externalContacts: [] as Contact[],
    externalContactsLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Step 2: Contact Selection", () => {
    it("renders contact selection step when step=2", () => {
      render(<ContactAssignmentStep {...defaultProps} step={2} />);

      expect(screen.getByTestId("contact-assignment-step-2")).toBeInTheDocument();
    });

    it("displays ContactSearchList component", () => {
      render(<ContactAssignmentStep {...defaultProps} step={2} />);

      expect(screen.getByTestId("contact-search-list")).toBeInTheDocument();
    });

    it("shows all contacts in the list", () => {
      render(<ContactAssignmentStep {...defaultProps} step={2} />);

      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      expect(screen.getByText("Bob Inspector")).toBeInTheDocument();
    });

    it("shows loading state when contacts are loading", () => {
      render(<ContactAssignmentStep {...defaultProps} step={2} contactsLoading={true} />);

      expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    });

    it("shows error state when there is an error", () => {
      render(
        <ContactAssignmentStep
          {...defaultProps}
          step={2}
          contactsError="Failed to load contacts"
        />
      );

      expect(screen.getByTestId("error-state")).toBeInTheDocument();
    });
  });

  describe("Step 3: Role Assignment", () => {
    const step3Props = {
      ...defaultProps,
      step: 3,
      selectedContactIds: ["contact-1", "contact-2"],
    };

    it("renders role assignment step when step=3", () => {
      render(<ContactAssignmentStep {...step3Props} />);

      expect(screen.getByTestId("contact-assignment-step-3")).toBeInTheDocument();
    });

    it("shows selected contacts with role dropdowns", () => {
      render(<ContactAssignmentStep {...step3Props} />);

      // Should show both selected contacts
      expect(screen.getByText("John Client")).toBeInTheDocument();
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
      // Bob was not selected, should not appear
      expect(screen.queryByText("Bob Inspector")).not.toBeInTheDocument();

      // Should have role dropdowns
      expect(screen.getByTestId("role-select-contact-1")).toBeInTheDocument();
      expect(screen.getByTestId("role-select-contact-2")).toBeInTheDocument();
    });

    it("displays assigned count", () => {
      render(<ContactAssignmentStep {...step3Props} />);

      // Initially 0 of 2 have roles assigned
      expect(screen.getByText(/0 of 2 contacts? have roles assigned/i)).toBeInTheDocument();
    });

    it("calls onAssignContact when role is selected", async () => {
      const onAssignContact = jest.fn();
      const user = userEvent.setup();

      render(
        <ContactAssignmentStep
          {...step3Props}
          onAssignContact={onAssignContact}
        />
      );

      // Select a role for John
      const roleSelect = screen.getByTestId("role-select-contact-1");
      await user.selectOptions(roleSelect, "client");

      expect(onAssignContact).toHaveBeenCalledWith(
        "client",
        "contact-1",
        expect.any(Boolean),
        expect.any(String)
      );
    });

    it("shows empty state when no contacts are selected", () => {
      render(
        <ContactAssignmentStep
          {...defaultProps}
          step={3}
          selectedContactIds={[]}
        />
      );

      expect(screen.getByText(/no contacts selected/i)).toBeInTheDocument();
    });
  });

  describe("Search functionality", () => {
    it("filters contacts when searching", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} step={2} />);

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await user.type(searchInput, "John");

      await waitFor(() => {
        expect(screen.getByText("John Client")).toBeInTheDocument();
        expect(screen.queryByText("Jane Agent")).not.toBeInTheDocument();
      });
    });

    it("shows all contacts when search is cleared", async () => {
      const user = userEvent.setup();
      render(<ContactAssignmentStep {...defaultProps} step={2} />);

      const searchInput = screen.getByPlaceholderText(/search contacts/i);
      await user.type(searchInput, "John");
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText("John Client")).toBeInTheDocument();
        expect(screen.getByText("Jane Agent")).toBeInTheDocument();
        expect(screen.getByText("Bob Inspector")).toBeInTheDocument();
      });
    });
  });

  describe("Empty states", () => {
    it("shows empty state when no contacts are available", () => {
      render(
        <ContactAssignmentStep
          {...defaultProps}
          step={2}
          contacts={[]}
        />
      );

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });
});
