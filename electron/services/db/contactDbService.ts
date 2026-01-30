/**
 * Contact Database Service
 * Handles all contact-related database operations
 */

import crypto from "crypto";
import type { Contact, NewContact, ContactFilters } from "../../types";
import { DatabaseError } from "../../types";
import { dbGet, dbAll, dbRun, dbTransaction } from "./core/dbConnection";
import logService from "../logService";
import { validateFields } from "../../utils/sqlFieldWhitelist";
import { getContactNames } from "../contactsService";

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
  closing_deadline?: string | null;
  transaction_type?: string | null;
  status: string;
  roles: string;
}

// Message-derived contact (extracted from messages table participants JSON)
interface MessageDerivedContact {
  id: string;
  display_name: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  is_imported: number;
  is_message_derived: number;
  last_communication_at: string | null;
  communication_count: number; // BACKLOG-311: Pre-computed to avoid N+1 queries
}

/**
 * Get unique contacts derived from message participants (senders/recipients)
 * These are contacts who have sent/received messages but may not be explicitly imported.
 * Uses json_extract to parse the participants JSON field.
 */
export function getMessageDerivedContacts(userId: string): MessageDerivedContact[] {
  // Get emails of imported contacts to exclude (avoid duplicates)
  const importedEmailsSql = `
    SELECT LOWER(email) as email
    FROM contact_emails ce
    JOIN contacts c ON ce.contact_id = c.id
    WHERE c.user_id = ? AND c.is_imported = 1
  `;
  const importedEmailRows = dbAll<{ email: string }>(importedEmailsSql, [userId]);
  const importedEmails = new Set(importedEmailRows.map(r => r.email).filter(Boolean));

  // Get phones of imported contacts to exclude (avoid duplicates)
  const importedPhonesSql = `
    SELECT LOWER(phone_e164) as phone
    FROM contact_phones cp
    JOIN contacts c ON cp.contact_id = c.id
    WHERE c.user_id = ? AND c.is_imported = 1
  `;
  const importedPhoneRows = dbAll<{ phone: string }>(importedPhonesSql, [userId]);
  const importedPhones = new Set(importedPhoneRows.map(r => r.phone).filter(Boolean));

  // Also get display_names of imported contacts to exclude (for SMS contacts without proper phone numbers)
  const importedNamesSql = `
    SELECT LOWER(display_name) as name
    FROM contacts
    WHERE user_id = ? AND is_imported = 1
  `;
  const importedNameRows = dbAll<{ name: string }>(importedNamesSql, [userId]);
  const importedNames = new Set(importedNameRows.map(r => r.name).filter(Boolean));

  // Extract unique senders from messages (from field in participants JSON)
  // BACKLOG-313: Only include senders with actual display names (filter out raw emails/phones)
  // BACKLOG-311: Include COUNT(*) to avoid N+1 queries
  const sql = `
    SELECT
      'msg_' || LOWER(json_extract(participants, '$.from')) as id,
      json_extract(participants, '$.from') as display_name,
      json_extract(participants, '$.from') as name,
      CASE
        WHEN json_extract(participants, '$.from') LIKE '%@%'
        THEN LOWER(json_extract(participants, '$.from'))
        ELSE NULL
      END as email,
      CASE
        WHEN json_extract(participants, '$.from') NOT LIKE '%@%'
        THEN json_extract(participants, '$.from')
        ELSE NULL
      END as phone,
      NULL as company,
      'messages' as source,
      0 as is_imported,
      1 as is_message_derived,
      MAX(sent_at) as last_communication_at,
      COUNT(*) as communication_count
    FROM messages
    WHERE user_id = ?
      AND participants IS NOT NULL
      AND json_extract(participants, '$.from') IS NOT NULL
      AND json_extract(participants, '$.from') != ''
      AND json_extract(participants, '$.from') != 'me'
      -- BACKLOG-313: Filter out entries where "name" is raw phone/email (no display name)
      AND json_extract(participants, '$.from') NOT LIKE '%@%'
      AND json_extract(participants, '$.from') NOT LIKE '+%'
      AND json_extract(participants, '$.from') NOT GLOB '[0-9]*'
    GROUP BY LOWER(json_extract(participants, '$.from'))
    ORDER BY last_communication_at DESC
    LIMIT 200
  `;

  const results = dbAll<MessageDerivedContact>(sql, [userId]);

  // Filter out contacts whose email, phone, or name is already imported
  return results.filter(contact => {
    // Filter by email match
    if (contact.email && importedEmails.has(contact.email.toLowerCase())) {
      return false;
    }
    // Filter by phone match
    if (contact.phone && importedPhones.has(contact.phone.toLowerCase())) {
      return false;
    }
    // Filter by display name match (for SMS contacts like "*162")
    if (contact.display_name && importedNames.has(contact.display_name.toLowerCase())) {
      return false;
    }
    return true;
  });
}

