/**
 * RoleAssigner Component
 *
 * Step 2 of the 2-step contact selection flow.
 * Receives selected contacts and allows the user to assign roles to them.
 *
 * Features:
 * - Displays selected contacts with assignment status
 * - Groups roles by workflow steps (Client & Agents, Professional Services)
 * - Filters roles based on transaction type (purchase/sale)
 * - Supports multiple contacts per role
 * - Shows required role indicators
 * - ARIA accessibility attributes
 *
 * @see TASK-1721: RoleAssigner Integration
 * @see BACKLOG-418: Redesign Contact Selection UX (Select First, Assign Roles Second)
 */

import React, { useMemo, useCallback } from "react";
import type { ExtendedContact } from "../../types/components";
import {
  AUDIT_WORKFLOW_STEPS,
  ROLE_DISPLAY_NAMES,
} from "../../constants/contactRoles";
import {
  filterRolesByTransactionType,
  getRoleDisplayName,
} from "../../utils/transactionRoleUtils";

/**
 * Role assignments mapping: role -> array of contact IDs
 */
export interface RoleAssignments {
  [role: string]: string[];
}

/**
 * Role configuration from workflow steps
 */
interface RoleConfig {
  role: string;
  required: boolean;
  multiple: boolean;
}

export interface RoleAssignerProps {
  /** Contacts that were selected in step 1 */
  selectedContacts: ExtendedContact[];
  /** Transaction type for role filtering */
  transactionType: "purchase" | "sale" | "other";
  /** Current role assignments */
  assignments: RoleAssignments;
  /** Callback when assignments change */
  onAssignmentsChange: (assignments: RoleAssignments) => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Contact chip component for displaying assigned contacts
 */
interface ContactChipProps {
  contact: ExtendedContact;
  onRemove: () => void;
}

function ContactChip({ contact, onRemove }: ContactChipProps): React.ReactElement {
  const displayName = contact.display_name || contact.name || "Unknown";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
      data-testid={`contact-chip-${contact.id}`}
    >
      <span
        className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold"
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="truncate max-w-24">{displayName}</span>
      <button
        onClick={onRemove}
        className="w-4 h-4 flex items-center justify-center text-purple-600 hover:text-purple-800 hover:bg-purple-200 rounded-full transition-colors"
        aria-label={`Remove ${displayName} from this role`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
}

/**
 * Role slot component for each assignable role
 */
interface RoleSlotProps {
  role: string;
  displayName: string;
  required: boolean;
  multiple: boolean;
  assignedContacts: ExtendedContact[];
  availableContacts: ExtendedContact[];
  onAssign: (contactId: string) => void;
  onUnassign: (contactId: string) => void;
}

function RoleSlot({
  role,
  displayName,
  required,
  multiple,
  assignedContacts,
  availableContacts,
  onAssign,
  onUnassign,
}: RoleSlotProps): React.ReactElement {
  const canAssignMore = multiple || assignedContacts.length === 0;
  const hasAssignments = assignedContacts.length > 0;

  return (
    <div
      className="bg-gray-50 border border-gray-200 rounded-lg p-3"
      data-testid={`role-slot-${role}`}
    >
      {/* Role Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">{displayName}</span>
          {required && (
            <span className="text-red-500 text-xs font-semibold" aria-label="Required">
              *
            </span>
          )}
          {multiple && (
            <span className="text-xs text-gray-500">(multiple)</span>
          )}
        </div>
      </div>

      {/* Assigned Contacts */}
      {hasAssignments && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {assignedContacts.map((contact) => (
            <ContactChip
              key={contact.id}
              contact={contact}
              onRemove={() => onUnassign(contact.id)}
            />
          ))}
        </div>
      )}

      {/* Add Contact Dropdown */}
      {canAssignMore && availableContacts.length > 0 && (
        <select
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onAssign(e.target.value);
            }
          }}
          aria-label={`Assign contact to ${displayName}`}
          data-testid={`role-select-${role}`}
        >
          <option value="">+ Add contact...</option>
          {availableContacts.map((contact) => {
            const name = contact.display_name || contact.name || "Unknown";
            return (
              <option key={contact.id} value={contact.id}>
                {name}
              </option>
            );
          })}
        </select>
      )}

      {/* No more contacts message */}
      {canAssignMore && availableContacts.length === 0 && !hasAssignments && (
        <p className="text-sm text-gray-400 italic">No contacts available</p>
      )}

      {/* At capacity message */}
      {!canAssignMore && !multiple && (
        <p className="text-xs text-gray-500">Only one contact allowed for this role</p>
      )}
    </div>
  );
}

/**
 * Contact sidebar item showing assignment status
 */
interface ContactSidebarItemProps {
  contact: ExtendedContact;
  assignedRoles: string[];
  transactionType: "purchase" | "sale" | "other";
}

