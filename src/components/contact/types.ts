import type {
  Contact,
  ContactSource,
  Transaction,
} from "../../../electron/types/models";

/**
 * Extended contact type with additional fields from Contacts app
 */
export interface ExtendedContact extends Contact {
  allEmails?: string[];
  allPhones?: string[];
}

/**
 * Transaction with roles field for blocking modal display
 */
export interface TransactionWithRoles extends Transaction {
  roles?: string;
}

/**
 * Contact form data for add/edit operations
 */
export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
}

/**
 * Source badge configuration
 */
export interface SourceBadge {
  text: string;
  color: string;
}

/**
 * Get source badge configuration for a contact source
 */
export function getSourceBadge(source: ContactSource): SourceBadge {
  const badges: Record<ContactSource, SourceBadge> = {
    manual: { text: "Manual", color: "bg-blue-100 text-blue-700" },
    email: { text: "From Email", color: "bg-green-100 text-green-700" },
    contacts_app: {
      text: "Contacts App",
      color: "bg-purple-100 text-purple-700",
    },
    sms: { text: "From SMS", color: "bg-orange-100 text-orange-700" },
    inferred: { text: "Inferred", color: "bg-gray-100 text-gray-700" },
  };
  return badges[source] || badges.manual;
}
