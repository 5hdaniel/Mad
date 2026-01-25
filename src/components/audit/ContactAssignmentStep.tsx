/**
 * ContactAssignmentStep Component
 * Steps 2-3 of the AuditTransactionModal - Contact assignment
 * Extracted from AuditTransactionModal as part of TASK-974 decomposition
 *
 * Contact Loading Optimization:
 * Contacts are now loaded at the parent level (useAuditTransaction hook)
 * and passed as props to prevent duplicate API calls when switching
 * between steps 2 and 3. Previously, each step would trigger its own
 * contact loading on mount, causing repeated fetches every ~1.3 seconds.
 */
import React from "react";
import {
  filterRolesByTransactionType,
  getTransactionTypeContext,
} from "../../utils/transactionRoleUtils";
import RoleAssignment from "./RoleAssignment";
import type { ContactAssignments } from "../../hooks/useAuditTransaction";
import type { Contact } from "../../../electron/types/models";

interface StepConfig {
  title: string;
  description: string;
  roles: RoleConfig[];
}

interface RoleConfig {
  role: string;
  required: boolean;
  multiple: boolean;
}

interface ContactAssignmentStepProps {
  stepConfig: StepConfig;
  contactAssignments: ContactAssignments;
  onAssignContact: (
    role: string,
    contactId: string,
    isPrimary: boolean,
    notes: string,
  ) => void;
  onRemoveContact: (role: string, contactId: string) => void;
  userId: string;
  transactionType: string;
  propertyAddress: string;
  // Contacts loaded at parent level (useAuditTransaction hook)
  contacts: Contact[];
  contactsLoading: boolean;
  contactsError: string | null;
  onRefreshContacts: () => void;
}

function ContactAssignmentStep({
  stepConfig,
  contactAssignments,
  onAssignContact,
  onRemoveContact,
  userId,
  transactionType,
  propertyAddress,
  // Contacts loaded at parent level
  contacts,
  contactsLoading,
  contactsError,
  onRefreshContacts,
}: ContactAssignmentStepProps): React.ReactElement {
  // Filter roles based on transaction type
  const filteredRoles = filterRolesByTransactionType(
    stepConfig.roles,
    transactionType as "purchase" | "sale",
    stepConfig.title,
  );
  const context = getTransactionTypeContext(
    transactionType as "purchase" | "sale",
  );

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay - prevents layout shift by covering content */}
      {contactsLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Loading contacts...</span>
          </div>
        </div>
      )}

      {contactsError && (
        <div className="text-sm text-red-600 text-center py-2">
          {contactsError}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {stepConfig.title}
        </h3>
        <p className="text-sm text-gray-600 mb-4">{stepConfig.description}</p>
        {stepConfig.title === "Client & Agents" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-800">
              <strong>{context.title}</strong>
              <br />
              {context.message}
            </p>
          </div>
        )}
      </div>

      {filteredRoles.map((roleConfig: RoleConfig) => (
        <RoleAssignment
          key={roleConfig.role}
          role={roleConfig.role}
          required={roleConfig.required}
          multiple={roleConfig.multiple}
          assignments={contactAssignments[roleConfig.role] || []}
          onAssign={onAssignContact}
          onRemove={onRemoveContact}
          contacts={contacts}
          onRefreshContacts={onRefreshContacts}
          userId={userId}
          propertyAddress={propertyAddress}
          transactionType={transactionType}
        />
      ))}
    </div>
  );
}

export default ContactAssignmentStep;