function ContactSidebarItem({
  contact,
  assignedRoles,
  transactionType,
}: ContactSidebarItemProps): React.ReactElement {
  const displayName = contact.display_name || contact.name || "Unknown";
  const initial = displayName.charAt(0).toUpperCase();
  const email = contact.email || (contact.allEmails?.[0] ?? null);
  const isAssigned = assignedRoles.length > 0;

  return (
    <div
      className={`p-3 border-b border-gray-100 ${
        isAssigned ? "bg-purple-50" : "bg-white"
      }`}
      data-testid={`contact-sidebar-${contact.id}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
            isAssigned
              ? "bg-gradient-to-br from-purple-500 to-pink-600"
              : "bg-gray-400"
          }`}
        >
          {initial}
        </div>

        {/* Contact Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">{displayName}</div>
          {email && (
            <div className="text-xs text-gray-500 truncate">{email}</div>
          )}
          {/* Assigned Roles */}
          {isAssigned && (
            <div className="flex flex-wrap gap-1 mt-1">
              {assignedRoles.map((role) => (
                <span
                  key={role}
                  className="px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded text-xs"
                >
                  {getRoleDisplayName(role, transactionType)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status Indicator */}
        {isAssigned ? (
          <svg
            className="w-5 h-5 text-purple-500 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-label="Assigned"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <span className="text-xs text-gray-400 flex-shrink-0">Unassigned</span>
        )}
      </div>
    </div>
  );
}

/**
 * RoleAssigner - Main component
 */
export function RoleAssigner({
  selectedContacts,
  transactionType,
  assignments,
  onAssignmentsChange,
  className,
}: RoleAssignerProps): React.ReactElement {
  // Get contact lookup map for O(1) access
  const contactsById = useMemo(() => {
    return new Map(selectedContacts.map((c) => [c.id, c]));
  }, [selectedContacts]);

  // Calculate which roles each contact is assigned to
  const contactRolesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    selectedContacts.forEach((c) => map.set(c.id, []));

    Object.entries(assignments).forEach(([role, contactIds]) => {
      contactIds.forEach((contactId) => {
        const roles = map.get(contactId);
        if (roles) {
          roles.push(role);
        }
      });
    });

    return map;
  }, [selectedContacts, assignments]);

  // Calculate assignment stats
  const assignedCount = useMemo(() => {
    return selectedContacts.filter((c) => {
      const roles = contactRolesMap.get(c.id);
      return roles && roles.length > 0;
    }).length;
  }, [selectedContacts, contactRolesMap]);

  // Handle assigning a contact to a role
  const handleAssign = useCallback(
    (role: string, contactId: string) => {
      const currentAssignments = assignments[role] || [];
      if (!currentAssignments.includes(contactId)) {
        onAssignmentsChange({
          ...assignments,
          [role]: [...currentAssignments, contactId],
        });
      }
    },
    [assignments, onAssignmentsChange]
  );

  // Handle unassigning a contact from a role
  const handleUnassign = useCallback(
    (role: string, contactId: string) => {
      const currentAssignments = assignments[role] || [];
      onAssignmentsChange({
        ...assignments,
        [role]: currentAssignments.filter((id) => id !== contactId),
      });
    },
    [assignments, onAssignmentsChange]
  );

  // Get available contacts for a specific role (not already assigned to that role)
  const getAvailableContactsForRole = useCallback(
    (role: string): ExtendedContact[] => {
      const assigned = assignments[role] || [];
      return selectedContacts.filter((c) => !assigned.includes(c.id));
    },
    [selectedContacts, assignments]
  );

  // Get assigned contacts for a specific role
  const getAssignedContactsForRole = useCallback(
    (role: string): ExtendedContact[] => {
      const assignedIds = assignments[role] || [];
      return assignedIds
        .map((id) => contactsById.get(id))
        .filter((c): c is ExtendedContact => c !== undefined);
    },
    [assignments, contactsById]
  );

  return (
    <div
      className={`flex border border-gray-200 rounded-lg overflow-hidden bg-white ${
        className || ""
      }`}
      data-testid="role-assigner"
    >
      {/* Left Sidebar: Selected Contacts */}
      <div className="w-64 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Selected Contacts</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {assignedCount} of {selectedContacts.length} assigned
          </p>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {selectedContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No contacts selected
            </div>
          ) : (
            selectedContacts.map((contact) => (
              <ContactSidebarItem
                key={contact.id}
                contact={contact}
                assignedRoles={contactRolesMap.get(contact.id) || []}
                transactionType={transactionType}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Role Assignment Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedContacts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
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
              <p>Select contacts first to assign roles</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {AUDIT_WORKFLOW_STEPS.map((step, stepIdx) => {
              // Filter roles based on transaction type
              const stepRoles = filterRolesByTransactionType(
                step.roles as RoleConfig[],
                transactionType,
                step.title
              );

              if (stepRoles.length === 0) return null;

              return (
                <div key={stepIdx} data-testid={`workflow-step-${stepIdx}`}>
                  {/* Step Header */}
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-900">{step.title}</h4>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>

                  {/* Role Slots Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {stepRoles.map((roleConfig: RoleConfig) => {
                      const displayName = getRoleDisplayName(
                        roleConfig.role,
                        transactionType
                      );
                      const assignedContacts = getAssignedContactsForRole(
                        roleConfig.role
                      );
                      const availableContacts = getAvailableContactsForRole(
                        roleConfig.role
                      );

                      return (
                        <RoleSlot
                          key={roleConfig.role}
                          role={roleConfig.role}
                          displayName={displayName}
                          required={roleConfig.required}
                          multiple={roleConfig.multiple}
                          assignedContacts={assignedContacts}
                          availableContacts={availableContacts}
                          onAssign={(contactId) =>
                            handleAssign(roleConfig.role, contactId)
                          }
                          onUnassign={(contactId) =>
                            handleUnassign(roleConfig.role, contactId)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RoleAssigner;
