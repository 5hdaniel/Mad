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
  /** Callback when contact info area is clicked (for viewing details) */
  onClick?: () => void;
  /** Whether this row has a validation error (missing role) */
  hasError?: boolean;
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
 * Model: "manual" | "email" | "sms" | "messages" | "contacts_app" | "inferred"
 * SourcePill: "imported" | "external" | "manual" | "contacts_app" | "sms" | "messages"
 */
function mapToSourcePillSource(
  source: ModelContactSource | string | undefined,
  isExternal: boolean
): SourcePillSource {
  // sms/messages source takes priority - always show "Message" pill
  if (source === "sms" || source === "messages") {
    return source;
  }

  // External contacts (from Contacts App, not yet imported) show "Contacts App" pill
  if (isExternal) {
    return "external";
  }

  // Imported contacts - check source for specific display
  switch (source) {
    case "manual":
      return "manual";
    case "contacts_app":
      return "contacts_app";
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
  onClick,
  hasError = false,
  className = "",
}: ContactRoleRowProps): React.ReactElement {
  const displayName = getDisplayName(contact);
  const email = getPrimaryEmail(contact);
  const initial = getInitial(displayName);
  const isExternal = isExternalContact(contact);

  const borderClass = hasError
    ? "border-red-400 bg-red-50 ring-2 ring-red-200"
    : "border-gray-200 bg-white";

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${borderClass} ${className}`.trim()}
      data-testid={`contact-role-row-${contact.id}`}
    >
      {/* Avatar + Contact Info - clickable area for viewing details */}
      <div
        className={`flex items-center gap-3 flex-1 min-w-0${onClick ? " cursor-pointer hover:bg-gray-50 rounded-lg -m-1 p-1 transition-colors" : ""}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
        data-testid="contact-role-row-info"
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0"
          data-testid="contact-role-row-avatar"
        >
          <span className="text-white text-sm font-bold">{initial}</span>
        </div>

        {/* Contact Info with Source Pill */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`font-medium text-gray-900 text-sm${onClick ? " hover:text-purple-700" : ""}`}
              data-testid="contact-role-row-name"
            >
              {displayName}
            </p>
            <SourcePill
              source={mapToSourcePillSource(contact.source, isExternal)}
              size="sm"
            />
          </div>
          {email && (
            <p
              className="text-xs text-gray-500 truncate"
              data-testid="contact-role-row-email"
            >
              {email}
            </p>
          )}
        </div>
      </div>

      {/* Role Dropdown and Remove Button - wrap together on small screens */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <select
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none min-w-[140px]"
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
    </div>
  );
}

export default ContactRoleRow;
