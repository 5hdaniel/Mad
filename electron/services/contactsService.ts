/**
 * Contacts Service
 * Handles loading and resolving contacts from macOS Contacts database
 */

import path from 'path';
import fs from 'fs/promises';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { exec } from 'child_process';

const { normalizePhoneNumber, formatPhoneNumber } = require('../utils/phoneUtils');
const { MIN_CONTACT_RECORD_COUNT, CONTACTS_BASE_DIR, DEFAULT_CONTACTS_DB } = require('../constants');

// ============================================
// TYPES
// ============================================

interface ContactMap {
  [key: string]: string; // Maps phone/email to contact name
}

interface ContactInfo {
  name: string;
  phones: string[];
  emails: string[];
}

interface PhoneToContactInfo {
  [key: string]: ContactInfo; // Maps phone to full contact info
}

interface LoadStatus {
  success: boolean;
  contactCount: number;
  source?: string;
  error?: string;
  lastError?: string;
  attemptedPaths?: string[];
  userMessage?: string;
  action?: string;
}

interface ContactNamesResult {
  contactMap: ContactMap;
  phoneToContactInfo: PhoneToContactInfo;
  status: LoadStatus;
}

interface DatabaseRow {
  person_id: number;
  first_name?: string;
  last_name?: string;
  organization?: string;
}

interface PhoneRow {
  person_id: number;
  phone: string;
}

interface EmailRow {
  person_id: number;
  email: string;
}

interface PersonInfo {
  name: string;
  phones: string[];
  emails: string[];
}

interface PersonMap {
  [personId: number]: PersonInfo;
}

/**
 * Get contact names from macOS Contacts database
 * Searches for all .abcddb files and uses the one with most records
 */
async function getContactNames(): Promise<ContactNamesResult> {
  const contactMap: ContactMap = {};
  const phoneToContactInfo: PhoneToContactInfo = {};
  let lastError: Error | null = null;
  const attemptedPaths: string[] = [];

  try {
    const baseDir = path.join(process.env.HOME as string, CONTACTS_BASE_DIR);

    // Use exec to find all .abcddb files
    const execPromise = promisify(exec);

    try {
      const { stdout } = await execPromise(`find "${baseDir}" -name "*.abcddb" 2>/dev/null`);
      const dbFiles = stdout.trim().split('\n').filter((f) => f);

      if (dbFiles.length === 0) {
        console.warn('[ContactsService] No .abcddb files found in', baseDir);
        lastError = new Error('No contacts database files found');
      }

      // Try each database and count records
      for (const dbPath of dbFiles) {
        attemptedPaths.push(dbPath);
        try {
          const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
          const dbAll = promisify(db.all.bind(db)) as (sql: string) => Promise<any[]>;
          const dbClose = promisify(db.close.bind(db));

          const recordCount = await dbAll(
            `SELECT COUNT(*) as count FROM ZABCDRECORD WHERE Z_ENT IS NOT NULL;`
          );
          await dbClose();

          // If this database has sufficient records, use it
          if (recordCount[0].count > MIN_CONTACT_RECORD_COUNT) {
            console.log(`[ContactsService] Successfully loaded contacts from ${dbPath}`);
            const result = await loadContactsFromDatabase(dbPath);
            const contactCount = Object.keys(result.contactMap).length;
            return {
              ...result,
              status: {
                success: true,
                contactCount,
                source: dbPath,
              },
            };
          } else {
            console.warn(
              `[ContactsService] Database ${dbPath} has insufficient records (${recordCount[0].count})`
            );
          }
        } catch (err) {
          console.error(`[ContactsService] Failed to read database ${dbPath}:`, (err as Error).message);
          lastError = err as Error;
        }
      }
    } catch (err) {
      console.error('[ContactsService] Error finding database files:', (err as Error).message);
      lastError = err as Error;
    }

    // Fallback to default path
    const defaultPath = path.join(process.env.HOME as string, DEFAULT_CONTACTS_DB);
    attemptedPaths.push(defaultPath);
    console.log('[ContactsService] Attempting fallback to default path:', defaultPath);
    const result = await loadContactsFromDatabase(defaultPath);
    const contactCount = Object.keys(result.contactMap).length;

    if (contactCount > 0) {
      console.log(`[ContactsService] Successfully loaded ${contactCount} contacts from fallback path`);
      return {
        ...result,
        status: {
          success: true,
          contactCount,
          source: defaultPath,
        },
      };
    } else {
      throw new Error('No contacts could be loaded from any database');
    }
  } catch (error) {
    console.error('[ContactsService] Error accessing contacts database:', error);
    return {
      contactMap,
      phoneToContactInfo,
      status: {
        success: false,
        contactCount: 0,
        error: (error as Error).message,
        lastError: lastError?.message,
        attemptedPaths,
        userMessage: 'Could not load contacts from Contacts app',
        action: 'Grant Full Disk Access in System Settings > Privacy & Security > Full Disk Access',
      },
    };
  }
}

