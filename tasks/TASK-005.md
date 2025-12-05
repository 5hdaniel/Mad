# TASK-005: Contacts Database Parser

## Task Info
- **Task ID:** TASK-005
- **Phase:** 2 - Core Services
- **Dependencies:** None (works on backup files, not live device)
- **Can Start:** Immediately
- **Estimated Effort:** 3-4 days

## Goal

Create a parser that reads the iOS Contacts database (AddressBook.sqlitedb) from an iTunes-style backup and extracts contact information.

## Background

iOS stores contacts in a SQLite database called `AddressBook.sqlitedb`. This service parses that database and returns structured contact data that can be used to match phone numbers/emails to names in messages.

## Deliverables

1. Contacts parser service that reads AddressBook.sqlitedb from backup
2. TypeScript types for iOS contacts
3. Phone number normalization for matching
4. Lookup methods for message handle resolution

## Technical Requirements

### 1. Create Contact Types

Create `electron/types/iosContacts.ts`:

```typescript
export interface iOSContact {
  id: number;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  phoneNumbers: ContactPhone[];
  emails: ContactEmail[];
  displayName: string;        // Computed: "First Last" or Organization
}

export interface ContactPhone {
  label: string;              // "mobile", "home", "work", etc.
  number: string;             // Raw number
  normalizedNumber: string;   // E.164 format for matching
}

export interface ContactEmail {
  label: string;
  email: string;
}

export interface ContactLookupResult {
  contact: iOSContact | null;
  matchedOn: 'phone' | 'email' | null;
}
```

### 2. Create Contacts Parser Service

Create `electron/services/iosContactsParser.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import log from 'electron-log';

export class iOSContactsParser {
  private db: Database.Database | null = null;
  private phoneIndex: Map<string, number> = new Map(); // normalized phone -> contact id
  private emailIndex: Map<string, number> = new Map(); // lowercase email -> contact id

  // The AddressBook hash in iOS backups
  static readonly ADDRESSBOOK_DB_HASH = '31bb7ba8914766d4ba40d6dfb6113c8b614be442';

  open(backupPath: string): void {
    const dbPath = path.join(backupPath, this.ADDRESSBOOK_DB_HASH);
    this.db = new Database(dbPath, { readonly: true });
    this.buildLookupIndexes();
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.phoneIndex.clear();
    this.emailIndex.clear();
  }

  private buildLookupIndexes(): void {
    // Build in-memory indexes for fast lookups
  }

  getAllContacts(): iOSContact[] {
    // Query ABPerson joined with ABMultiValue
  }

  getContactById(id: number): iOSContact | null {
    // Get single contact by ROWID
  }

  lookupByPhone(phoneNumber: string): ContactLookupResult {
    // Normalize phone and lookup in index
  }

  lookupByEmail(email: string): ContactLookupResult {
    // Lowercase and lookup in index
  }

  lookupByHandle(handle: string): ContactLookupResult {
    // Determine if handle is phone or email, then lookup
  }
}
```

### 3. Phone Number Normalization

```typescript
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle US numbers
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  // Return with + prefix (E.164-ish)
  return '+' + digits;
}

function phoneNumbersMatch(a: string, b: string): boolean {
  const normA = normalizePhoneNumber(a);
  const normB = normalizePhoneNumber(b);

  // Match if either is suffix of the other (handles country code differences)
  return normA.endsWith(normB.slice(-10)) || normB.endsWith(normA.slice(-10));
}
```

### 4. Database Schema Reference

Key tables in AddressBook.sqlitedb:
- `ABPerson` - Contact records
- `ABMultiValue` - Phone numbers, emails, addresses (linked by record_id)
- `ABMultiValueLabel` - Labels for multi-values

ABMultiValue property types:
- 3 = Phone number
- 4 = Email address

## Files to Create

- `electron/types/iosContacts.ts`
- `electron/services/iosContactsParser.ts`
- `electron/utils/phoneNormalization.ts`
- `electron/services/__tests__/iosContactsParser.test.ts`

## Files to Modify

- None (this is a standalone service)

## Dos

- ✅ Open database in readonly mode
- ✅ Build lookup indexes on open for fast matching
- ✅ Handle contacts with no name (use organization or "Unknown")
- ✅ Normalize phone numbers for reliable matching
- ✅ Case-insensitive email matching
- ✅ Handle international phone formats

## Don'ts

- ❌ Don't modify the database (readonly)
- ❌ Don't include contact details in logs (privacy)
- ❌ Don't assume US phone format only
- ❌ Don't fail if some contacts have incomplete data

## Testing Instructions

1. Create test fixtures with sample AddressBook.sqlitedb
2. Test phone number normalization with various formats
3. Test lookup with exact and fuzzy matches
4. Test with contacts missing names
5. Test with international phone numbers

## Sample Test Cases for Phone Normalization

```typescript
// These should all match the same contact:
'(555) 123-4567'
'555-123-4567'
'+1 555 123 4567'
'15551234567'
'5551234567'
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added with good coverage
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
claude/complete-task-005-01VC8mqRf2XeV5WmG2cYW6ZV
```

### Changes Made
```
Created:
- electron/types/iosContacts.ts - TypeScript types for iOS contacts (iOSContact, ContactPhone, ContactEmail, ContactLookupResult, etc.)
- electron/utils/phoneNormalization.ts - Phone number normalization utilities (normalizePhoneNumber, phoneNumbersMatch, isPhoneNumber, extractDigits, getTrailingDigits)
- electron/services/iosContactsParser.ts - Main iOS contacts parser service with:
  - Database opening/closing with readonly mode
  - In-memory phone/email lookup indexes for fast matching
  - Contact parsing from ABPerson and ABMultiValue tables
  - Phone/email/handle lookup methods
  - iOS label format cleaning (e.g., "_$!<Mobile>!$_" -> "mobile")
  - Display name computation (First Last > Organization > Unknown)
- electron/services/__tests__/iosContactsParser.test.ts - Tests for parser service
- electron/utils/__tests__/phoneNormalization.test.ts - Tests for phone normalization
```

### Testing Done
```
- All 55 unit tests pass
- ESLint passes with no errors or warnings
- TypeScript type-checking passes on new files
- Tested phone number normalization with various formats:
  - (555) 123-4567
  - 555-123-4567
  - +1 555 123 4567
  - 15551234567
  - 5551234567
- Tested contact lookup by phone, email, and handle
- Tested edge cases: contacts with no name/org, organization-only contacts, multiple phones
```

### Notes/Issues Encountered
```
- Full project type-check/lint had issues due to incomplete npm install (electron binary download failed), but new files pass individual type-check and lint
- Used existing better-sqlite3-multiple-ciphers package for database access
- Implemented suffix-based phone matching (last 10 digits) to handle country code differences
- The parser builds lookup indexes on open() for O(1) lookups
```

### PR Link
```
[PR will be created after push]
```
