/**
 * TransactionDetailsTab Component (renamed to Overview)
 * Overview tab content showing audit period dates and key contacts summary.
 * Email threads moved to TransactionEmailsTab as part of TASK-1152.
 */
import React from "react";
import type { Transaction } from "@/types";
import type { ContactAssignment } from "../types";

interface TransactionDetailsTabProps {
  transaction: Transaction;
  contactAssignments: ContactAssignment[];
  loading: boolean;
  onEditContacts?: () => void;
}

export function TransactionDetailsTab({
  transaction,
  contactAssignments,
  loading,
  onEditContacts,
}: TransactionDetailsTabProps): React.ReactElement {
  return (
    <>
      {/* Audit Period Section */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-600"
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
          Audit Period
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Start Date</p>
            <p className="text-xl font-bold text-gray-900">
              {transaction.started_at
                ? new Date(transaction.started_at).toLocaleDateString(undefined, { timeZone: "UTC" })
                : "N/A"}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Closing Date</p>
            <p className="text-xl font-bold text-gray-900">
              {transaction.closing_deadline
                ? new Date(transaction.closing_deadline).toLocaleDateString(undefined, { timeZone: "UTC" })
                : "N/A"}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">End Date</p>
            <p className="text-xl font-bold text-gray-900">
              {transaction.closed_at
                ? new Date(transaction.closed_at).toLocaleDateString(undefined, { timeZone: "UTC" })
                : "Ongoing"}
            </p>
          </div>
        </div>
      </div>

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
          {onEditContacts && (
            <button
              onClick={onEditContacts}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
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
              Edit Contacts
            </button>
          )}
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
              Go to the Roles & Contacts tab to add contacts
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contactAssignments.map((assignment) => (
              <ContactSummaryCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Sub-component for contact summary cards in Overview
function ContactSummaryCard({
  assignment,
}: {
  assignment: ContactAssignment;
}) {
  const role = assignment.specific_role || assignment.role || "Unknown Role";
  const name = assignment.contact_name || "Unknown Contact";
  const email = assignment.contact_email;
  const phone = assignment.contact_phone;
  const company = assignment.contact_company;
  const isPrimary = assignment.is_primary === 1;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{name}</span>
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
        {role}
      </span>
    </div>
  );
}