/**
 * Load contacts from a specific database file
 */
async function loadContactsFromDatabase(
  contactsDbPath: string
): Promise<{ contactMap: ContactMap; phoneToContactInfo: PhoneToContactInfo }> {
  const contactMap: ContactMap = {};
  const phoneToContactInfo: PhoneToContactInfo = {};

  try {
    await fs.access(contactsDbPath);
  } catch (error) {
    console.error(
      `[ContactsService] Cannot access database at ${contactsDbPath}:`,
      (error as Error).message
    );
    return { contactMap, phoneToContactInfo };
  }

  try {
    const db = new sqlite3.Database(contactsDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db)) as (sql: string) => Promise<any[]>;
    const dbClose = promisify(db.close.bind(db));

    // Query to get contacts with both phone numbers and emails
    const contactsResult: DatabaseRow[] = await dbAll(`
      SELECT
        ZABCDRECORD.Z_PK as person_id,
        ZABCDRECORD.ZFIRSTNAME as first_name,
        ZABCDRECORD.ZLASTNAME as last_name,
        ZABCDRECORD.ZORGANIZATION as organization
      FROM ZABCDRECORD
      WHERE ZABCDRECORD.Z_PK IS NOT NULL
    `);

    const phonesResult: PhoneRow[] = await dbAll(`
      SELECT
        ZABCDPHONENUMBER.ZOWNER as person_id,
        ZABCDPHONENUMBER.ZFULLNUMBER as phone
      FROM ZABCDPHONENUMBER
      WHERE ZABCDPHONENUMBER.ZFULLNUMBER IS NOT NULL
    `);

    const emailsResult: EmailRow[] = await dbAll(`
      SELECT
        ZABCDEMAILADDRESS.ZOWNER as person_id,
        ZABCDEMAILADDRESS.ZADDRESS as email
      FROM ZABCDEMAILADDRESS
      WHERE ZABCDEMAILADDRESS.ZADDRESS IS NOT NULL
    `);

    await dbClose();

    console.log(
      `[ContactsService] Loaded ${contactsResult.length} contact records, ${phonesResult.length} phones, ${emailsResult.length} emails`
    );

    // Build person map
    const personMap = buildPersonMap(contactsResult, phonesResult, emailsResult);

    // Build lookup maps
    buildContactMaps(personMap, contactMap, phoneToContactInfo);
  } catch (error) {
    console.error('[ContactsService] Error accessing contacts database:', error);
    throw error;
  }

  return { contactMap, phoneToContactInfo };
}

/**
 * Build person map from database results
 */
