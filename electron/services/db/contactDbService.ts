/**
 * Contact Database Service
 * Handles all contact-related database operations
 */

import crypto from "crypto";
import type { Contact, NewContact, ContactFilters } from "../../types";
import { DatabaseError } from "../../types";
import { dbGet, dbAll, dbRun } from "./core/dbConnection";
import logService from "../logService";

// Contact with activity metadata
interface ContactWithActivity extends Contact {
  last_communication_at?: string | null;
  communication_count?: number;
  address_mention_count?: number;
}

// Transaction with roles for contact
interface TransactionWithRoles {
  id: string;
  property_address: string;
  closing_date?: string | null;
  transaction_type?: string | null;
  status: string;
  roles: string;
}

/**
 * Create a new contact
 */
export async function createContact(contactData: NewContact): Promise<Contact> {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO contacts (
      id, user_id, display_name, company, title, source, is_imported
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    contactData.user_id,
    contactData.display_name || "Unknown",
    contactData.company || null,
    contactData.title || null,
    contactData.source || "manual",
    contactData.is_imported !== undefined
      ? contactData.is_imported
        ? 1
        : 0
      : 1,
  ];

  dbRun(sql, params);
  const contact = await getContactById(id);
  if (!contact) {
    throw new DatabaseError("Failed to create contact");
  }
  return contact;
}

/**
 * Get contact by ID
 */
export async function getContactById(contactId: string): Promise<Contact | null> {
  const sql = "SELECT * FROM contacts WHERE id = ?";
  const contact = dbGet<Contact>(sql, [contactId]);
  return contact || null;
}

/**
 * Get all contacts for a user
 */
export async function getContacts(filters?: ContactFilters): Promise<Contact[]> {
  let sql = "SELECT * FROM contacts WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.user_id) {
    sql += " AND user_id = ?";
    params.push(filters.user_id);
  }

  if (filters?.source) {
    sql += " AND source = ?";
    params.push(filters.source);
  }

  if (filters?.is_imported !== undefined) {
    sql += " AND is_imported = ?";
    params.push(filters.is_imported ? 1 : 0);
  }

  sql += " ORDER BY display_name ASC";

  return dbAll<Contact>(sql, params);
}

/**
 * Get only imported contacts for a user
 * Returns contacts with display_name aliased as 'name' for backwards compatibility
 * Also includes primary email and phone from child tables
 */
export async function getImportedContactsByUserId(
  userId: string,
): Promise<Contact[]> {
  const sql = `
    SELECT
      c.*,
      c.display_name as name,
      COALESCE(
        (SELECT email FROM contact_emails WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT email FROM contact_emails WHERE contact_id = c.id LIMIT 1)
      ) as email,
      COALESCE(
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id LIMIT 1)
      ) as phone
    FROM contacts c
    WHERE c.user_id = ? AND c.is_imported = 1
    ORDER BY c.display_name ASC
  `;
  return dbAll<Contact>(sql, [userId]);
}

/**
 * Get unimported contacts for a user (available to import)
 * These are contacts synced from iPhone that haven't been imported yet
 */
export async function getUnimportedContactsByUserId(
  userId: string,
): Promise<Contact[]> {
  const sql = `
    SELECT
      c.*,
      c.display_name as name,
      COALESCE(
        (SELECT email FROM contact_emails WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT email FROM contact_emails WHERE contact_id = c.id LIMIT 1)
      ) as email,
      COALESCE(
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id LIMIT 1)
      ) as phone
    FROM contacts c
    WHERE c.user_id = ? AND c.is_imported = 0
    ORDER BY c.display_name ASC
  `;
  return dbAll<Contact>(sql, [userId]);
}

/**
 * Mark a contact as imported (change is_imported from 0 to 1)
 */
export async function markContactAsImported(contactId: string): Promise<void> {
  const sql =
    "UPDATE contacts SET is_imported = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  dbRun(sql, [contactId]);
}

/**
 * Get contacts sorted by recent communication and optionally by property address relevance
 */
