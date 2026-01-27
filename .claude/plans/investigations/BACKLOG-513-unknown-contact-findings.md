# BACKLOG-513: Unknown Contact Name Investigation Findings

**Investigation Date:** 2026-01-26
**Investigator:** Engineer Agent (TASK-1401)
**Sprint:** SPRINT-061

---

## Executive Summary

The "unknown" contact name issue in 1:1 text conversations occurs due to a **normalization mismatch** between how phone numbers are stored/looked up in the contact database vs how they appear in message participants. The core issue is that the lookup function correctly normalizes phones, but there's a subtle mismatch when contacts are not yet imported into the local database and the macOS Contacts fallback doesn't find a match.

**Root Cause:** When a phone number from messages cannot be found in:
1. The `contact_phones` table (local database), AND
2. The macOS Contacts database fallback

The UI receives no mapping for that phone, causing `contactName` to be `undefined`, which displays as the raw phone number (not literally "unknown").

**Secondary Finding:** The word "Unknown" appears in `extractPhoneFromThread()` (line 484 of MessageThreadCard.tsx) as a fallback when NO phone can be extracted from ANY message in a thread, which is a separate edge case.

---

## Detailed Analysis

### 1. Data Flow Trace

```
User sees thread card
        |
        v
TransactionMessagesTab.tsx
  - Calls extractAllPhones(messages) to get all phones from messages
  - Calls window.api.contacts.getNamesByPhones(phones)
        |
        v
contacts:get-names-by-phones IPC handler (contact-handlers.ts:1036-1062)
  - Calls databaseService.getContactNamesByPhones(phones)
        |
        v
contactDbService.ts getContactNamesByPhones() (lines 726-808)
  - Step 1: Normalize input phones to last 10 digits
  - Step 2: Query contact_phones table with LIKE pattern matching
  - Step 3: If not found, fallback to macOS Contacts (getContactNames())
  - Returns Map<phone, name>
        |
        v
TransactionMessagesTab.tsx
  - Sets contactNames state
  - For each thread: contactName = contactNames[phoneNumber] || contactNames[normalized]
        |
        v
MessageThreadCard.tsx
  - Displays: contactName || phoneNumber (line 294)
```

### 2. Phone Number Formats

#### In `messages.participants` JSON (from macOS Messages import)
```json
{
  "from": "+14155550000",
  "to": ["me"]
}
```
- Format: Raw handle from macOS `handle.id` column
- Includes country code prefix (e.g., `+1`)
- Example: `+14155550000`, `+447911123456`

#### In `contact_phones.phone_e164` (local contact database)
```
+14155550000
```
- Format: E.164 (normalized during import via `normalizeToE164()`)
- Always includes `+` prefix and country code

#### Normalization Functions

**`normalizePhoneForLookup()` (UI - MessageThreadCard.tsx:202-205):**
```typescript
function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
```
- Returns: Last 10 digits only (strips country code)
- Example: `+14155550000` -> `4155550000`

**`getContactNamesByPhones()` normalization (contactDbService.ts:734-737):**
```typescript
const normalizedPhones = phones.map(p => {
  const digits = p.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}).filter(p => p.length >= 7);
```
- Same logic: Last 10 digits
- Both UI and DB use consistent normalization

### 3. Where "unknown" Comes From

There are actually **two different fallback values**:

#### Source 1: `extractPhoneFromThread()` returns "Unknown" (literal string)
**File:** `MessageThreadCard.tsx` line 484
```typescript
export function extractPhoneFromThread(messages: MessageLike[]): string {
  for (const msg of messages) {
    // ... tries to extract phone from participants JSON
  }
  return "Unknown"; // <-- This is the fallback
}
```
**When:** Thread has no messages with parseable participants (rare edge case)

#### Source 2: `resolveContactName()` returns formatted phone (not "unknown")
**File:** `contactsService.ts` line 468
```typescript
const fallbackValue = contactId || chatIdentifier || "Unknown";
return formatPhoneNumber(fallbackValue);
```
**Note:** This function is used in PDF/folder exports, NOT in the UI thread cards.

#### Source 3: UI displays raw phone when no contact mapping exists
**File:** `MessageThreadCard.tsx` line 294
```typescript
<span className="font-semibold text-gray-900 block">
  {contactName || phoneNumber}
</span>
```
**When:** `contactName` is undefined (phone not in contactNames map)

### 4. Root Cause Analysis

The "unknown" display happens in this scenario:

1. **Contact not imported:** User has contacts in macOS Contacts but hasn't imported them via the app
2. **Lookup fails:** `getContactNamesByPhones()` queries `contact_phones` table - finds nothing
3. **macOS fallback fails:** The fallback to `getContactNames()` requires Full Disk Access and may fail silently
4. **Result:** Phone not in `contactNames` map -> UI shows raw phone number

