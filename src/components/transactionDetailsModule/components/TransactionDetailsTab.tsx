/**
 * TransactionDetailsTab Component (renamed to Overview)
 * Overview tab content showing audit period dates, AI suggestions, and key contacts summary.
 * Email threads moved to TransactionEmailsTab as part of TASK-1152.
 */
import React, { useState } from "react";
import type { Transaction } from "@/types";
import type { ContactAssignment, ResolvedSuggestedContact } from "../types";
import { getRoleDisplayName, type TransactionType } from "@/utils/transactionRoleUtils";
import { ContactPreview } from "../../shared/ContactPreview";
import type { ExtendedContact } from "../../../types/components";

interface TransactionDetailsTabProps {
  transaction: Transaction;
  contactAssignments: ContactAssignment[];
  loading: boolean;
  onEdit?: () => void;
  onEditContacts?: () => void;
  onDelete?: () => void;
  /** AI suggested contacts to review */
  resolvedSuggestions?: ResolvedSuggestedContact[];
  /** ID of contact currently being processed */
  processingContactId?: string | null;
  /** Whether all suggestions are being processed */
  processingAll?: boolean;
  /** Callback when a suggestion is accepted */
  onAcceptSuggestion?: (suggestion: ResolvedSuggestedContact) => void;
  /** Callback when a suggestion is rejected */
  onRejectSuggestion?: (suggestion: ResolvedSuggestedContact) => void;
  /** Callback to accept all suggestions */
  onAcceptAll?: () => void;
  /** Callback to sync communications for all contacts */
  onSyncCommunications?: () => Promise<void>;
  /** Whether sync is in progress */
  syncingCommunications?: boolean;
}

// Helper function to format date in readable format
function formatAuditDate(date: Date | string | undefined | null): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

// Helper to get transaction type display text
function getTransactionTypeDisplay(type: string | undefined): { label: string; color: string } {
  switch (type) {
    case "purchase":
      return { label: "Purchase", color: "bg-blue-100 text-blue-800" };
    case "sale":
      return { label: "Sale", color: "bg-green-100 text-green-800" };
    default:
      return { label: "Other", color: "bg-gray-100 text-gray-700" };
  }
}