export async function getContactsSortedByActivity(
  userId: string,
  propertyAddress?: string,
): Promise<ContactWithActivity[]> {
  const sql = `
    SELECT
      c.*,
      c.display_name as name,
      ce_primary.email as email,
      cp_primary.phone_e164 as phone,
      MAX(comm.sent_at) as last_communication_at,
      COUNT(DISTINCT comm.id) as communication_count,
      ${
        propertyAddress
          ? `
        SUM(CASE
          WHEN comm.subject LIKE ? OR comm.body_plain LIKE ? OR comm.body LIKE ?
          THEN 1 ELSE 0
        END) as address_mention_count
      `
          : "0 as address_mention_count"
      }
    FROM contacts c
    LEFT JOIN contact_emails ce_primary ON c.id = ce_primary.contact_id AND ce_primary.is_primary = 1
    LEFT JOIN contact_phones cp_primary ON c.id = cp_primary.contact_id AND cp_primary.is_primary = 1
    LEFT JOIN contact_emails ce_all ON c.id = ce_all.contact_id
    LEFT JOIN communications comm ON (
      ce_all.email IS NOT NULL
      AND (comm.sender = ce_all.email OR comm.recipients LIKE '%' || ce_all.email || '%')
      AND comm.user_id = c.user_id
    )
    WHERE c.user_id = ? AND c.is_imported = 1
    GROUP BY c.id
    ORDER BY
      ${propertyAddress ? "address_mention_count DESC," : ""}
      CASE WHEN last_communication_at IS NULL THEN 1 ELSE 0 END,
      last_communication_at DESC,
      c.display_name ASC
  `;

  const params = propertyAddress
    ? [
        `%${propertyAddress}%`,
        `%${propertyAddress}%`,
        `%${propertyAddress}%`,
        userId,
      ]
    : [userId];

  try {
    return dbAll<ContactWithActivity>(sql, params);
  } catch (error) {
    logService.error("Error getting sorted contacts", "ContactDbService", {
      error: (error as Error).message,
      sql,
      params,
    });
    throw error;
  }
}

/**
 * Search contacts by name or email
 */
export async function searchContacts(
  query: string,
  userId: string,
): Promise<Contact[]> {
  const sql = `
    SELECT * FROM contacts
    WHERE user_id = ? AND (display_name LIKE ? OR display_name LIKE ?)
    ORDER BY display_name ASC
  `;
  const searchPattern = `%${query}%`;
  return dbAll<Contact>(sql, [userId, searchPattern, searchPattern]);
}

/**
 * Update contact information
 */
export async function updateContact(
  contactId: string,
  updates: Partial<Contact>,
): Promise<void> {
  const allowedFields = ["display_name", "company", "title"];
  const fields: string[] = [];
  const values: unknown[] = [];

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push((updates as Record<string, unknown>)[key]);
    }
  });

  if (fields.length === 0) {
    throw new DatabaseError("No valid fields to update");
  }

  values.push(contactId);
  const sql = `UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`;
  dbRun(sql, values);
}

/**
 * Get all transactions associated with a contact
 */
