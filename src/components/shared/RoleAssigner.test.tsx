/**
 * Tests for RoleAssigner.tsx
 *
 * Covers:
 * - Rendering (contacts sidebar, role sections, empty states)
 * - Assigning contacts to roles
 * - Unassigning contacts from roles
 * - Required role indicators
 * - Multiple contacts per role
 * - Transaction type filtering
 * - Assignment status indicators
 *
 * @see TASK-1721: RoleAssigner Integration
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RoleAssigner, RoleAssignments } from "./RoleAssigner";
import type { ExtendedContact } from "../../types/components";

describe("RoleAssigner", () => {
  const mockOnAssignmentsChange = jest.fn();

  // Standard test contacts
  const mockContacts: ExtendedContact[] = [
    {
      id: "contact-1",
      user_id: "user-1",
      display_name: "John Smith",
      name: "John Smith",
      email: "john@example.com",
      source: "manual",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "contact-2",
      user_id: "user-1",
      display_name: "Jane Doe",
      name: "Jane Doe",
      email: "jane@company.com",
      source: "email",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "contact-3",
      user_id: "user-1",
      display_name: "Bob Wilson",
      name: "Bob Wilson",
      email: "bob@realty.com",
      source: "contacts_app",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const emptyAssignments: RoleAssignments = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the component with sidebar and role area", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByTestId("role-assigner")).toBeInTheDocument();
      expect(screen.getByText("Selected Contacts")).toBeInTheDocument();
    });

    it("should display all selected contacts in sidebar", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Check contacts appear in sidebar (using testid for scoping)
      expect(screen.getByTestId("contact-sidebar-contact-1")).toBeInTheDocument();
      expect(screen.getByTestId("contact-sidebar-contact-2")).toBeInTheDocument();
      expect(screen.getByTestId("contact-sidebar-contact-3")).toBeInTheDocument();

      // Verify names are in the sidebar items
      expect(
        within(screen.getByTestId("contact-sidebar-contact-1")).getByText("John Smith")
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId("contact-sidebar-contact-2")).getByText("Jane Doe")
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId("contact-sidebar-contact-3")).getByText("Bob Wilson")
      ).toBeInTheDocument();
    });

    it("should show contact count in sidebar header", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("0 of 3 assigned")).toBeInTheDocument();
    });

    it("should display workflow step sections", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("Client & Agents")).toBeInTheDocument();
      expect(screen.getByText("Professional Services")).toBeInTheDocument();
    });

    it("should display role slots with names", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // For purchase, should show seller's agent (user represents buyer)
      expect(screen.getByText("Buyer (Client)")).toBeInTheDocument();
      expect(screen.getByText("Seller Agent")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
          className="custom-class"
        />
      );

      expect(screen.getByTestId("role-assigner")).toHaveClass("custom-class");
    });
  });

  describe("Empty States", () => {
    it("should show empty state when no contacts selected", () => {
      render(
        <RoleAssigner
          selectedContacts={[]}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("No contacts selected")).toBeInTheDocument();
      expect(
        screen.getByText("Select contacts first to assign roles")
      ).toBeInTheDocument();
    });
  });

  describe("Assigning Contacts to Roles", () => {
    it("should call onAssignmentsChange when assigning contact to role", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Find client role select
      const clientSelect = screen.getByTestId("role-select-client");
      fireEvent.change(clientSelect, { target: { value: "contact-1" } });

      expect(mockOnAssignmentsChange).toHaveBeenCalledWith({
        client: ["contact-1"],
      });
    });

    it("should show assigned contact as chip in role slot", () => {
      const assignmentsWithClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Find the client role slot
      const clientSlot = screen.getByTestId("role-slot-client");
      expect(within(clientSlot).getByText("John Smith")).toBeInTheDocument();
    });

    it("should update sidebar to show assigned status", () => {
      const assignmentsWithClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Check sidebar shows assignment count
      expect(screen.getByText("1 of 3 assigned")).toBeInTheDocument();

      // Check contact shows role badge in sidebar
      const contactSidebar = screen.getByTestId("contact-sidebar-contact-1");
      expect(within(contactSidebar).getByText("Buyer (Client)")).toBeInTheDocument();
    });
  });

  describe("Unassigning Contacts from Roles", () => {
    it("should call onAssignmentsChange when removing contact from role", () => {
      const assignmentsWithClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Find and click remove button on contact chip
      const removeButton = screen.getByLabelText("Remove John Smith from this role");
      fireEvent.click(removeButton);

      expect(mockOnAssignmentsChange).toHaveBeenCalledWith({
        client: [],
      });
    });
  });

  describe("Required Role Indicators", () => {
    it("should show required indicator for client role", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const clientSlot = screen.getByTestId("role-slot-client");
      expect(within(clientSlot).getByLabelText("Required")).toBeInTheDocument();
    });
  });

  describe("Multiple Contacts per Role", () => {
    it("should allow multiple contacts for roles marked as multiple", () => {
      const assignmentsWithOneClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithOneClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Client role allows multiple - should still show dropdown
      const clientSlot = screen.getByTestId("role-slot-client");
      expect(within(clientSlot).getByTestId("role-select-client")).toBeInTheDocument();
    });

    it("should show (multiple) indicator for multi-select roles", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const clientSlot = screen.getByTestId("role-slot-client");
      expect(within(clientSlot).getByText("(multiple)")).toBeInTheDocument();
    });

    it("should add second contact to same role", () => {
      const assignmentsWithOneClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithOneClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Add second contact to client role
      const clientSelect = screen.getByTestId("role-select-client");
      fireEvent.change(clientSelect, { target: { value: "contact-2" } });

      expect(mockOnAssignmentsChange).toHaveBeenCalledWith({
        client: ["contact-1", "contact-2"],
      });
    });

    it("should display multiple assigned contacts as chips", () => {
      const assignmentsWithTwoClients: RoleAssignments = {
        client: ["contact-1", "contact-2"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithTwoClients}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const clientSlot = screen.getByTestId("role-slot-client");
      expect(within(clientSlot).getByText("John Smith")).toBeInTheDocument();
      expect(within(clientSlot).getByText("Jane Doe")).toBeInTheDocument();
    });
  });

  describe("Transaction Type Filtering", () => {
    it("should show seller agent for purchase transactions", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("Seller Agent")).toBeInTheDocument();
      expect(screen.queryByText("Buyer Agent")).not.toBeInTheDocument();
    });

    it("should show buyer agent for sale transactions", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="sale"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("Buyer Agent")).toBeInTheDocument();
      expect(screen.queryByText("Seller Agent")).not.toBeInTheDocument();
    });

    it("should show correct client label for purchase (Buyer)", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("Buyer (Client)")).toBeInTheDocument();
    });

    it("should show correct client label for sale (Seller)", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="sale"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      expect(screen.getByText("Seller (Client)")).toBeInTheDocument();
    });
  });

  describe("Contact Availability", () => {
    it("should not show already-assigned contacts in dropdown for same role", () => {
      const assignmentsWithClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const clientSelect = screen.getByTestId("role-select-client");

      // John Smith should not be in options (already assigned)
      const options = within(clientSelect).getAllByRole("option");
      const optionTexts = options.map((o) => o.textContent);

      expect(optionTexts).toContain("Jane Doe");
      expect(optionTexts).toContain("Bob Wilson");
      expect(optionTexts).not.toContain("John Smith");
    });

    it("should allow same contact to be assigned to different roles", () => {
      const assignmentsWithClient: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignmentsWithClient}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // John Smith should still be available for seller_agent role
      const sellerAgentSelect = screen.getByTestId("role-select-seller_agent");
      const options = within(sellerAgentSelect).getAllByRole("option");
      const optionTexts = options.map((o) => o.textContent);

      expect(optionTexts).toContain("John Smith");
    });
  });

  describe("Sidebar Assignment Status", () => {
    it("should show checkmark for assigned contacts", () => {
      const assignments: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const johnSidebar = screen.getByTestId("contact-sidebar-contact-1");
      expect(within(johnSidebar).getByLabelText("Assigned")).toBeInTheDocument();
    });

    it("should show Unassigned text for contacts without roles", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const johnSidebar = screen.getByTestId("contact-sidebar-contact-1");
      expect(within(johnSidebar).getByText("Unassigned")).toBeInTheDocument();
    });

    it("should show all assigned roles for a contact in sidebar", () => {
      const assignments: RoleAssignments = {
        client: ["contact-1"],
        seller_agent: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const johnSidebar = screen.getByTestId("contact-sidebar-contact-1");
      expect(within(johnSidebar).getByText("Buyer (Client)")).toBeInTheDocument();
      expect(within(johnSidebar).getByText("Seller Agent")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle contacts without display_name", () => {
      const contactsWithLegacyName: ExtendedContact[] = [
        {
          id: "contact-legacy",
          user_id: "user-1",
          name: "Legacy Name",
          source: "manual",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      render(
        <RoleAssigner
          selectedContacts={contactsWithLegacyName}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Check contact appears in sidebar (scoped query)
      const sidebarItem = screen.getByTestId("contact-sidebar-contact-legacy");
      expect(within(sidebarItem).getByText("Legacy Name")).toBeInTheDocument();
    });

    it("should show Unknown for contacts without any name", () => {
      const contactsWithNoName: ExtendedContact[] = [
        {
          id: "contact-no-name",
          user_id: "user-1",
          email: "anonymous@example.com",
          source: "email",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      render(
        <RoleAssigner
          selectedContacts={contactsWithNoName}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Both sidebar and dropdown should show "Unknown"
      expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    });

    it("should handle rapid assignment changes", () => {
      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      const clientSelect = screen.getByTestId("role-select-client");

      // Rapid changes
      fireEvent.change(clientSelect, { target: { value: "contact-1" } });
      fireEvent.change(clientSelect, { target: { value: "contact-2" } });
      fireEvent.change(clientSelect, { target: { value: "contact-3" } });

      expect(mockOnAssignmentsChange).toHaveBeenCalledTimes(3);
    });

    it("should not duplicate contact when selecting same value", () => {
      const assignments: RoleAssignments = {
        client: ["contact-1"],
      };

      render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={assignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Try to assign contact-1 again (shouldn't be in dropdown anyway)
      const clientSelect = screen.getByTestId("role-select-client");
      fireEvent.change(clientSelect, { target: { value: "contact-1" } });

      // Should not have been called since contact-1 is already assigned
      expect(mockOnAssignmentsChange).not.toHaveBeenCalled();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete assignment workflow", () => {
      const { rerender } = render(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={emptyAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Step 1: Assign John as client
      let clientSelect = screen.getByTestId("role-select-client");
      fireEvent.change(clientSelect, { target: { value: "contact-1" } });
      expect(mockOnAssignmentsChange).toHaveBeenLastCalledWith({
        client: ["contact-1"],
      });

      // Simulate parent updating assignments
      const afterFirstAssign: RoleAssignments = { client: ["contact-1"] };
      rerender(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={afterFirstAssign}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Verify count updated
      expect(screen.getByText("1 of 3 assigned")).toBeInTheDocument();

      // Step 2: Assign Jane as seller agent
      const sellerSelect = screen.getByTestId("role-select-seller_agent");
      fireEvent.change(sellerSelect, { target: { value: "contact-2" } });
      expect(mockOnAssignmentsChange).toHaveBeenLastCalledWith({
        client: ["contact-1"],
        seller_agent: ["contact-2"],
      });

      // Final state
      const finalAssignments: RoleAssignments = {
        client: ["contact-1"],
        seller_agent: ["contact-2"],
      };
      rerender(
        <RoleAssigner
          selectedContacts={mockContacts}
          transactionType="purchase"
          assignments={finalAssignments}
          onAssignmentsChange={mockOnAssignmentsChange}
        />
      );

      // Verify final state
      expect(screen.getByText("2 of 3 assigned")).toBeInTheDocument();
    });
  });
});
