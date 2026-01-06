/**
 * Transaction-Contact Database Service
 * Handles junction table operations between transactions and contacts
 */

import crypto from "crypto";
import type { Contact } from "../../types";
import { DatabaseError } from "../../types";
import { dbGet, dbAll, dbRun, ensureDb } from "./core/dbConnection";
import { validateFields } from "../../utils/sqlFieldWhitelist";

// Transaction contact association data
export interface TransactionContactData {
  contact_id: string;
  role?: string;
  role_category?: string;
  specific_role?: string;
  is_primary?: number | boolean;
  notes?: string;
}

// Transaction contact result with contact info
export interface TransactionContactResult extends TransactionContactData {
  id: string;
  transaction_id: string;
  created_at: string;
  updated_at: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  contact_title?: string;
}

/**
 * Contact assignment operation for batch updates
 */
export interface ContactAssignmentOperation {
  action: "add" | "remove";
  contactId: string;
  role?: string;
  roleCategory?: string;
  specificRole?: string;
  isPrimary?: boolean;
  notes?: string;
}

/**
 * Assign contact to transaction with role (simple version)
 */
export async function linkContactToTransaction(
  transactionId: string,
  contactId: string,
  role?: string,
): Promise<void> {
  const id = crypto.randomUUID();

  const sql = `
    INSERT INTO transaction_contacts (
      id, transaction_id, contact_id, role, role_category, specific_role, is_primary, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    transactionId,
    contactId,
    role || null,
    null,
    role || null,
    0,
    null,
  ];

  dbRun(sql, params);
}

/**
 * Assign contact to transaction with detailed role data
 * Uses INSERT OR REPLACE to handle duplicate assignments gracefully
 */
export async function assignContactToTransaction(
  transactionId: string,
  data: TransactionContactData,
): Promise<string> {
  // First check if this contact is already assigned to this transaction
  const existingCheck = `
    SELECT id FROM transaction_contacts
    WHERE transaction_id = ? AND contact_id = ?
  `;
  const existing = dbGet<{ id: string }>(existingCheck, [
    transactionId,
    data.contact_id,
  ]);

  if (existing) {
    // Update the existing assignment instead of inserting
    const updateSql = `
      UPDATE transaction_contacts
      SET role = ?, role_category = ?, specific_role = ?, is_primary = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    dbRun(updateSql, [
      data.role || null,
      data.role_category || null,
      data.specific_role || null,
      data.is_primary ? 1 : 0,
      data.notes || null,
      existing.id,
    ]);
    return existing.id;
  }

  // Insert new assignment
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO transaction_contacts (
      id, transaction_id, contact_id, role, role_category, specific_role, is_primary, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    transactionId,
    data.contact_id,
    data.role || null,
    data.role_category || null,
    data.specific_role || null,
    data.is_primary ? 1 : 0,
    data.notes || null,
  ];

  dbRun(sql, params);
  return id;
}

/**
 * Get all contacts assigned to a transaction
 */
export async function getTransactionContacts(
  transactionId: string,
): Promise<Contact[]> {
  const sql = `
    SELECT
      c.*
    FROM transaction_contacts tc
    LEFT JOIN contacts c ON tc.contact_id = c.id
    WHERE tc.transaction_id = ?
    ORDER BY tc.is_primary DESC, tc.created_at ASC
  `;

  return dbAll<Contact>(sql, [transactionId]);
}

/**
 * Get all contacts assigned to a transaction with role details
 */
export async function getTransactionContactsWithRoles(
  transactionId: string,
): Promise<TransactionContactResult[]> {
  const sql = `
    SELECT
      tc.*,
      c.display_name as contact_name,
      COALESCE(
        (SELECT email FROM contact_emails WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT email FROM contact_emails WHERE contact_id = c.id LIMIT 1)
      ) as contact_email,
      COALESCE(
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id LIMIT 1)
      ) as contact_phone,
      c.company as contact_company,
      c.title as contact_title
    FROM transaction_contacts tc
    LEFT JOIN contacts c ON tc.contact_id = c.id
    WHERE tc.transaction_id = ?
    ORDER BY tc.is_primary DESC, tc.created_at ASC
  `;

  return dbAll<TransactionContactResult>(sql, [transactionId]);
}

