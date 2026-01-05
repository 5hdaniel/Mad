/**
 * RoleAssignment Component
 * Single role assignment with contact selection
 * Extracted from AuditTransactionModal as part of TASK-974 decomposition
 */
import React from "react";
import { getRoleDisplayName } from "../../utils/transactionRoleUtils";
import ContactSelectModal from "../ContactSelectModal";
import type { Contact } from "../../../electron/types/models";
import { usePlatform } from "../../contexts/PlatformContext";
import type { ContactAssignment } from "../../hooks/useAuditTransaction";

interface ErrorState {
  type: string;
  message: string;
  action: string;
}

interface RoleAssignmentProps {
  role: string;
  required: boolean;
  multiple: boolean;
  assignments: ContactAssignment[];
  onAssign: (
    role: string,
    contactId: string,
    isPrimary: boolean,
    notes: string,
  ) => void;
  onRemove: (role: string, contactId: string) => void;
  userId: string;
  propertyAddress: string;
  transactionType: string;
}

function RoleAssignment({
  role,
  required,
  multiple,
  assignments,
  onAssign,
  onRemove,
  userId,
  propertyAddress,
  transactionType,
}: RoleAssignmentProps): React.ReactElement {
  const { isMacOS, isWindows } = usePlatform();
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<ErrorState | null>(null);
  const [showContactSelect, setShowContactSelect] =
    React.useState<boolean>(false);

  React.useEffect(() => {
    loadContacts();
  }, [propertyAddress]);

  const loadContacts = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Use sorted API when property address is available, otherwise use regular API
      const result = propertyAddress
        ? await window.api.contacts.getSortedByActivity(
            userId,
            propertyAddress,
          )
        : await window.api.contacts.getAll(userId);

      if (result.success) {
        setContacts(result.contacts || []);

        // If no contacts returned, check if it's a permission issue
        if (!result.contacts || result.contacts.length === 0) {
          setError({
            type: "no_contacts",
            message: isMacOS
              ? "No contacts found. Make sure you have Full Disk Access enabled and have imported your emails."
              : isWindows
                ? "No contacts found. Make sure you have imported your emails and synced your iPhone messages."
                : "No contacts found. Make sure you have imported your emails.",
            action: isMacOS
              ? "Check permissions in System Settings > Privacy & Security > Full Disk Access"
              : isWindows
                ? "Connect your iPhone via USB and create a backup to sync contacts and messages"
                : "Import your emails",
          });
        }
      } else {
        // API returned error
        setError({
          type: "api_error",
          message: isMacOS
            ? result.error ||
              "Failed to load contacts. This may be due to missing permissions."
            : isWindows
              ? result.error ||
                "Failed to load contacts. Connect your iPhone to sync contacts."
              : result.error || "Failed to load contacts.",
          action: isMacOS
            ? "Please check Full Disk Access permission in System Settings"
            : isWindows
              ? "Connect your iPhone via USB and create a backup"
              : "Check your connection",
        });
      }
    } catch (err: unknown) {
      console.error("Failed to load contacts:", err);
      setError({
        type: "exception",
        message: isMacOS
          ? "Unable to load contacts. Please check your permissions."
          : isWindows
            ? "Unable to load contacts. Please sync your iPhone backup."
            : "Unable to load contacts.",
        action: isMacOS
          ? "Open System Settings and enable Full Disk Access for this app"
          : isWindows
            ? "Connect your iPhone via USB and create a backup"
            : "Try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContactsSelected = (selectedContacts: Contact[]): void => {
    selectedContacts.forEach((contact: Contact, index: number) => {
      const isPrimary = assignments.length === 0 && index === 0; // First contact is primary
      onAssign(role, contact.id, isPrimary, "");
    });
    setShowContactSelect(false);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-900">
            {getRoleDisplayName(role, transactionType as "purchase" | "sale")}
          </label>
          {required && (
            <span className="text-xs text-red-500 font-semibold">*</span>
          )}
          {multiple && (
            <span className="text-xs text-gray-500">(can assign multiple)</span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900">
                {error.message}
              </p>
              <p className="text-xs text-yellow-700 mt-1">{error.action}</p>
              <button
                onClick={async () => {
                  if (window.api?.system?.openPrivacyPane) {
                    await window.api.system.openPrivacyPane("fullDiskAccess");
                  }
                }}
                className="mt-2 text-xs font-medium text-yellow-800 hover:text-yellow-900 underline"
              >
                Open System Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="mb-3 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Loading contacts...</span>
        </div>
      )}

      {/* Assigned Contacts */}
      {assignments.length > 0 && (
        <div className="mb-3 space-y-2">
          {assignments.map((assignment: ContactAssignment, index: number) => {
            const contact = contacts.find(
              (c: Contact) => c.id === assignment.contactId,
            );
            return (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {contact?.name || "Unknown Contact"}
                  </p>
                  {contact?.email && (
                    <p className="text-xs text-gray-500">{contact.email}</p>
                  )}
                  {assignment.notes && (
                    <p className="text-xs text-gray-600 mt-1">
                      {assignment.notes}
                    </p>
                  )}
                  {assignment.isPrimary && (
                    <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(role, assignment.contactId)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
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
            );
          })}
        </div>
      )}

      {/* Add Contact Button (if multiple allowed or no contact assigned) */}
      {!loading && (multiple || assignments.length === 0) && (
        <button
          onClick={() => setShowContactSelect(true)}
          disabled={error !== null && error.type !== "no_contacts"}
          className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            error !== null && error.type !== "no_contacts"
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-indigo-500 text-white hover:bg-indigo-600"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          {multiple ? "Select Contacts" : "Select Contact"}
        </button>
      )}

      {/* Contact Select Modal */}
      {showContactSelect && (
        <ContactSelectModal
          contacts={contacts as unknown as never[]}
          excludeIds={
            assignments.map(
              (a: ContactAssignment) => a.contactId,
            ) as unknown as never[]
          }
          multiple={multiple}
          onSelect={handleContactsSelected as unknown as never}
          onClose={() => setShowContactSelect(false)}
          propertyAddress={propertyAddress}
        />
      )}
    </div>
  );
}

export default RoleAssignment;
