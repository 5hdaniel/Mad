import React from "react";
import { SourcePill, ContactSource as SourcePillSource } from "./SourcePill";
import type { ExtendedContact } from "../../types/components";
import type { ContactSource as ModelContactSource } from "../../../electron/types/models";

/**
 * Role option for the dropdown
 */
export interface RoleOption {
  value: string;
  label: string;
}

export interface ContactRoleRowProps {
  /** The contact to display */
  contact: ExtendedContact;
  /** Currently assigned role (empty string = unassigned) */
  currentRole: string;
  /** Available role options */
  roleOptions: RoleOption[];
  /** Callback when role changes */
  onRoleChange: (role: string) => void;
  /** Callback when remove button is clicked (optional - hides button if not provided) */
  onRemove?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Gets the first initial from a name for avatar display
 */
function getInitial(name: string | undefined): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

/**
 * Gets the display name for a contact, preferring display_name over name
 */
function getDisplayName(contact: ExtendedContact): string {
  return contact.display_name || contact.name || "Unknown Contact";
}

/**
 * Gets the primary email for display
 */
function getPrimaryEmail(contact: ExtendedContact): string | undefined {
  // Prefer allEmails array if available, otherwise fall back to email field
  if (contact.allEmails && contact.allEmails.length > 0) {
    return contact.allEmails[0];
  }
  return contact.email;
}

/**
 * Checks if a contact is external (message-derived, can be imported)
 * External contacts are those derived from message participants rather than explicitly imported
 */
function isExternalContact(contact: ExtendedContact): boolean {
  // is_message_derived can be number (1) or boolean (true)
  return contact.is_message_derived === 1 || contact.is_message_derived === true;
}

/**
 * Maps model ContactSource to SourcePill's ContactSource
 * Model: "manual" | "email" | "sms" | "contacts_app" | "inferred"
 * SourcePill: "imported" | "external" | "manual" | "contacts_app" | "sms"
 */
function mapToSourcePillSource(
  source: ModelContactSource | string | undefined,
  isMessageDerived: boolean
): SourcePillSource {
  // If message-derived, show as external regardless of source
  if (isMessageDerived) {
    return "external";
  }

  // Map model sources to SourcePill sources
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
 * ContactRoleRow Component
 *
 * Displays a contact with an associated role dropdown for role assignment.
 * Used in the "Assign Roles" step of both Edit Contacts and New Audit flows.
 *
 * @example
 * // Basic usage with role assignment
 * <ContactRoleRow
 *   contact={contact}
 *   currentRole={roles[contact.id] || ''}
 *   roleOptions={[
 *     { value: 'buyer', label: 'Buyer' },
 *     { value: 'seller', label: 'Seller' },
 *   ]}
 *   onRoleChange={(role) => setRole(contact.id, role)}
 * />
 */
export function ContactRoleRow({
  contact,
  currentRole,
  roleOptions,
  onRoleChange,
  onRemove,
  className = "",
}: ContactRoleRowProps): React.ReactElement {
  const displayName = getDisplayName(contact);
  const email = getPrimaryEmail(contact);
  const initial = getInitial(displayName);
  const isExternal = isExternalContact(contact);

  return (
    <div
      className={`flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg ${className}`.trim()}
      data-testid={`contact-role-row-${contact.id}`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0"
        data-testid="contact-role-row-avatar"
      >
        <span className="text-white text-sm font-bold">{initial}</span>
      </div>

      {/* Contact Info */}
      <div className="flex-1 min-w-0">
        <p
          className="font-medium text-gray-900 text-sm truncate"
          data-testid="contact-role-row-name"
        >
          {displayName}
        </p>
        {email && (
          <p
            className="text-xs text-gray-500 truncate"
            data-testid="contact-role-row-email"
          >
            {email}
          </p>
        )}
      </div>

      {/* Source Pill */}
      <div className="flex-shrink-0">
        <SourcePill
          source={mapToSourcePillSource(contact.source, isExternal)}
          size="sm"
        />
      </div>

      {/* Role Dropdown */}
      <select
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none min-w-[160px]"
        value={currentRole}
        onChange={(e) => onRoleChange(e.target.value)}
        aria-label={`Role for ${displayName}`}
        data-testid={`role-select-${contact.id}`}
      >
        <option value="">Select role...</option>
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Remove Button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
          aria-label={`Remove ${displayName} from transaction`}
          data-testid={`remove-contact-${contact.id}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ContactRoleRow;
