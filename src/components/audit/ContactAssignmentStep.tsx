/**
 * ContactAssignmentStep Component
 * Steps 2-3 of the AuditTransactionModal - Contact assignment
 * Extracted from AuditTransactionModal as part of TASK-974 decomposition
 */
import React from "react";
import {
  filterRolesByTransactionType,
  getTransactionTypeContext,
} from "../../utils/transactionRoleUtils";
import RoleAssignment from "./RoleAssignment";
import type { ContactAssignments } from "../../hooks/useAuditTransaction";

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
}

function ContactAssignmentStep({
  stepConfig,
  contactAssignments,
  onAssignContact,
  onRemoveContact,
  userId,
  transactionType,
  propertyAddress,
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
    <div className="space-y-6">
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
          userId={userId}
          propertyAddress={propertyAddress}
          transactionType={transactionType}
        />
      ))}
    </div>
  );
}

export default ContactAssignmentStep;