function buildPersonMap(
  contactsResult: DatabaseRow[],
  phonesResult: PhoneRow[],
  emailsResult: EmailRow[]
): PersonMap {
  const personMap: PersonMap = {};

  // Create person entries with display names
  contactsResult.forEach((person) => {
    const displayName = buildDisplayName(person.first_name, person.last_name, person.organization);

    if (displayName) {
      personMap[person.person_id] = {
        name: displayName,
        phones: [],
        emails: [],
      };
    }
  });

  // Add phones to persons
  phonesResult.forEach((phone) => {
    if (personMap[phone.person_id]) {
      personMap[phone.person_id].phones.push(phone.phone);
    }
  });

  // Add emails to persons
  emailsResult.forEach((email) => {
    if (personMap[email.person_id]) {
      personMap[email.person_id].emails.push(email.email);
    }
  });

  return personMap;
}

/**
 * Build display name from name components
 */
function buildDisplayName(
  firstName?: string,
  lastName?: string,
  organization?: string
): string {
  const first = firstName || '';
  const last = lastName || '';
  const org = organization || '';

  if (first && last) {
    return `${first} ${last}`;
  } else if (org) {
    return org;
  } else if (first) {
    return first;
  } else if (last) {
    return last;
  }

  return '';
}

/**
 * Build contact lookup maps
 */
function buildContactMaps(
  personMap: PersonMap,
  contactMap: ContactMap,
  phoneToContactInfo: PhoneToContactInfo
): void {
  Object.values(personMap).forEach((person) => {
    // Map phone numbers to name and full contact info
    person.phones.forEach((phone: string) => {
      const normalized = normalizePhoneNumber(phone);

      // Map both normalized and original to name
      contactMap[normalized] = person.name;
      contactMap[phone] = person.name;

      // Map to full contact info (all phones and emails)
      const fullInfo: ContactInfo = {
        name: person.name,
        phones: person.phones,
        emails: person.emails,
      };
      phoneToContactInfo[normalized] = fullInfo;
      phoneToContactInfo[phone] = fullInfo;
    });

    // Map emails to name
    person.emails.forEach((email: string) => {
      const emailLower = email.toLowerCase();
      contactMap[emailLower] = person.name;
    });
  });
}

/**
 * Resolve contact name from various identifiers
 */
function resolveContactName(
  contactId: string,
  chatIdentifier: string,
  displayName: string | undefined,
  contactMap: ContactMap
): string {
  // If we have a display_name from Messages, use it
  if (displayName) return displayName;

  // Try to find contact name by contactId (phone or email)
  if (contactId) {
    // Try direct match
    if (contactMap[contactId]) {
      return contactMap[contactId];
    }

    // Try normalized phone number match
    const normalized = normalizePhoneNumber(contactId);
    if (normalized && contactMap[normalized]) {
      return contactMap[normalized];
    }

    // If not found and number has country code 1, try without it
    if (normalized && normalized.startsWith('1') && normalized.length === 11) {
      const withoutCountryCode = normalized.substring(1);
      if (contactMap[withoutCountryCode]) {
        return contactMap[withoutCountryCode];
      }
    }

    // Try lowercase email match
    const lowerEmail = contactId.toLowerCase();
    if (contactMap[lowerEmail]) {
      return contactMap[lowerEmail];
    }
  }

  // Try chat_identifier as fallback
  if (chatIdentifier) {
    if (contactMap[chatIdentifier]) {
      return contactMap[chatIdentifier];
    }

    const normalized = normalizePhoneNumber(chatIdentifier);
    if (normalized && contactMap[normalized]) {
      return contactMap[normalized];
    }

    // If not found and number has country code 1, try without it
    if (normalized && normalized.startsWith('1') && normalized.length === 11) {
      const withoutCountryCode = normalized.substring(1);
      if (contactMap[withoutCountryCode]) {
        return contactMap[withoutCountryCode];
      }
    }
  }

  // Final fallback: format and show the phone/email nicely
  const fallbackValue = contactId || chatIdentifier || 'Unknown';
  return formatPhoneNumber(fallbackValue);
}

export {
  getContactNames,
  loadContactsFromDatabase,
  resolveContactName,
  buildDisplayName,
};

export type {
  ContactMap,
  ContactInfo,
  PhoneToContactInfo,
  LoadStatus,
  ContactNamesResult,
};