export function TransactionDetailsTab({
  transaction,
  contactAssignments,
  loading,
  onEdit,
  onEditContacts,
  onDelete,
  resolvedSuggestions = [],
  processingContactId,
  processingAll = false,
  onAcceptSuggestion,
  onRejectSuggestion,
  onAcceptAll,
  onSyncCommunications,
  syncingCommunications = false,
}: TransactionDetailsTabProps): React.ReactElement {
  // Contact preview state for viewing details when clicking a contact card
  const [previewContact, setPreviewContact] = useState<ExtendedContact | null>(null);

  /**
   * Build a minimal ExtendedContact from a ContactAssignment for preview display.
   * ContactAssignment has contact_id, contact_name, contact_email, etc.
   */
  const handleContactCardClick = (assignment: ContactAssignment) => {
    const contact: ExtendedContact = {
      id: assignment.contact_id,
      name: assignment.contact_name || "Unknown Contact",
      display_name: assignment.contact_name || "Unknown Contact",
      email: assignment.contact_email || "",
      phone: assignment.contact_phone || "",
      company: assignment.contact_company || "",
      source: "manual",
      user_id: transaction.user_id,
      created_at: "",
      updated_at: "",
    };
    setPreviewContact(contact);
  };

  // Format audit period
  const startDate = formatAuditDate(transaction.started_at);
  const endDate = formatAuditDate(transaction.closed_at);
  const auditPeriodText = startDate && endDate
    ? `${startDate} - ${endDate}`
    : startDate
    ? `${startDate} - Ongoing`
    : endDate
    ? `Through ${endDate}`
    : null;

  // Format closing date for summary line
  const closingDate = formatAuditDate(transaction.closing_deadline);

  // Get transaction type info
  const typeInfo = getTransactionTypeDisplay(transaction.transaction_type);

  return (
    <>
      {/* Transaction Overview Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Summary
          </h4>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit Summary"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span className="hidden sm:inline">Edit Summary</span>
            </button>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Transaction Type Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Type:</span>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
            {/* Audit Period */}
            {auditPeriodText && (
              <>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-sm text-gray-600">Audit Period:</span>
                  <span className="text-sm font-medium text-gray-900">{auditPeriodText}</span>
                </div>
              </>
            )}
            {/* Closing Date */}
            {closingDate && (
              <>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Closing:</span>
                  <span className="text-sm font-medium text-gray-900">{closingDate}</span>
                </div>
              </>
            )}
          </div>
          {/* Address Row */}
          {transaction.property_address && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-gray-600">Address:</span>
              <span className="text-sm font-medium text-gray-900">{transaction.property_address}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Suggested Contacts Section - only show if there are suggestions */}
      {resolvedSuggestions.length > 0 && onAcceptSuggestion && onRejectSuggestion && onAcceptAll && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h4 className="text-lg font-semibold text-gray-900">
                AI Suggested Contacts
              </h4>
              <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                {resolvedSuggestions.length} suggestion{resolvedSuggestions.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={onAcceptAll}
              disabled={processingAll || !!processingContactId}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {processingAll ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept All
                </>
              )}
            </button>
          </div>
          <div className="space-y-3">
            {resolvedSuggestions.map((suggestion) => (
              <SuggestedContactCard
                key={suggestion.contact_id}
                suggestion={suggestion}
                transactionType={(transaction.transaction_type as TransactionType) || "other"}
                isProcessing={processingContactId === suggestion.contact_id}
                isDisabled={processingAll}
                onAccept={() => onAcceptSuggestion(suggestion)}
                onReject={() => onRejectSuggestion(suggestion)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Contacts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Key Contacts
          </h4>
          <div className="flex items-center gap-2">
            {onSyncCommunications && contactAssignments.length > 0 && (
              <button
                onClick={onSyncCommunications}
                disabled={syncingCommunications}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sync Communications"
              >
                {syncingCommunications ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Syncing...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="hidden sm:inline">Sync</span>
                  </>
                )}
              </button>
            )}
            {onEditContacts && (
              <button
                onClick={onEditContacts}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit Contacts"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span className="hidden sm:inline">Edit Contacts</span>
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : contactAssignments.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <p className="text-gray-600 mb-1">No contacts assigned</p>
            <p className="text-sm text-gray-500">
              Click &quot;Edit Contacts&quot; to add contacts to this transaction
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contactAssignments.map((assignment) => (
              <ContactSummaryCard
                key={assignment.id}
                assignment={assignment}
                transactionType={(transaction.transaction_type as TransactionType) || "other"}
                onClick={() => handleContactCardClick(assignment)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Transaction Button */}
      {onDelete && (
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Transaction
          </button>
        </div>
      )}

      {/* Contact Preview Modal */}
      {previewContact && (
        <ContactPreview
          contact={previewContact}
          isExternal={false}
          transactions={[]}
          onEdit={() => setPreviewContact(null)}
          onClose={() => setPreviewContact(null)}
        />
      )}
    </>
  );
}

// Sub-component for contact summary cards in Overview
function ContactSummaryCard({
  assignment,
  transactionType,
  onClick,
}: {
  assignment: ContactAssignment;
  transactionType: TransactionType;
  onClick?: () => void;
}) {
  const role = assignment.specific_role || assignment.role || "Unknown Role";
  const name = assignment.contact_name || "Unknown Contact";
  const email = assignment.contact_email;
  const phone = assignment.contact_phone;
  const company = assignment.contact_company;
  const isPrimary = assignment.is_primary === 1;

  return (
    <div
      className={`bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between${onClick ? " cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      data-testid={`contact-summary-card-${assignment.contact_id}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-gray-900${onClick ? " hover:text-purple-700" : ""}`}>{name}</span>
            {isPrimary && (
              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                Primary
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {email && <span>{email}</span>}
            {email && phone && <span className="text-gray-300">|</span>}
            {phone && <span>{phone}</span>}
          </div>
          {company && (
            <span className="text-xs text-gray-500">{company}</span>
          )}
        </div>
      </div>
      {/* Role badge */}
      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
        {getRoleDisplayName(role, transactionType)}
      </span>
    </div>
  );
}

// Sub-component for AI suggested contact cards
function SuggestedContactCard({
  suggestion,
  transactionType,
  isProcessing,
  isDisabled,
  onAccept,
  onReject,
}: {
  suggestion: ResolvedSuggestedContact;
  transactionType: TransactionType;
  isProcessing: boolean;
  isDisabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const contact = suggestion.contact;
  const displayName = contact?.display_name || contact?.name || "Unknown Contact";
  const displayEmail = contact?.email || "";
  const displayCompany = contact?.company || "";

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
              {getRoleDisplayName(suggestion.role, transactionType)}
            </span>
            {suggestion.is_primary && (
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                Primary
              </span>
            )}
            <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
              AI Suggested
            </span>
          </div>
          <h5 className="font-semibold text-gray-900">{displayName}</h5>
          {displayEmail && (
            <p className="text-sm text-gray-600 mt-1">{displayEmail}</p>
          )}
          {displayCompany && (
            <p className="text-sm text-gray-500 mt-0.5">{displayCompany}</p>
          )}
          {suggestion.notes && (
            <p className="text-sm text-gray-700 mt-2 italic">
              Note: {suggestion.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onAccept}
            disabled={isProcessing || isDisabled}
            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Accept suggestion"
          >
            {isProcessing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isProcessing || isDisabled}
            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reject suggestion"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