/**
 * Normalize phone to E.164 format
 */
function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

/**
 * Create a new contact
 * Also stores phones and emails in their respective child tables if provided.
 * Supports both single phone/email and arrays (allPhones/allEmails) for complete data storage.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extendedData = contactData as any;

  // Store ALL phones in contact_phones table
  // Use allPhones array if available, otherwise fall back to single phone
  const allPhones: string[] = extendedData.allPhones || [];
  const singlePhone = extendedData.phone;

  // If no allPhones but we have a single phone, use that
  if (allPhones.length === 0 && singlePhone) {
    allPhones.push(singlePhone);
  }

  // Track stored phones to avoid duplicates
  const storedPhones = new Set<string>();
  let isFirstPhone = true;

  for (const phone of allPhones) {
    if (!phone) continue;

    const phoneE164 = normalizeToE164(phone);
    const normalizedKey = phoneE164.replace(/\D/g, '').slice(-10);

    // Skip if we've already stored this normalized phone
    if (storedPhones.has(normalizedKey)) continue;
    storedPhones.add(normalizedKey);

    const phoneId = crypto.randomUUID();
    const phoneSql = `
      INSERT OR IGNORE INTO contact_phones (
        id, contact_id, phone_e164, phone_display, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, ?, 'import', CURRENT_TIMESTAMP)
    `;
    dbRun(phoneSql, [phoneId, id, phoneE164, phone, isFirstPhone ? 1 : 0]);
    isFirstPhone = false;
  }

  if (storedPhones.size > 0) {
    logService.info(`[Contacts] Stored ${storedPhones.size} phone(s) for contact ${id}`, "Contacts");
  }

  // Store ALL emails in contact_emails table
  // Use allEmails array if available, otherwise fall back to single email
  const allEmails: string[] = extendedData.allEmails || [];
  const singleEmail = extendedData.email;

  // If no allEmails but we have a single email, use that
  if (allEmails.length === 0 && singleEmail) {
    allEmails.push(singleEmail);
  }

  // Track stored emails to avoid duplicates
  const storedEmails = new Set<string>();
  let isFirstEmail = true;

  for (const email of allEmails) {
    if (!email) continue;

    const normalizedEmail = email.toLowerCase().trim();

    // Skip if we've already stored this email
    if (storedEmails.has(normalizedEmail)) continue;
    storedEmails.add(normalizedEmail);

    const emailId = crypto.randomUUID();
    const emailSql = `
      INSERT OR IGNORE INTO contact_emails (
        id, contact_id, email, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, 'import', CURRENT_TIMESTAMP)
    `;
    dbRun(emailSql, [emailId, id, normalizedEmail, isFirstEmail ? 1 : 0]);
    isFirstEmail = false;
  }

  if (storedEmails.size > 0) {
    logService.info(`[Contacts] Stored ${storedEmails.size} email(s) for contact ${id}`, "Contacts");
  }

  const contact = await getContactById(id);
  if (!contact) {
    throw new DatabaseError("Failed to create contact");
  }
  return contact;
}

/**
 * Batch create contacts with transaction for performance
 * Used for bulk import operations (1000+ contacts)
 */
