/**
 * Contacts Service
 * Handles loading and resolving contacts from macOS Contacts database
 */

const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { promisify } = require('util');
const { exec } = require('child_process');

const { normalizePhoneNumber, formatPhoneNumber } = require('../utils/phoneUtils');
const { MIN_CONTACT_RECORD_COUNT, CONTACTS_BASE_DIR, DEFAULT_CONTACTS_DB } = require('../constants');

/**
 * Get contact names from macOS Contacts database
 * Searches for all .abcddb files and uses the one with most records
 *
 * @returns {Promise<{contactMap: Object, phoneToContactInfo: Object}>}
 * contactMap: Maps phone/email to contact name
 * phoneToContactInfo: Maps phone to full contact info (all phones & emails)
 */
async function getContactNames() {
  const contactMap = {};
  const phoneToContactInfo = {};

  try {
    const baseDir = path.join(process.env.HOME, CONTACTS_BASE_DIR);

    // Use exec to find all .abcddb files
    const execPromise = promisify(exec);

    try {
      const { stdout } = await execPromise(`find "${baseDir}" -name "*.abcddb" 2>/dev/null`);
      const dbFiles = stdout.trim().split('\n').filter(f => f);

      // Try each database and count records
      for (const dbPath of dbFiles) {
        try {
          const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
          const dbAll = promisify(db.all.bind(db));
          const dbClose = promisify(db.close.bind(db));

          const recordCount = await dbAll(
            `SELECT COUNT(*) as count FROM ZABCDRECORD WHERE Z_ENT IS NOT NULL;`
          );
          await dbClose();

          // If this database has sufficient records, use it
          if (recordCount[0].count > MIN_CONTACT_RECORD_COUNT) {
            return await loadContactsFromDatabase(dbPath);
          }
        } catch (err) {
          // Silently skip unreadable databases
        }
      }
    } catch (err) {
      console.error('Error finding database files:', err.message);
    }

    // Fallback to default path
    const defaultPath = path.join(process.env.HOME, DEFAULT_CONTACTS_DB);
    return await loadContactsFromDatabase(defaultPath);

  } catch (error) {
    console.error('Error accessing contacts database:', error);
    return { contactMap, phoneToContactInfo };
  }
}

/**
 * Load contacts from a specific database file
 *
 * @param {string} contactsDbPath - Path to the contacts database
 * @returns {Promise<{contactMap: Object, phoneToContactInfo: Object}>}
 */
async function loadContactsFromDatabase(contactsDbPath) {
  const contactMap = {};
  const phoneToContactInfo = {};

  try {
    await fs.access(contactsDbPath);
  } catch {
    return { contactMap, phoneToContactInfo };
  }

  try {
    const db = new sqlite3.Database(contactsDbPath, sqlite3.OPEN_READONLY);
    const dbAll = promisify(db.all.bind(db));
    const dbClose = promisify(db.close.bind(db));

    // Query to get contacts with both phone numbers and emails
    const contactsResult = await dbAll(`
      SELECT
        ZABCDRECORD.Z_PK as person_id,
        ZABCDRECORD.ZFIRSTNAME as first_name,
        ZABCDRECORD.ZLASTNAME as last_name,
        ZABCDRECORD.ZORGANIZATION as organization
      FROM ZABCDRECORD
      WHERE ZABCDRECORD.Z_PK IS NOT NULL
    `);

    const phonesResult = await dbAll(`
      SELECT
        ZABCDPHONENUMBER.ZOWNER as person_id,
        ZABCDPHONENUMBER.ZFULLNUMBER as phone
      FROM ZABCDPHONENUMBER
      WHERE ZABCDPHONENUMBER.ZFULLNUMBER IS NOT NULL
    `);

    const emailsResult = await dbAll(`
      SELECT
        ZABCDEMAILADDRESS.ZOWNER as person_id,
        ZABCDEMAILADDRESS.ZADDRESS as email
      FROM ZABCDEMAILADDRESS
      WHERE ZABCDEMAILADDRESS.ZADDRESS IS NOT NULL
    `);

    await dbClose();

    // Build person map
    const personMap = buildPersonMap(contactsResult, phonesResult, emailsResult);

    // Build lookup maps
    buildContactMaps(personMap, contactMap, phoneToContactInfo);

  } catch (error) {
    console.error('Error accessing contacts database:', error);
  }

  return { contactMap, phoneToContactInfo };
}

/**
 * Build person map from database results
 *
 * @param {Array} contactsResult - Contact records from database
 * @param {Array} phonesResult - Phone numbers from database
 * @param {Array} emailsResult - Email addresses from database
 * @returns {Object} Person map indexed by person_id
 */
function buildPersonMap(contactsResult, phonesResult, emailsResult) {
  const personMap = {};

  // Create person entries with display names
  contactsResult.forEach(person => {
    const displayName = buildDisplayName(
      person.first_name,
      person.last_name,
      person.organization
    );

    if (displayName) {
      personMap[person.person_id] = {
        name: displayName,
        phones: [],
        emails: []
      };
    }
  });

  // Add phones to persons
  phonesResult.forEach(phone => {
    if (personMap[phone.person_id]) {
      personMap[phone.person_id].phones.push(phone.phone);
    }
  });

  // Add emails to persons
  emailsResult.forEach(email => {
    if (personMap[email.person_id]) {
      personMap[email.person_id].emails.push(email.email);
    }
  });

  return personMap;
}

/**
 * Build display name from name components
 *
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} organization - Organization name
 * @returns {string} Display name
 */
function buildDisplayName(firstName, lastName, organization) {
  firstName = firstName || '';
  lastName = lastName || '';
  organization = organization || '';

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (organization) {
    return organization;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  }

  return '';
}

/**
 * Build contact lookup maps
 *
 * @param {Object} personMap - Person map indexed by person_id
 * @param {Object} contactMap - Output: Maps phone/email to name
 * @param {Object} phoneToContactInfo - Output: Maps phone to full contact info
 */
function buildContactMaps(personMap, contactMap, phoneToContactInfo) {
  Object.values(personMap).forEach(person => {
    // Map phone numbers to name and full contact info
    person.phones.forEach(phone => {
      const normalized = normalizePhoneNumber(phone);

      // Map both normalized and original to name
      contactMap[normalized] = person.name;
      contactMap[phone] = person.name;

      // Map to full contact info (all phones and emails)
      const fullInfo = {
        name: person.name,
        phones: person.phones,
        emails: person.emails
      };
      phoneToContactInfo[normalized] = fullInfo;
      phoneToContactInfo[phone] = fullInfo;
    });

    // Map emails to name
    person.emails.forEach(email => {
      const emailLower = email.toLowerCase();
      contactMap[emailLower] = person.name;
    });
  });
}

/**
 * Resolve contact name from various identifiers
 *
 * @param {string} contactId - Phone number or email from message
 * @param {string} chatIdentifier - Chat identifier from Messages
 * @param {string} displayName - Display name from Messages (if available)
 * @param {Object} contactMap - Contact lookup map
 * @returns {string} Resolved contact name or formatted identifier
 */
function resolveContactName(contactId, chatIdentifier, displayName, contactMap) {
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

module.exports = {
  getContactNames,
  loadContactsFromDatabase,
  resolveContactName,
  buildDisplayName
};