**The actual string "unknown" (lowercase) appears in:**
- `MessageThreadCard.tsx:68-70` - filtered out from chat_members
- `MessageThreadCard.tsx:76-77` - filtered out from `from` field
- `MessageThreadCard.tsx:84` - filtered out from `to` field

These filters prevent "unknown" from appearing in participant lists, but if ALL participants are "unknown", the thread would show "Unknown" from `extractPhoneFromThread()`.

### 5. Edge Cases Identified

| Scenario | Result |
|----------|--------|
| Contact imported, phone in contact_phones | Shows contact name |
| Contact not imported, macOS Contacts has it | Shows contact name (via fallback) |
| Contact not imported, macOS Contacts unreachable | Shows raw phone number |
| International phone (+44, +49, etc.) | May fail if stored differently |
| Phone with extension (x123) | Likely fails normalization |
| Thread with all "unknown" participants | Shows literal "Unknown" |

### 6. Example Failure Scenario

```
Message participants: {"from": "+14155550000", "to": ["me"]}
Contact in macOS Contacts: (415) 555-0000 -> "John Smith"

Lookup flow:
1. Extract phone: "+14155550000"
2. Normalize: "4155550000" (last 10 digits)
3. Query contact_phones: No match (not imported)
4. Fallback to macOS Contacts:
   - Contact stored as "(415) 555-0000"
   - Normalized: "4155550000"
   - SHOULD match... but may fail if:
     a. Full Disk Access not granted
     b. Contacts.app database locked
     c. Contact stored with different format
5. Result: No match -> phone displayed as-is
```

---

## Proposed Fix (TASK-1405)

### Option A: Ensure Both Original and Normalized Keys in Result Map

**File:** `contactDbService.ts` lines 758-771

**Current behavior:** Only stores by original phone AND normalized form
**Issue:** UI may look up by a format that wasn't stored

**Proposed enhancement:**
```typescript
// Map results back to original phone format
for (const row of rows) {
  const rowDigits = row.phone.replace(/\D/g, '');
  const rowNormalized = rowDigits.slice(-10);

  // Store by normalized form
  result.set(rowNormalized, row.display_name);

  // Also store by E.164 format (with +1 prefix)
  if (rowNormalized.length === 10) {
    result.set(`+1${rowNormalized}`, row.display_name);
  }

  // Find matching input phone and store by original format
  for (let i = 0; i < phones.length; i++) {
    const inputNormalized = normalizedPhones[i];
    if (inputNormalized === rowNormalized) {
      result.set(phones[i], row.display_name);
    }
  }
}
```

### Option B: Improve UI Lookup with Multiple Format Attempts

**File:** `TransactionMessagesTab.tsx` lines 472-475

**Current:**
```typescript
const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
const contactName = contactNames[phoneNumber] || contactNames[normalized];
```

**Proposed:**
```typescript
const digits = phoneNumber.replace(/\D/g, '');
const normalized = digits.length >= 10 ? digits.slice(-10) : digits;
const withCountryCode = digits.length === 10 ? `+1${digits}` : phoneNumber;
const contactName =
  contactNames[phoneNumber] ||
  contactNames[normalized] ||
  contactNames[withCountryCode] ||
  contactNames[digits];
```

### Option C: Standardize on E.164 Throughout (Longer-term)

Store all phone numbers in E.164 format (`+14155550000`) everywhere:
- In `messages.participants`
- In `contact_phones.phone_e164`
- During import normalization

This would eliminate format mismatches entirely.

---

## Recommended Approach

**For TASK-1405, implement Option A + B:**

1. In `getContactNamesByPhones()`: Store results by MORE key formats
2. In `TransactionMessagesTab.tsx`: Try MORE lookup formats
3. This is a low-risk, targeted fix that doesn't require data migration

**Estimated complexity:** Low
**Risk:** Minimal - only adds more lookup attempts, doesn't change data

---

## Files to Modify in TASK-1405

| File | Lines | Change |
|------|-------|--------|
| `electron/services/db/contactDbService.ts` | 758-771 | Add more key formats when storing results |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | 472-475 | Try more lookup formats |
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | 153-161 | Update `formatParticipantNames` to try more formats |
| `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` | 298-312 | Update `resolveToName` to try more formats |

---

## Testing Recommendations

1. **Unit test:** Mock `getContactNamesByPhones()` to return various key formats
2. **Integration test:** Import contact with one format, look up with another
3. **Manual test scenarios:**
   - Contact with +1 country code vs without
   - Contact stored as (415) 555-0000 vs +14155550000
   - International numbers (+44, +49)

---

## References

- **Backlog Item:** BACKLOG-513
- **Task File:** `.claude/plans/tasks/TASK-1401-investigate-unknown-contact-name.md`
- **Follow-up Task:** TASK-1405 (Fix contact phone lookup)
- **Sprint:** SPRINT-061