export function createContactsBatch(
  contacts: Array<{
    user_id: string;
    display_name: string;
    email?: string;
    phone?: string;
    company?: string;
    title?: string;
    source?: string;
    is_imported?: boolean;
    allPhones?: string[];
    allEmails?: string[];
  }>,
  onProgress?: (current: number, total: number) => void
): string[] {
  const createdIds: string[] = [];
  const total = contacts.length;

  // Wrap entire operation in a transaction for 10-100x speedup
  dbTransaction(() => {
    for (let i = 0; i < contacts.length; i++) {
      const contactData = contacts[i];
      const id = crypto.randomUUID();
      createdIds.push(id);

      // Insert contact
      dbRun(
        `INSERT INTO contacts (id, user_id, display_name, company, title, source, is_imported)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          contactData.user_id,
          contactData.display_name || "Unknown",
          contactData.company || null,
          contactData.title || null,
          contactData.source || "contacts_app",
          contactData.is_imported !== undefined ? (contactData.is_imported ? 1 : 0) : 1,
        ]
      );

      // Store phones
      const allPhones = contactData.allPhones || [];
      if (allPhones.length === 0 && contactData.phone) {
        allPhones.push(contactData.phone);
      }
      const storedPhones = new Set<string>();
      let isFirstPhone = true;
      for (const phone of allPhones) {
        if (!phone) continue;
        const phoneE164 = normalizeToE164(phone);
        const normalizedKey = phoneE164.replace(/\D/g, '').slice(-10);
        if (storedPhones.has(normalizedKey)) continue;
        storedPhones.add(normalizedKey);
        dbRun(
          `INSERT OR IGNORE INTO contact_phones (id, contact_id, phone_e164, phone_display, is_primary, source, created_at)
           VALUES (?, ?, ?, ?, ?, 'import', CURRENT_TIMESTAMP)`,
          [crypto.randomUUID(), id, phoneE164, phone, isFirstPhone ? 1 : 0]
        );
        isFirstPhone = false;
      }

      // Store emails
      const allEmails = contactData.allEmails || [];
      if (allEmails.length === 0 && contactData.email) {
        allEmails.push(contactData.email);
      }
      const storedEmails = new Set<string>();
      let isFirstEmail = true;
      for (const email of allEmails) {
        if (!email) continue;
        const normalizedEmail = email.toLowerCase().trim();
        if (storedEmails.has(normalizedEmail)) continue;
        storedEmails.add(normalizedEmail);
        dbRun(
          `INSERT OR IGNORE INTO contact_emails (id, contact_id, email, is_primary, source, created_at)
           VALUES (?, ?, ?, ?, 'import', CURRENT_TIMESTAMP)`,
          [crypto.randomUUID(), id, normalizedEmail, isFirstEmail ? 1 : 0]
        );
        isFirstEmail = false;
      }

      // Report progress every 50 contacts
      if (onProgress && (i + 1) % 50 === 0) {
        onProgress(i + 1, total);
      }
    }
  });

  // Final progress update
  if (onProgress) {
    onProgress(total, total);
  }

  return createdIds;
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
 * Find an imported contact by display name (case-insensitive)
 * Used to prevent duplicate imports of message-derived contacts
 */
export async function findContactByName(userId: string, name: string): Promise<Contact | null> {
  const sql = `
    SELECT * FROM contacts
    WHERE user_id = ?
      AND LOWER(display_name) = LOWER(?)
      AND is_imported = 1
    LIMIT 1
  `;
  logService.info("findContactByName query", "Contacts", {
    userId,
    searchName: name,
    searchNameLower: name.toLowerCase(),
  });
  const contact = dbGet<Contact>(sql, [userId, name]);
  if (contact) {
    logService.info("findContactByName found match", "Contacts", {
      foundId: contact.id,
      foundDisplayName: contact.display_name,
    });
  } else {
    // Debug: list first few contacts with similar names
    const debugSql = `SELECT id, display_name FROM contacts WHERE user_id = ? AND is_imported = 1 LIMIT 10`;
    const debugContacts = dbAll<{id: string, display_name: string}>(debugSql, [userId]);
    logService.info("findContactByName no match, existing contacts sample", "Contacts", {
      sampleContacts: debugContacts.map(c => c.display_name),
    });
  }
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
  // Get explicitly imported contacts from contacts table
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
      ) as phone,
      0 as is_message_derived
    FROM contacts c
    WHERE c.user_id = ? AND c.is_imported = 1
    ORDER BY c.display_name ASC
  `;
  const importedContacts = dbAll<Contact>(sql, [userId]);

  // Get message-derived contacts (unique senders from messages, excluding already-imported)
  const messageDerivedContacts = getMessageDerivedContacts(userId);

  // Merge both lists - imported contacts first, then message-derived
  // Cast message-derived to Contact type (they have compatible fields)
  const allContacts = [
    ...importedContacts,
    ...messageDerivedContacts.map(mc => ({
      id: mc.id,
      user_id: userId,
      display_name: mc.display_name,
      name: mc.name,
      email: mc.email,
      phone: mc.phone,
      company: mc.company,
      source: mc.source,
      is_imported: mc.is_imported,
      is_message_derived: mc.is_message_derived,
      last_communication_at: mc.last_communication_at,
    } as Contact)),
  ];

  // Sort alphabetically by display_name/name
  return allContacts.sort((a, b) => {
    const nameA = (a.display_name || a.name || '').toLowerCase();
    const nameB = (b.display_name || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
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
 * Backfill emails for a contact from external source (e.g., macOS Contacts)
 * Only adds emails that don't already exist in the junction table.
 */
export async function backfillContactEmails(contactId: string, emails: string[]): Promise<number> {
  if (!emails || emails.length === 0) return 0;

  let added = 0;
  const storedEmails = new Set<string>();

  // Get existing emails for this contact
  const existingSql = "SELECT LOWER(email) as email FROM contact_emails WHERE contact_id = ?";
  const existingRows = dbAll<{ email: string }>(existingSql, [contactId]);
  for (const row of existingRows) {
    storedEmails.add(row.email);
  }

  // Add any new emails
  for (const email of emails) {
    if (!email) continue;

    const normalizedEmail = email.toLowerCase().trim();
    if (storedEmails.has(normalizedEmail)) continue;
    storedEmails.add(normalizedEmail);

    const emailId = crypto.randomUUID();
    const isPrimary = existingRows.length === 0 && added === 0 ? 1 : 0;
    const emailSql = `
      INSERT OR IGNORE INTO contact_emails (
        id, contact_id, email, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, 'backfill', CURRENT_TIMESTAMP)
    `;
    dbRun(emailSql, [emailId, contactId, normalizedEmail, isPrimary]);
    added++;
  }

  if (added > 0) {
    logService.info(`[Contacts] Backfilled ${added} email(s) for contact ${contactId}`, "Contacts");
  }

  return added;
}

/**
 * Backfill phones for a contact from external source (e.g., macOS Contacts)
 * Only adds phones that don't already exist in the junction table.
 */
export async function backfillContactPhones(contactId: string, phones: string[]): Promise<number> {
  if (!phones || phones.length === 0) return 0;

  let added = 0;
  const storedPhones = new Set<string>();

  // Get existing phones for this contact (normalized to last 10 digits)
  const existingSql = "SELECT phone_e164 FROM contact_phones WHERE contact_id = ?";
  const existingRows = dbAll<{ phone_e164: string }>(existingSql, [contactId]);
  for (const row of existingRows) {
    const normalized = row.phone_e164.replace(/\D/g, '').slice(-10);
    storedPhones.add(normalized);
  }

  // Add any new phones
  for (const phone of phones) {
    if (!phone) continue;

    const phoneE164 = normalizeToE164(phone);
    const normalizedKey = phoneE164.replace(/\D/g, '').slice(-10);

    if (storedPhones.has(normalizedKey)) continue;
    storedPhones.add(normalizedKey);

    const phoneId = crypto.randomUUID();
    const isPrimary = existingRows.length === 0 && added === 0 ? 1 : 0;
    const phoneSql = `
      INSERT OR IGNORE INTO contact_phones (
        id, contact_id, phone_e164, phone_display, is_primary, source, created_at
      ) VALUES (?, ?, ?, ?, ?, 'backfill', CURRENT_TIMESTAMP)
    `;
    dbRun(phoneSql, [phoneId, contactId, phoneE164, phone, isPrimary]);
    added++;
  }

  if (added > 0) {
    logService.info(`[Contacts] Backfilled ${added} phone(s) for contact ${contactId}`, "Contacts");
  }

  return added;
}

/**
 * Get contacts sorted by recent communication and optionally by property address relevance
 * BACKLOG-506: JOINs to emails table for email content (sender, recipients, body)
 */
export async function getContactsSortedByActivity(
  userId: string,
  propertyAddress?: string,
): Promise<ContactWithActivity[]> {
  // Get imported contacts with activity data
  // BACKLOG-506: Join emails FIRST, then communications by email_id
  // TASK-1770: Also join messages (SMS/iMessage) via phone number to include text communications
  const sql = `
    SELECT
      c.*,
      c.display_name as name,
      ce_primary.email as email,
      cp_primary.phone_e164 as phone,
      MAX(m.sent_at) as last_communication_at,
      COUNT(DISTINCT comm.id) as communication_count,
      ${
        propertyAddress
          ? `
        SUM(CASE
          WHEN e.subject LIKE ? OR e.body_plain LIKE ? OR e.body_html LIKE ?
          THEN 1 ELSE 0
        END) as address_mention_count
      `
          : "0 as address_mention_count"
      },
      0 as is_message_derived
    FROM contacts c
    LEFT JOIN contact_emails ce_primary ON c.id = ce_primary.contact_id AND ce_primary.is_primary = 1
    LEFT JOIN contact_phones cp_primary ON c.id = cp_primary.contact_id AND cp_primary.is_primary = 1
    LEFT JOIN contact_emails ce_all ON c.id = ce_all.contact_id
    LEFT JOIN contact_phones cp_all ON c.id = cp_all.contact_id
    LEFT JOIN emails e ON (
      ce_all.email IS NOT NULL
      AND (
        LOWER(e.sender) = LOWER(ce_all.email)
        OR LOWER(e.recipients) LIKE '%' || LOWER(ce_all.email) || '%'
      )
      AND e.user_id = c.user_id
    )
    LEFT JOIN messages m ON (
      cp_all.phone_e164 IS NOT NULL
      AND (m.channel = 'sms' OR m.channel = 'imessage')
      AND (
        m.participants_flat LIKE '%' || cp_all.phone_e164 || '%'
        OR (cp_all.phone_display IS NOT NULL AND m.participants_flat LIKE '%' || cp_all.phone_display || '%')
      )
      AND m.user_id = c.user_id
    )
    LEFT JOIN communications comm ON (
      comm.email_id = e.id OR comm.message_id = m.id
    )
    WHERE c.user_id = ? AND c.is_imported = 1
    GROUP BY c.id
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
    const importedContacts = dbAll<ContactWithActivity>(sql, params);

    // Get message-derived contacts (already have communication_count from query)
    const messageDerivedContacts = getMessageDerivedContacts(userId);

    // BACKLOG-311: Map message-derived contacts to ContactWithActivity
    // No N+1 queries - communication_count is pre-computed, address_mention_count is 0
    // (address relevance sorting only meaningful for imported contacts with full email data)
    const messageDerivedWithActivity: ContactWithActivity[] = messageDerivedContacts.map(mc => ({
      id: mc.id,
      user_id: userId,
      display_name: mc.display_name,
      name: mc.name,
      email: mc.email,
      phone: mc.phone,
      company: mc.company,
      source: mc.source,
      is_imported: mc.is_imported,
      is_message_derived: mc.is_message_derived,
      last_communication_at: mc.last_communication_at,
      communication_count: mc.communication_count,
      address_mention_count: 0, // Skip for message-derived, sort by communication date instead
    } as ContactWithActivity));

    // Merge both lists
    const allContacts = [...importedContacts, ...messageDerivedWithActivity];

    // Sort by activity (address mentions first if propertyAddress provided, then by last communication)
    return allContacts.sort((a, b) => {
      // Property address relevance first
      if (propertyAddress) {
        const mentionA = a.address_mention_count || 0;
        const mentionB = b.address_mention_count || 0;
        if (mentionA !== mentionB) {
          return mentionB - mentionA; // Higher mentions first
        }
      }

      // Then by last communication date
      const dateA = a.last_communication_at ? new Date(a.last_communication_at).getTime() : 0;
      const dateB = b.last_communication_at ? new Date(b.last_communication_at).getTime() : 0;
      if (dateA !== dateB) {
        return dateB - dateA; // More recent first
      }

      // Finally by name
      const nameA = (a.display_name || a.name || '').toLowerCase();
      const nameB = (b.display_name || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
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
 * Look up contact by phone number.
 * Normalizes the phone number and searches across all contact phones.
 * Returns the contact with display_name if found.
 */
export async function getContactByPhone(
  phone: string
): Promise<{ id: string; display_name: string; phone: string } | null> {
  // Normalize phone to last 10 digits for matching
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length >= 10 ? digits.slice(-10) : digits;

  if (!normalized || normalized.length < 7) {
    return null;
  }

  const sql = `
    SELECT
      c.id,
      c.display_name,
      cp.phone_e164 as phone
    FROM contacts c
    JOIN contact_phones cp ON c.id = cp.contact_id
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', ''), ' ', ''), '(', '') LIKE ?
    LIMIT 1
  `;

  // Match on last 10 digits
  const pattern = `%${normalized}`;
  const result = dbGet<{ id: string; display_name: string; phone: string }>(sql, [pattern]);
  return result || null;
}

/**
 * Batch lookup contacts by multiple phone numbers.
 * Returns a map of normalized phone -> contact name.
 */
export async function getContactNamesByPhones(
  phones: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (phones.length === 0) return result;

  // Normalize all phones
  const normalizedPhones = phones.map(p => {
    const digits = p.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }).filter(p => p.length >= 7);

  if (normalizedPhones.length === 0) return result;

  // Build query with multiple OR conditions
  const conditions = normalizedPhones.map(() =>
    "REPLACE(REPLACE(REPLACE(REPLACE(cp.phone_e164, '+', ''), '-', ''), ' ', ''), '(', '') LIKE ?"
  ).join(' OR ');

  const sql = `
    SELECT
      c.display_name,
      cp.phone_e164 as phone
    FROM contacts c
    JOIN contact_phones cp ON c.id = cp.contact_id
    WHERE ${conditions}
  `;

  const params = normalizedPhones.map(p => `%${p}`);
  const rows = dbAll<{ display_name: string; phone: string }>(sql, params);

  // Map results back to original phone format
  for (const row of rows) {
    const rowDigits = row.phone.replace(/\D/g, '');
    const rowNormalized = rowDigits.slice(-10);

    // Find matching input phone
    for (let i = 0; i < phones.length; i++) {
      if (normalizedPhones[i] === rowNormalized) {
        result.set(phones[i], row.display_name);
      }
    }
    // Store by multiple normalized variants to handle different lookup formats
    // 1. Raw 10-digit (5551234567)
    result.set(rowNormalized, row.display_name);

    // For US numbers (10 digits), also store with country code variants
    if (rowNormalized.length === 10) {
      // 2. With +1 prefix (+15551234567) - E.164 format
      result.set(`+1${rowNormalized}`, row.display_name);
      // 3. With 1 prefix (15551234567) - 11-digit format
      result.set(`1${rowNormalized}`, row.display_name);
    }
  }

  // Fallback: Check macOS Contacts for any unresolved phones
  const unresolvedPhones = phones.filter(p => !result.has(p));
  if (unresolvedPhones.length > 0) {
    try {
      const macOSContacts = await getContactNames();
      const contactMap = macOSContacts.contactMap;

      for (const phone of unresolvedPhones) {
        // Try direct lookup
        if (contactMap[phone]) {
          result.set(phone, contactMap[phone]);
          continue;
        }

        // Try normalized lookup (last 10 digits)
        const digits = phone.replace(/\D/g, '');
        const normalized = digits.length >= 10 ? digits.slice(-10) : digits;

        // Search contactMap for matching phone
        for (const [key, name] of Object.entries(contactMap)) {
          const keyDigits = key.replace(/\D/g, '');
          const keyNormalized = keyDigits.length >= 10 ? keyDigits.slice(-10) : keyDigits;
          if (keyNormalized === normalized && keyNormalized.length >= 7) {
            result.set(phone, name);
            result.set(normalized, name);
            // Also store with country code variants for US numbers
            if (normalized.length === 10) {
              result.set(`+1${normalized}`, name);
              result.set(`1${normalized}`, name);
            }
            break;
          }
        }
      }
    } catch (err) {
      logService.warn("Failed to load macOS Contacts for fallback lookup", "Contacts", { err });
    }
  }

  return result;
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

  // Validate fields against whitelist before SQL construction
  validateFields("contacts", fields);

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
      closing_deadline?: string | null;
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
      closing_deadline,
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
    closing_deadline?: string | null;
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
        closing_deadline: txn.closing_deadline,
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
      t.closing_deadline,
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
    closing_deadline?: string | null;
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
        closing_deadline: txn.closing_deadline,
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
        t.closing_deadline,
        t.transaction_type,
        t.status
      FROM transactions t, json_each(t.other_contacts) j
      WHERE j.value = ?
    `;

    const jsonResults = dbAll<{
      id: string;
      property_address: string;
      closing_deadline?: string | null;
      transaction_type?: string | null;
      status: string;
    }>(jsonQuery, [contactId]);

    jsonResults.forEach((txn) => {
      if (!transactionMap.has(txn.id)) {
        transactionMap.set(txn.id, {
          id: txn.id,
          property_address: txn.property_address,
          closing_deadline: txn.closing_deadline,
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
      SELECT id, property_address, closing_deadline, transaction_type, status, other_contacts
      FROM transactions
      WHERE other_contacts LIKE ?
    `;

    const fallbackResults = dbAll<{
      id: string;
      property_address: string;
      closing_deadline?: string | null;
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
              closing_deadline: txn.closing_deadline,
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
      display_name: name || email.split("@")[0],
      email: email,
      source: "email",
      is_imported: true,
    });
  }

  return contact;
}

/**
 * Search contacts for selection modal (database-level search)
 * Searches both imported contacts and message-derived contacts.
 * Used when user types in search box - performs DB search instead of client-side filter.
 *
 * This fixes the LIMIT 200 issue where contacts beyond position 200 were unsearchable.
 * Search has no arbitrary LIMIT on the searchable pool - only limits result count.
 *
 * @param userId - User ID to search contacts for
 * @param query - Search query (min 2 characters for meaningful results)
 * @param limit - Maximum results to return (default 50)
 * @returns Contacts matching the search query, sorted by relevance
 */
export function searchContactsForSelection(
  userId: string,
  query: string,
  limit: number = 50
): ContactWithActivity[] {
  const searchPattern = `%${query}%`;

  // Get emails of imported contacts to exclude duplicates in message-derived results
  const importedEmailsSql = `
    SELECT LOWER(email) as email
    FROM contact_emails ce
    JOIN contacts c ON ce.contact_id = c.id
    WHERE c.user_id = ? AND c.is_imported = 1
  `;
  const importedEmailRows = dbAll<{ email: string }>(importedEmailsSql, [userId]);
  const importedEmails = new Set(importedEmailRows.map(r => r.email).filter(Boolean));

  // Search imported contacts
  // Searches across display_name, all emails, phone, and company
  // BACKLOG-506: Join emails FIRST, then communications by email_id
  const importedSql = `
    SELECT
      c.id,
      c.user_id,
      c.display_name,
      c.display_name as name,
      ce_primary.email as email,
      cp_primary.phone_e164 as phone,
      c.company,
      c.title,
      c.source,
      c.is_imported,
      0 as is_message_derived,
      MAX(e.sent_at) as last_communication_at,
      COUNT(DISTINCT comm.id) as communication_count,
      0 as address_mention_count
    FROM contacts c
    LEFT JOIN contact_emails ce_primary ON c.id = ce_primary.contact_id AND ce_primary.is_primary = 1
    LEFT JOIN contact_phones cp_primary ON c.id = cp_primary.contact_id AND cp_primary.is_primary = 1
    LEFT JOIN contact_emails ce_all ON c.id = ce_all.contact_id
    LEFT JOIN emails e ON (
      ce_all.email IS NOT NULL
      AND (
        LOWER(e.sender) = LOWER(ce_all.email)
        OR LOWER(e.recipients) LIKE '%' || LOWER(ce_all.email) || '%'
      )
      AND e.user_id = c.user_id
    )
    LEFT JOIN communications comm ON (
      comm.email_id = e.id
    )
    WHERE c.user_id = ? AND c.is_imported = 1
      AND (
        c.display_name LIKE ?
        OR ce_all.email LIKE ?
        OR cp_primary.phone_e164 LIKE ?
        OR c.company LIKE ?
      )
    GROUP BY c.id
    ORDER BY
      CASE WHEN c.display_name LIKE ? THEN 0 ELSE 1 END,
      last_communication_at DESC NULLS LAST
    LIMIT ?
  `;

  // Search message-derived contacts (no LIMIT 200 restriction when searching)
  // BACKLOG-313 filters still apply: exclude raw emails/phones as names
  const messageSql = `
    SELECT
      'msg_' || LOWER(json_extract(participants, '$.from')) as id,
      ? as user_id,
      json_extract(participants, '$.from') as display_name,
      json_extract(participants, '$.from') as name,
      CASE
        WHEN json_extract(participants, '$.from') LIKE '%@%'
        THEN LOWER(json_extract(participants, '$.from'))
        ELSE NULL
      END as email,
      CASE
        WHEN json_extract(participants, '$.from') NOT LIKE '%@%'
        THEN json_extract(participants, '$.from')
        ELSE NULL
      END as phone,
      NULL as company,
      NULL as title,
      'messages' as source,
      0 as is_imported,
      1 as is_message_derived,
      MAX(sent_at) as last_communication_at,
      COUNT(*) as communication_count,
      0 as address_mention_count
    FROM messages
    WHERE user_id = ?
      AND participants IS NOT NULL
      AND json_extract(participants, '$.from') IS NOT NULL
      AND json_extract(participants, '$.from') != ''
      AND json_extract(participants, '$.from') != 'me'
      -- BACKLOG-313: Filter out entries where "name" is raw phone/email (no display name)
      AND json_extract(participants, '$.from') NOT LIKE '%@%'
      AND json_extract(participants, '$.from') NOT LIKE '+%'
      AND json_extract(participants, '$.from') NOT GLOB '[0-9]*'
      -- Search filter
      AND json_extract(participants, '$.from') LIKE ?
    GROUP BY LOWER(json_extract(participants, '$.from'))
    ORDER BY last_communication_at DESC
    LIMIT ?
  `;

  try {
    // Execute imported contacts search
    const importedResults = dbAll<ContactWithActivity>(importedSql, [
      userId,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern, // For ORDER BY CASE
      limit,
    ]);

    // Execute message-derived contacts search
    const messageResults = dbAll<ContactWithActivity>(messageSql, [
      userId, // For user_id column
      userId, // For WHERE clause
      searchPattern,
      limit,
    ]);

    // Filter out message-derived contacts whose email is already imported
    const filteredMessageResults = messageResults.filter(contact => {
      if (contact.email) {
        return !importedEmails.has(contact.email.toLowerCase());
      }
      return true;
    });

    // Merge results: imported first, then message-derived
    const allResults = [...importedResults, ...filteredMessageResults];

    // Sort by name match first, then by communication date
    allResults.sort((a, b) => {
      // Prioritize exact name prefix match
      const aNameMatch = (a.display_name || a.name || '').toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1;
      const bNameMatch = (b.display_name || b.name || '').toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1;
      if (aNameMatch !== bNameMatch) {
        return aNameMatch - bNameMatch;
      }

      // Then by last communication date
      const dateA = a.last_communication_at ? new Date(a.last_communication_at).getTime() : 0;
      const dateB = b.last_communication_at ? new Date(b.last_communication_at).getTime() : 0;
      return dateB - dateA;
    });

    // Return up to limit results
    return allResults.slice(0, limit);
  } catch (error) {
    logService.error("Error searching contacts for selection", "ContactDbService", {
      error: (error as Error).message,
      userId,
      query,
    });
    throw error;
  }
}

// Export types for consumers
export type { ContactWithActivity, TransactionWithRoles };