export async function getTransactionsByContact(
  contactId: string,
): Promise<TransactionWithRoles[]> {
  const transactionMap = new Map<
    string,
    {
      id: string;
      property_address: string;
      closing_date?: string | null;
      transaction_type?: string | null;
      status: string;
      roles: string[];
    }
  >();

  // 1. Check direct FK references
  const directQuery = `
    SELECT DISTINCT
      id,
      property_address,
      closing_date,
      transaction_type,
      status,
      CASE
        WHEN buyer_agent_id = ? THEN 'Buyer Agent'
        WHEN seller_agent_id = ? THEN 'Seller Agent'
        WHEN escrow_officer_id = ? THEN 'Escrow Officer'
        WHEN inspector_id = ? THEN 'Inspector'
      END as role
    FROM transactions
    WHERE buyer_agent_id = ?
       OR seller_agent_id = ?
       OR escrow_officer_id = ?
       OR inspector_id = ?
  `;

  const directResults = dbAll<{
    id: string;
    property_address: string;
    closing_date?: string | null;
    transaction_type?: string | null;
    status: string;
    role: string;
  }>(directQuery, [
    contactId,
    contactId,
    contactId,
    contactId,
    contactId,
    contactId,
    contactId,
    contactId,
  ]);

  directResults.forEach((txn) => {
    if (!transactionMap.has(txn.id)) {
      transactionMap.set(txn.id, {
        id: txn.id,
        property_address: txn.property_address,
        closing_date: txn.closing_date,
        transaction_type: txn.transaction_type,
        status: txn.status,
        roles: [txn.role],
      });
    } else {
      transactionMap.get(txn.id)?.roles.push(txn.role);
    }
  });

  // 2. Check junction table (transaction_contacts)
  const junctionQuery = `
    SELECT DISTINCT
      t.id,
      t.property_address,
      t.closing_date,
      t.transaction_type,
      t.status,
      tc.specific_role,
      tc.role_category
    FROM transaction_contacts tc
    JOIN transactions t ON tc.transaction_id = t.id
    WHERE tc.contact_id = ?
  `;

  const junctionResults = dbAll<{
    id: string;
    property_address: string;
    closing_date?: string | null;
    transaction_type?: string | null;
    status: string;
    specific_role?: string;
    role_category?: string;
  }>(junctionQuery, [contactId]);

  junctionResults.forEach((txn) => {
    const role = txn.specific_role || txn.role_category || "Associated Contact";
    if (!transactionMap.has(txn.id)) {
      transactionMap.set(txn.id, {
        id: txn.id,
        property_address: txn.property_address,
        closing_date: txn.closing_date,
        transaction_type: txn.transaction_type,
        status: txn.status,
        roles: [role],
      });
    } else {
      transactionMap.get(txn.id)?.roles.push(role);
    }
  });

  // 3. Check JSON array (other_contacts)
  try {
    const jsonQuery = `
      SELECT DISTINCT
        t.id,
        t.property_address,
        t.closing_date,
        t.transaction_type,
        t.status
      FROM transactions t, json_each(t.other_contacts) j
      WHERE j.value = ?
    `;

    const jsonResults = dbAll<{
      id: string;
      property_address: string;
      closing_date?: string | null;
      transaction_type?: string | null;
      status: string;
    }>(jsonQuery, [contactId]);

    jsonResults.forEach((txn) => {
      if (!transactionMap.has(txn.id)) {
        transactionMap.set(txn.id, {
          id: txn.id,
          property_address: txn.property_address,
          closing_date: txn.closing_date,
          transaction_type: txn.transaction_type,
          status: txn.status,
          roles: ["Other Contact"],
        });
      } else {
        transactionMap.get(txn.id)?.roles.push("Other Contact");
      }
    });
  } catch (error) {
    logService.warn(
      "json_each not supported, using LIKE fallback",
      "ContactDbService",
      { error: (error as Error).message },
    );
    // Fallback implementation using LIKE
    const fallbackQuery = `
      SELECT id, property_address, closing_date, transaction_type, status, other_contacts
      FROM transactions
      WHERE other_contacts LIKE ?
    `;

    const fallbackResults = dbAll<{
      id: string;
      property_address: string;
      closing_date?: string | null;
      transaction_type?: string | null;
      status: string;
      other_contacts?: string;
    }>(fallbackQuery, [`%"${contactId}"%`]);

    fallbackResults.forEach((txn) => {
      try {
        const contacts = JSON.parse(txn.other_contacts || "[]");
        if (contacts.includes(contactId)) {
          if (!transactionMap.has(txn.id)) {
            transactionMap.set(txn.id, {
              id: txn.id,
              property_address: txn.property_address,
              closing_date: txn.closing_date,
              transaction_type: txn.transaction_type,
              status: txn.status,
              roles: ["Other Contact"],
            });
          } else {
            transactionMap.get(txn.id)?.roles.push("Other Contact");
          }
        }
      } catch (parseError) {
        logService.error(
          "Error parsing other_contacts JSON",
          "ContactDbService",
          { error: (parseError as Error).message },
        );
      }
    });
  }

  // Convert map to array and format roles
  return Array.from(transactionMap.values()).map((txn) => ({
    ...txn,
    roles: [...new Set(txn.roles)].join(", "),
  }));
}

/**
 * Delete a contact
 */
export async function deleteContact(contactId: string): Promise<void> {
  const sql = "DELETE FROM contacts WHERE id = ?";
  dbRun(sql, [contactId]);
}

/**
 * Remove a contact from local database (un-import)
 */
export async function removeContact(contactId: string): Promise<void> {
  const sql = "UPDATE contacts SET is_imported = 0 WHERE id = ?";
  dbRun(sql, [contactId]);
}

/**
 * Get or create contact from email address
 */
export async function getOrCreateContactFromEmail(
  userId: string,
  email: string,
  name?: string,
): Promise<Contact> {
  // Try to find existing contact
  let contact = dbGet<Contact>(
    "SELECT * FROM contacts WHERE user_id = ? AND email = ?",
    [userId, email],
  );

  if (!contact) {
    // Create new contact
    contact = await createContact({
      user_id: userId,
      name: name || email.split("@")[0],
      email: email,
      source: "email",
      is_imported: true,
    });
  }

  return contact;
}

// Export types for consumers
export type { ContactWithActivity, TransactionWithRoles };