/**
 * Get all contacts for a specific role in a transaction
 */
export async function getTransactionContactsByRole(
  transactionId: string,
  role: string,
): Promise<TransactionContactResult[]> {
  const sql = `
    SELECT
      tc.*,
      c.display_name as contact_name,
      COALESCE(
        (SELECT email FROM contact_emails WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT email FROM contact_emails WHERE contact_id = c.id LIMIT 1)
      ) as contact_email,
      COALESCE(
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id AND is_primary = 1 LIMIT 1),
        (SELECT phone_e164 FROM contact_phones WHERE contact_id = c.id LIMIT 1)
      ) as contact_phone,
      c.company as contact_company,
      c.title as contact_title
    FROM transaction_contacts tc
    LEFT JOIN contacts c ON tc.contact_id = c.id
    WHERE tc.transaction_id = ? AND tc.specific_role = ?
    ORDER BY tc.is_primary DESC
  `;

  return dbAll<TransactionContactResult>(sql, [transactionId, role]);
}

/**
 * Update contact role information
 */
export async function updateContactRole(
  transactionId: string,
  contactId: string,
  updates: Partial<TransactionContactData>,
): Promise<void> {
  const allowedFields = [
    "role",
    "role_category",
    "specific_role",
    "is_primary",
    "notes",
  ];
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

  // Validate fields against whitelist before SQL construction
  validateFields("transaction_contacts", fields);

  values.push(transactionId, contactId);

  const sql = `
    UPDATE transaction_contacts
    SET ${fields.join(", ")}
    WHERE transaction_id = ? AND contact_id = ?
  `;

  dbRun(sql, values);
}

/**
 * Remove contact from transaction
 */
export async function unlinkContactFromTransaction(
  transactionId: string,
  contactId: string,
): Promise<void> {
  const sql =
    "DELETE FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ?";
  dbRun(sql, [transactionId, contactId]);
}

/**
 * Check if contact is assigned to transaction
 */
export async function isContactAssignedToTransaction(
  transactionId: string,
  contactId: string,
): Promise<boolean> {
  const sql =
    "SELECT id FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ? LIMIT 1";
  const result = dbGet(sql, [transactionId, contactId]);
  return !!result;
}

/**
 * Batch update contact assignments for a transaction
 * Executes all add/remove operations in a single SQLite transaction for atomicity
 */
export async function batchUpdateContactAssignments(
  transactionId: string,
  operations: ContactAssignmentOperation[],
): Promise<void> {
  if (operations.length === 0) {
    return;
  }

  const db = ensureDb();

  const batchOperation = db.transaction(() => {
    for (const op of operations) {
      if (op.action === "remove") {
        const deleteSql =
          "DELETE FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ?";
        db.prepare(deleteSql).run(transactionId, op.contactId);
      } else if (op.action === "add") {
        // Check if already exists
        const existingCheck =
          "SELECT id FROM transaction_contacts WHERE transaction_id = ? AND contact_id = ?";
        const existing = db
          .prepare(existingCheck)
          .get(transactionId, op.contactId) as { id: string } | undefined;

        if (existing) {
          // Update existing assignment
          const updateSql = `
            UPDATE transaction_contacts
            SET role = ?, role_category = ?, specific_role = ?, is_primary = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;
          db.prepare(updateSql).run(
            op.role || null,
            op.roleCategory || null,
            op.specificRole || null,
            op.isPrimary ? 1 : 0,
            op.notes || null,
            existing.id,
          );
        } else {
          // Insert new assignment
          const id = crypto.randomUUID();
          const insertSql = `
            INSERT INTO transaction_contacts (
              id, transaction_id, contact_id, role, role_category, specific_role, is_primary, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          db.prepare(insertSql).run(
            id,
            transactionId,
            op.contactId,
            op.role || null,
            op.roleCategory || null,
            op.specificRole || null,
            op.isPrimary ? 1 : 0,
            op.notes || null,
          );
        }
      }
    }
  });

  // Execute the transaction - will rollback on any error
  batchOperation();
}
