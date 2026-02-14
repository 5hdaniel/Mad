import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ContactPreview,
  type ContactPreviewProps,
  type ContactTransaction,
} from "./ContactPreview";
import type { ExtendedContact } from "../../types/components";

// Mock imported contact
const mockImportedContact: ExtendedContact = {
  id: "contact-1",
  user_id: "user-1",
  name: "John Smith",
  display_name: "John Smith",
  email: "john@email.com",
  phone: "+1-555-1234",
  company: "ABC Realty",
  title: "Sales Manager",
  source: "contacts_app",
  allEmails: ["john@email.com", "john.smith@work.com"],
  allPhones: ["+1-555-1234", "+1-555-5678"],
  is_message_derived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock external contact - now uses ExtendedContact with is_message_derived flag
const mockExternalContact: ExtendedContact = {
  id: "contact-2",
  user_id: "user-1",
  name: "Bob Wilson",
  display_name: "Bob Wilson",
  email: "bob@work.com",
  phone: "+1-310-555-6789",
  company: "XYZ Corp",
  title: "Agent",
  source: "inferred",
  is_message_derived: true, // Marks as external
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock transactions
const mockTransactions: ContactTransaction[] = [
  { id: "txn-1", property_address: "123 Main St", role: "Buyer" },
  { id: "txn-2", property_address: "456 Oak Ave", role: "Seller Agent" },
  { id: "txn-3", property_address: "789 Elm Blvd", role: "Transaction Coordinator" },
];

const defaultProps: ContactPreviewProps = {
  contact: mockImportedContact,
  isExternal: false,
  transactions: mockTransactions,
  onClose: jest.fn(),
  onEdit: jest.fn(),
};

function renderContactPreview(props: Partial<ContactPreviewProps> = {}) {
  return render(<ContactPreview {...defaultProps} {...props} />);
}

describe("ContactPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("contact info display", () => {
    it("displays contact name", () => {
      renderContactPreview();
      expect(screen.getByTestId("contact-preview-name")).toHaveTextContent(
        "John Smith"
      );
    });

    it("displays large avatar with initial", () => {
      renderContactPreview();
      const avatar = screen.getByTestId("contact-preview-avatar");
      expect(avatar).toHaveTextContent("J");
      expect(avatar).toHaveClass("w-16", "h-16");
    });

    it("displays all emails joined by pipe", () => {
      renderContactPreview();
      expect(screen.getByTestId("contact-preview-emails")).toHaveTextContent(
        "john@email.com | john.smith@work.com"
      );
    });

    it("displays all phones joined by pipe", () => {
      renderContactPreview();
      expect(screen.getByTestId("contact-preview-phones")).toHaveTextContent(
        "+1-555-1234 | +1-555-5678"
      );
    });

    it("displays single email when allEmails is empty", () => {
      const contactWithSingleEmail: ExtendedContact = {
        ...mockImportedContact,
        allEmails: [],
        email: "single@email.com",
      };
      renderContactPreview({ contact: contactWithSingleEmail });
      expect(screen.getByTestId("contact-preview-emails")).toHaveTextContent(
        "single@email.com"
      );
    });

    it("displays single phone when allPhones is empty", () => {
      const contactWithSinglePhone: ExtendedContact = {
        ...mockImportedContact,
        allPhones: [],
        phone: "+1-111-1111",
      };
      renderContactPreview({ contact: contactWithSinglePhone });
      expect(screen.getByTestId("contact-preview-phones")).toHaveTextContent(
        "+1-111-1111"
      );
    });

    it("displays company if present", () => {
      renderContactPreview();
      expect(screen.getByTestId("contact-preview-company")).toHaveTextContent(
        "ABC Realty"
      );
    });

    it("does not display company if not present", () => {
      const contactWithoutCompany: ExtendedContact = {
        ...mockImportedContact,
        company: undefined,
      };
      renderContactPreview({ contact: contactWithoutCompany });
      expect(
        screen.queryByTestId("contact-preview-company")
      ).not.toBeInTheDocument();
    });

    it("displays title if present", () => {
      renderContactPreview();
      expect(screen.getByTestId("contact-preview-title")).toHaveTextContent(
        "Sales Manager"
      );
    });

    it("does not display title if not present", () => {
      const contactWithoutTitle: ExtendedContact = {
        ...mockImportedContact,
        title: undefined,
      };
      renderContactPreview({ contact: contactWithoutTitle });
      expect(
        screen.queryByTestId("contact-preview-title")
      ).not.toBeInTheDocument();
    });

    it("displays source pill with imported variant", () => {
      renderContactPreview();
      expect(screen.getByTestId("source-pill-imported")).toBeInTheDocument();
    });

    it("displays source pill with external variant for external contacts", () => {
      renderContactPreview({
        contact: mockExternalContact,
        isExternal: true,
      });
      expect(screen.getByTestId("source-pill-external")).toBeInTheDocument();
    });

    it("falls back to name when display_name is not present", () => {
      const contactWithoutDisplayName: ExtendedContact = {
        ...mockImportedContact,
        display_name: undefined,
        name: "Fallback Name",
      };
      renderContactPreview({ contact: contactWithoutDisplayName });
      expect(screen.getByTestId("contact-preview-name")).toHaveTextContent(
        "Fallback Name"
      );
    });

    it("shows Unknown Contact when no name available", () => {
      const contactWithoutName: ExtendedContact = {
        ...mockImportedContact,
        display_name: undefined,
        name: "",
      };
      renderContactPreview({ contact: contactWithoutName });
      expect(screen.getByTestId("contact-preview-name")).toHaveTextContent(
        "Unknown Contact"
      );
    });
  });

  describe("imported contact", () => {
    it("shows transaction list", () => {
      renderContactPreview();
      expect(
        screen.getByTestId("contact-preview-transactions")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("contact-preview-transaction-txn-1")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("contact-preview-transaction-txn-2")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("contact-preview-transaction-txn-3")
      ).toBeInTheDocument();
    });

    it("displays transaction address and role", () => {
      renderContactPreview();
      const txn1 = screen.getByTestId("contact-preview-transaction-txn-1");
      expect(txn1).toHaveTextContent("123 Main St");
      expect(txn1).toHaveTextContent("Buyer");
    });

    it("hides transactions section when list is empty", () => {
      renderContactPreview({ transactions: [] });
      expect(
        screen.queryByTestId("contact-preview-transactions")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("No transactions yet")
      ).not.toBeInTheDocument();
    });

    it("shows loading spinner when loading transactions", () => {
      renderContactPreview({ isLoadingTransactions: true });
      expect(screen.getByTestId("contact-preview-loading")).toBeInTheDocument();
    });

    it("displays 'Edit Contact' button", () => {
      renderContactPreview();
      expect(screen.getByTestId("contact-preview-edit")).toBeInTheDocument();
      expect(screen.getByTestId("contact-preview-edit")).toHaveTextContent(
        "Edit Contact"
      );
    });

    it("calls onEdit when button clicked", () => {
      const onEdit = jest.fn();
      renderContactPreview({ onEdit });
      fireEvent.click(screen.getByTestId("contact-preview-edit"));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("does not show import button", () => {
      renderContactPreview();
      expect(
        screen.queryByTestId("contact-preview-import")
      ).not.toBeInTheDocument();
    });
  });

  describe("external contact", () => {
    const externalProps: Partial<ContactPreviewProps> = {
      contact: mockExternalContact,
      isExternal: true,
      onImport: jest.fn(),
    };

    it("shows 'Not yet imported' message", () => {
      renderContactPreview(externalProps);
      expect(
        screen.getByTestId("contact-preview-external-message")
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("contact-preview-external-message")
      ).toHaveTextContent("Not yet imported to Magic Audit");
      expect(
        screen.getByTestId("contact-preview-external-message")
      ).toHaveTextContent("Import this contact to assign them to transactions");
    });

    it("does not show transaction list", () => {
      renderContactPreview(externalProps);
      expect(
        screen.queryByTestId("contact-preview-transactions")
      ).not.toBeInTheDocument();
    });

    it("displays 'Import to Software' button", () => {
      renderContactPreview(externalProps);
      expect(screen.getByTestId("contact-preview-import")).toBeInTheDocument();
      expect(screen.getByTestId("contact-preview-import")).toHaveTextContent(
        "Import to Software"
      );
    });

    it("calls onImport when button clicked", () => {
      const onImport = jest.fn();
      renderContactPreview({ ...externalProps, onImport });
      fireEvent.click(screen.getByTestId("contact-preview-import"));
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    it("does not show edit button", () => {
      renderContactPreview(externalProps);
      expect(
        screen.queryByTestId("contact-preview-edit")
      ).not.toBeInTheDocument();
    });
  });

  describe("dismissal", () => {
    it("calls onClose when close button clicked", () => {
      const onClose = jest.fn();
      renderContactPreview({ onClose });
      fireEvent.click(screen.getByTestId("contact-preview-close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when backdrop clicked", () => {
      const onClose = jest.fn();
      renderContactPreview({ onClose });
      fireEvent.click(screen.getByTestId("contact-preview-backdrop"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not close when modal content clicked", () => {
      const onClose = jest.fn();
      renderContactPreview({ onClose });
      fireEvent.click(screen.getByTestId("contact-preview-modal"));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("close button has aria-label", () => {
      renderContactPreview();
      const closeButton = screen.getByTestId("contact-preview-close");
      expect(closeButton).toHaveAttribute("aria-label", "Close preview");
    });
  });
});
