import React from "react";
import { SourcePill, type ContactSource } from "./SourcePill";
import type { ExtendedContact } from "../../types/components";
import type { ContactSource as ModelContactSource } from "../../../electron/types/models";

/**
 * External contact from message participants (not yet imported)
 */
export interface ExternalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  source: "external";
  allEmails?: string[];
  allPhones?: string[];
}

/**
 * Transaction associated with a contact
 */
export interface ContactTransaction {
  id: string;
  property_address: string;
  role: string;
}

export interface ContactPreviewProps {
  /** Contact to display (imported or external) */
  contact: ExtendedContact | ExternalContact;
  /** Whether this is an external contact */
  isExternal: boolean;
  /** Transactions this contact is involved in (imported only) */
  transactions?: ContactTransaction[];
  /** Loading state for transactions */
  isLoadingTransactions?: boolean;
  /** Callback to edit the contact (imported only) */
  onEdit?: () => void;
  /** Callback to import the contact (external only) */
  onImport?: () => void;
  /** Callback to close the preview */
  onClose: () => void;
}

/**
 * Gets the display name for a contact
 */
function getDisplayName(contact: ExtendedContact | ExternalContact): string {
  if ("display_name" in contact && contact.display_name) {
    return contact.display_name;
  }
  return contact.name || "Unknown Contact";
}

/**
 * Gets the first initial from a name for avatar display
 */
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

/**
 * Maps model ContactSource to SourcePill's ContactSource
 */
function mapToSourcePillSource(
  source: ModelContactSource | string | undefined,
  isExternal: boolean
): ContactSource {
  if (isExternal) {
    return "external";
  }

  switch (source) {
    case "manual":
      return "manual";
    case "contacts_app":
      return "contacts_app";
    case "sms":
      return "sms";
    case "email":
    case "inferred":
    default:
      return "imported";
  }
}

/**
 * ContactPreview Component
 *
 * Displays a modal preview of contact details when a ContactCard is clicked.
 * Shows full contact information including:
 * - Large avatar with initial
 * - Name, emails, phones, company, title
 * - Source pill (Imported/External)
 * - Transaction list for imported contacts
 * - "Not yet imported" message for external contacts
 * - Contextual action button (Edit for imported, Import for external)
 *
 * @example
 * // Imported contact with transactions
 * <ContactPreview
 *   contact={importedContact}
 *   isExternal={false}
 *   transactions={transactions}
 *   onEdit={() => handleEdit()}
 *   onClose={() => setPreviewContact(null)}
 * />
 *
 * @example
 * // External contact
 * <ContactPreview
 *   contact={externalContact}
 *   isExternal={true}
 *   onImport={() => handleImport()}
 *   onClose={() => setPreviewContact(null)}
 * />
 */
export function ContactPreview({
  contact,
  isExternal,
  transactions = [],
  isLoadingTransactions = false,
  onEdit,
  onImport,
  onClose,
}: ContactPreviewProps): React.ReactElement {
  const displayName = getDisplayName(contact);
  const initial = getInitial(displayName);
  const sourcePillSource = mapToSourcePillSource(contact.source, isExternal);

  // Collect emails and phones
  const emails =
    contact.allEmails && contact.allEmails.length > 0
      ? contact.allEmails
      : contact.email
        ? [contact.email]
        : [];

  const phones =
    contact.allPhones && contact.allPhones.length > 0
      ? contact.allPhones
      : contact.phone
        ? [contact.phone]
        : [];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="contact-preview-backdrop"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        data-testid="contact-preview-modal"
      >
        {/* Header with close button */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close preview"
            data-testid="contact-preview-close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Contact Info Section */}
        <div className="px-6 pb-6 text-center">
          {/* Large Avatar */}
          <div
            className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4"
            data-testid="contact-preview-avatar"
          >
            {initial}
          </div>

          {/* Name */}
          <h2
            className="text-xl font-bold text-gray-900 mb-2"
            data-testid="contact-preview-name"
          >
            {displayName}
          </h2>

          {/* Contact Details */}
          <div className="text-gray-600 space-y-1 mb-4">
            {emails.length > 0 && (
              <p data-testid="contact-preview-emails">{emails.join(" | ")}</p>
            )}
            {phones.length > 0 && (
              <p data-testid="contact-preview-phones">{phones.join(" | ")}</p>
            )}
            {contact.company && (
              <p className="font-medium" data-testid="contact-preview-company">
                {contact.company}
              </p>
            )}
            {contact.title && (
              <p className="text-sm" data-testid="contact-preview-title">
                {contact.title}
              </p>
            )}
          </div>

          {/* Source Pill */}
          <SourcePill source={sourcePillSource} size="md" />
        </div>

        {/* Transactions Section (imported only) or External Message */}
        <div className="flex-1 overflow-y-auto border-t border-gray-200 px-6 py-4">
          {isExternal ? (
            <div
              className="text-center text-gray-500 py-4"
              data-testid="contact-preview-external-message"
            >
              <p className="font-medium mb-1">
                Not yet imported to Magic Audit
              </p>
              <p className="text-sm">
                Import this contact to assign them to transactions.
              </p>
            </div>
          ) : isLoadingTransactions ? (
            <div
              className="text-center py-4"
              data-testid="contact-preview-loading"
            >
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : transactions.length === 0 ? (
            <div
              className="text-center text-gray-500 py-4"
              data-testid="contact-preview-no-transactions"
            >
              <p>No transactions yet</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Transactions
              </h3>
              <div
                className="space-y-2"
                data-testid="contact-preview-transactions"
              >
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between text-sm"
                    data-testid={`contact-preview-transaction-${txn.id}`}
                  >
                    <span className="text-gray-900 truncate flex-1">
                      {txn.property_address}
                    </span>
                    <span className="text-gray-500 ml-2 flex-shrink-0">
                      {txn.role}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer with Action Button */}
        <div className="border-t border-gray-200 p-4 flex justify-end">
          {isExternal ? (
            <button
              onClick={onImport}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md"
              data-testid="contact-preview-import"
            >
              Import to Software
            </button>
          ) : (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 transition-all shadow-md"
              data-testid="contact-preview-edit"
            >
              Edit Contact
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactPreview;
