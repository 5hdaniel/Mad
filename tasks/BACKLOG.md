# Engineering Backlog

This file tracks ongoing improvements, optimizations, and bug fixes that are not blocking releases but should be addressed.

## Build & Performance Optimizations

### BACKLOG-001: Add ES Module Type to package.json
**Priority:** Low
**Status:** Pending
**Category:** Build Warning

**Description:**
Add `"type": "module"` to package.json to fix the `MODULE_TYPELESS_PACKAGE_JSON` warning during build.

**Warning:**
```
Warning: Module type of file:///C:/Users/Daniel/New%20folder/Mad/postcss.config.js is not specified
and it doesn't parse as CommonJS. Reparsing as ES module because module syntax was detected.
This incurs a performance overhead.
```

**Solution:**
Add `"type": "module"` to package.json, then verify all CommonJS imports still work.

---

### BACKLOG-002: Code-Split Large JS Bundle
**Priority:** Medium
**Status:** Pending
**Category:** Performance

**Description:**
The main JS bundle is 590 kB (exceeds 500 kB warning threshold). This affects initial load time.

**Options:**
1. Use dynamic `import()` for lazy-loading routes/heavy components
2. Configure `build.rollupOptions.output.manualChunks` in vite.config.ts
3. Or increase `build.chunkSizeWarningLimit` if size is acceptable for desktop app

**Candidates for code-splitting:**
- Dashboard components (loaded after login)
- iPhone sync flow (only needed for Windows + iPhone users)
- Settings/preferences screens
- Heavy libraries (if any)

---

## iPhone Sync Improvements

### BACKLOG-003: Improve First-Sync Time Estimation
**Priority:** Low
**Status:** Pending
**Category:** UX

**Description:**
For first-time backups, we estimate backup size at 150% of "used space" from iOS disk_usage. This is a rough estimate - actual backup sizes vary widely based on:
- Encryption status
- Photo library size
- Message history
- App data

**Possible improvements:**
- Track actual backup sizes per device and use historical data
- Query iOS for more accurate pre-backup size estimate (if API exists)
- Show "size unknown" for first sync instead of potentially wrong estimate

---

### BACKLOG-004: Add Sync History/Logs Screen
**Priority:** Low
**Status:** Pending
**Category:** Feature

**Description:**
Add a screen where users can see:
- Previous sync timestamps
- Sync duration
- Data transferred
- Any errors that occurred

This helps users understand their sync patterns and troubleshoot issues.

---

## Database & Data Management

### BACKLOG-005: Implement databaseService with LLM-Ready Patterns
**Priority:** Medium
**Status:** Pending
**Category:** Architecture

**Description:**
See `docs/TASK-databaseService.md` for full specification. Goal is to create a service layer that makes database operations easy for LLM-assisted development.

---

## UI/UX

### BACKLOG-006: Dark Mode (Match System Settings)
**Priority:** Medium
**Status:** Pending
**Category:** UI/UX

**Description:**
Add dark mode support that automatically matches the user's system preferences.

**Requirements:**
- Detect system color scheme preference (light/dark)
- Apply dark theme when system is in dark mode
- Listen for system theme changes and update in real-time
- Consider adding manual override in Settings (Auto / Light / Dark)

**Implementation approach:**
1. Use `window.matchMedia('(prefers-color-scheme: dark)')` to detect system preference
2. Add CSS variables for theme colors (background, text, borders, etc.)
3. Use Tailwind's `dark:` variant classes or CSS custom properties
4. Store user preference override in localStorage/settings

**Files likely to modify:**
- `src/index.css` or `tailwind.config.js` - Theme configuration
- `src/App.tsx` - Theme provider/context
- `src/components/*` - Add dark mode classes where needed

---

## Testing

### BACKLOG-007: Add iPhone Sync Integration Tests
**Priority:** Medium
**Status:** Pending
**Category:** Testing

**Description:**
Add automated tests for the iPhone sync flow:
- Mock device detection
- Backup service with mock idevicebackup2 output
- Progress parsing
- Error handling for various exit codes

---

---

### BACKLOG-008: Redesign "New Transaction" Flow - Auto-Detection First
**Priority:** High
**Status:** Pending
**Category:** UI/UX

**Description:**
Redesign the "Start New Transaction" flow to prioritize automatic detection (the "magic" feature) over manual entry.

**Current flow:**
- User clicks "Start New Transaction" → Manual entry form

**Proposed flow:**
1. User clicks "Start New Transaction"
2. **If PC/Windows user without iPhone sync:**
   - Prompt: "Sync your iPhone first for best results" with options:
     - "Sync iPhone Now" → Redirect to iPhone sync flow
     - "Continue with Email Only" → Proceed to auto-detection with emails only
3. **Auto-detection screen:**
   - "Scanning your emails and messages for transactions..."
   - Show detected transactions with confidence scores
   - Let user select which to import
4. **If no transactions found or user wants to add more:**
   - "No transactions found" or "Add another transaction?"
   - Option: "Add Transaction Manually" → Current manual flow

**Benefits:**
- Showcases the "magic" AI detection as the primary feature
- Encourages iPhone sync for better detection
- Manual entry becomes fallback, not primary

**Files likely to modify:**
- `src/components/transactions/` - New auto-detection UI
- `src/components/Dashboard.tsx` - Update "New Transaction" button behavior
- New component: `src/components/transactions/AutoDetectionFlow.tsx`

---

### BACKLOG-009: Auth Popup Close Handler - Reconnect State
**Priority:** High
**Status:** Pending
**Category:** UX/Bug Fix

**Description:**
All authentication buttons (Google, Outlook, etc.) should handle the case where user closes the auth popup without completing authentication.

**Current behavior:**
- Button may get stuck in loading state or show misleading status

**Required behavior:**
- Detect when auth popup is closed without completion
- Reset button to allow reconnection attempt
- Show clear "Connect" or "Retry" state
- Optionally show message: "Authentication was cancelled. Click to try again."

**Implementation:**
1. Add event listener for popup close/focus return
2. Check if auth completed successfully
3. If not, reset button state to initial "Connect" state
4. Consider adding a timeout fallback

**Files to audit:**
- `src/components/EmailOnboardingScreen.tsx`
- `src/components/settings/` - Any auth buttons
- `src/hooks/useGoogleAuth.ts` (if exists)
- `src/hooks/useOutlookAuth.ts` (if exists)

---

### BACKLOG-010: Default App Window to Full Screen
**Priority:** Low
**Status:** Pending
**Category:** UX

**Description:**
When the app opens, it should default to full screen (maximized) view.

**Implementation:**
In Electron main process, set window to maximize on creation:

```typescript
// electron/main.ts
const mainWindow = new BrowserWindow({
  // ... other options
});

// Maximize window on open
mainWindow.maximize();
```

Or use `show: false` then maximize before showing to avoid visual jump.

**Files to modify:**
- `electron/main.ts` - Window creation options

---

### BACKLOG-011: Manually Add Missing Emails to Audit
**Priority:** Medium
**Status:** Pending
**Category:** Feature

**Description:**
Allow users to manually add emails that weren't auto-detected to an existing audit/transaction.

**Use cases:**
- Email was in spam/archive folder not scanned
- Email from address not in contact list
- User forwarded email from another account

**Possible approaches:**
1. **Search and attach:** User searches their connected email, selects emails to attach
2. **Forward to app:** Generate unique email address, user forwards email there
3. **Manual entry:** User pastes email content/metadata manually
4. **Re-scan with filters:** Let user specify date range, sender, keywords to re-scan

**UI location:**
- Transaction detail view → "Add Evidence" → "Add Email"
- Or audit trail section → "+" button → "Add Email"

---

### BACKLOG-012: Manually Add Missing Texts to Audit
**Priority:** Medium
**Status:** Pending
**Category:** Feature

**Description:**
Allow users to manually add text messages that weren't auto-detected to an existing audit/transaction.

**Use cases:**
- Messages from before iPhone sync started
- Messages deleted from phone but user has screenshots
- Messages from different phone/number

**Possible approaches:**
1. **Re-sync specific date range:** Let user specify dates to re-extract
2. **Screenshot upload:** User uploads screenshot, OCR extracts text
3. **Manual entry:** User types/pastes message content with metadata (date, sender, etc.)
4. **Import from backup:** Let user point to a different backup location

**UI location:**
- Transaction detail view → "Add Evidence" → "Add Text Message"

---

### BACKLOG-013: Duplicate Transaction Detection in Auto-Scan
**Priority:** High
**Status:** Pending
**Category:** Feature/Data Integrity

**Description:**
When auto-detecting transactions, check if the transaction already exists in the system to prevent duplicates.

**Questions to investigate:**
- What uniquely identifies a transaction? (Address? Date range? Parties involved?)
- How similar does a detected transaction need to be to flag as duplicate?
- Should we merge, skip, or prompt user for duplicates?

**Required checks:**
1. Before creating new transaction from auto-detection:
   - Check if property address already exists
   - Check if same parties (buyer/seller) involved
   - Check date proximity (same week/month)
2. If potential duplicate found:
   - Show user: "This may be a duplicate of [Transaction X]"
   - Options: "Add to existing" / "Create new anyway" / "Skip"

**Implementation:**
- Add `findSimilarTransactions()` function to transaction service
- Add duplicate check step in auto-detection flow
- Add UI for duplicate resolution

**Files to modify:**
- `src/services/transactionService.ts` (or equivalent)
- Auto-detection flow component (BACKLOG-008)

---

### BACKLOG-014: Update Joyride Demo for New Users
**Priority:** Medium
**Status:** Pending
**Category:** Onboarding/UX

**Description:**
The Joyride guided tour for new users needs to be updated to reflect current UI and features.

**Areas to review:**
1. Does the tour cover all key features? (Dashboard, iPhone sync, email connection, transactions)
2. Are the step targets pointing to correct elements? (CSS selectors may have changed)
3. Is the messaging clear and helpful?
4. Does the tour flow make sense with current onboarding?

**Potential updates needed:**
- Add tour steps for iPhone sync feature (Windows users)
- Update any steps that reference changed UI elements
- Ensure tour doesn't conflict with onboarding modals
- Add tour for "New Transaction" auto-detection flow (once BACKLOG-008 is complete)

**Files to review:**
- Tour configuration file (likely in `src/components/` or `src/hooks/`)
- Any Joyride-related components

---

### BACKLOG-015: Display Last Sync Time in UI
**Priority:** Medium
**Status:** Pending
**Category:** UX

**Description:**
Show the "Last synced: X ago" timestamp in two places:
1. **Dashboard sync card** - The card that shows iPhone sync status
2. **iPhone sync modal** - The first screen after clicking "Sync iPhone Messages"

Currently the last sync time is logged to console but not displayed to the user.

**Implementation:**
1. The `useIPhoneSync` hook already has `lastSyncTime` state
2. The `backup:check-status` IPC handler already returns `lastSyncTime` from backup metadata
3. Need to:
   - Pass `lastSyncTime` to the dashboard sync card component
   - Display "Last synced: X minutes ago" or "Never synced" on the card
   - Show same info on the sync modal's connection status screen

**Files to modify:**
- `src/components/Dashboard.tsx` or sync card component - Display last sync time
- `src/components/iphone/IPhoneSyncFlow.tsx` - Show last sync time on connection screen
- `src/components/iphone/ConnectionStatus.tsx` - May already have `formatLastSyncTime()` helper

**Related:**
- `formatLastSyncTime()` helper already exists in `ConnectionStatus.tsx` (lines 12-31)

---

### BACKLOG-016: Refactor Contact Import to Use Reference Model
**Priority:** High
**Status:** Pending
**Category:** Architecture Refactor

**Description:**
Refactor the contact import system to use a reference-based model instead of duplicating contact data.

**Current Problem:**
- macOS: `contacts:import` copies data from AddressBook → creates NEW row in `contacts` table
- iPhone sync: Already populates `contacts` table with full contact data
- Result: Potential duplication and inconsistent data model

**Target Architecture:**

| Table | Purpose |
|-------|---------|
| `contacts` | **Source of truth** - all contacts from iPhone sync, email inference, manual entry |
| `contact_phones` | Multiple phones per contact (from sync) |
| `contact_emails` | Multiple emails per contact (from sync) |
| `transaction_participants` | Links contact → transaction with role (buyer, seller, etc.) |

**"Importing" a contact means:**
- Contact already exists in `contacts` table (from sync or manual)
- Mark as `is_imported = true` OR add to `transaction_participants` when linked to a transaction
- NO data duplication

**"Deleting" an imported contact means:**
- Remove from `transaction_participants` (unlink from transactions)
- Set `is_imported = false`
- Contact remains in `contacts` table (available to re-import)

**Implementation Steps:**

1. **Add `is_imported` column to contacts table** (if not using transaction_participants for this)
   ```sql
   ALTER TABLE contacts ADD COLUMN is_imported INTEGER DEFAULT 0;
   ```

2. **Modify `contacts:get-available`:**
   - macOS: Query AddressBook file (existing behavior)
   - Windows: Query `contacts` table WHERE `source = 'contacts_app'` AND `is_imported = 0`
   - Both return same data shape for UI

3. **Modify `contacts:import`:**
   - Instead of `createContact()`, just `UPDATE contacts SET is_imported = 1 WHERE id = ?`
   - macOS: First create contact from AddressBook data, then mark imported
   - Windows: Contact already exists from sync, just mark imported

4. **Modify `contacts:delete` / `contacts:remove`:**
   - Set `is_imported = 0` instead of deleting row
   - Contact reappears in "Available to Import" list

5. **Update `contacts:get-all`:**
   - Query `WHERE is_imported = 1`

**Files to modify:**
- `electron/database/schema.sql` - Add `is_imported` column
- `electron/contact-handlers.ts` - Refactor all handlers
- `electron/services/databaseService.ts` - Update contact methods
- `electron/services/contactsService.ts` - Add Windows query method

---

### BACKLOG-017: Naming Convention Documentation for Data Layers
**Priority:** Low
**Status:** Pending
**Category:** Documentation

**Description:**
Document the data flow and naming conventions in the codebase for clarity.

**Current Architecture (Already Correct):**
| Layer | Storage | Purpose |
|-------|---------|---------|
| Raw Backup | `Backups/{UDID}/` files | Encrypted iOS backup from idevicebackup2 |
| Processed Data | `contacts`, `messages` tables | Parsed data from backup, full copies |
| Transaction Link | `transaction_participants` table | Reference linking contact → transaction with role |

**No schema changes needed** - current design is correct:
- `contacts` stores full contact info (not duplicated when "imported")
- `transaction_participants` links contact to transaction via foreign key + adds role
- Same contact can be in multiple transactions with different roles

**Deliverables:**
1. Add JSDoc comments to key service files explaining data flow
2. Document in README or developer docs

---

### BACKLOG-018: Smart Contact Sync with Manual Override Support
**Priority:** High
**Status:** Pending
**Category:** Feature

**Description:**
When iPhone sync runs again, intelligently merge new data while preserving manual edits made in the software.

**Behavior:**
1. **iPhone changes sync to software** - If user updates contact on iPhone (new phone, changed name, added email), next sync updates the `contacts` table
2. **Manual overrides persist** - If user edits a field in the software, that field is marked as "manual override" and won't be overwritten by sync
3. **New data from iPhone is added** - New phones/emails from iPhone are added alongside existing ones

**Implementation:**

1. **Add `is_manual_override` column to child tables:**
   ```sql
   ALTER TABLE contact_phones ADD COLUMN is_manual_override INTEGER DEFAULT 0;
   ALTER TABLE contact_emails ADD COLUMN is_manual_override INTEGER DEFAULT 0;
   ```

2. **Add `manual_override_fields` to contacts table:**
   ```sql
   ALTER TABLE contacts ADD COLUMN manual_override_fields TEXT;  -- JSON array: ["display_name", "company"]
   ```

3. **Update `iPhoneSyncStorageService.storeContacts()`:**
   - Check if contact exists (by phone match)
   - If exists: UPDATE non-overridden fields only
   - Check `manual_override_fields` JSON before updating each field
   - Add new phones/emails that don't exist yet

4. **Update contact edit handlers:**
   - When user edits a field, add field name to `manual_override_fields`
   - When user edits phone/email, set `is_manual_override = 1`

5. **UI consideration:**
   - Optionally show indicator on manually overridden fields
   - Allow user to "reset to sync data" to remove override

**Files to modify:**
- `electron/database/schema.sql` - Add override columns
- `electron/services/iPhoneSyncStorageService.ts` - Implement merge logic
- `electron/contact-handlers.ts` - Track manual edits
- `electron/services/databaseService.ts` - Update contact methods

---

## Last Updated
2024-12-10 - Initial backlog created from build warnings and sync testing session
2024-12-10 - Added BACKLOG-006: Dark Mode
2024-12-10 - Added BACKLOG-008 through BACKLOG-013: New transaction flow, auth handling, fullscreen, manual evidence, duplicate detection
2024-12-10 - Added BACKLOG-014: Update Joyride demo for new users
2024-12-10 - Added BACKLOG-015: Display last sync time in dashboard and sync modal
2024-12-11 - Added BACKLOG-016: Refactor Contact Import to Use Reference Model (High priority)
2024-12-11 - Added BACKLOG-017: Naming Convention Documentation (Low priority)
2024-12-11 - Added BACKLOG-018: Smart Contact Sync with Manual Override Support (High priority)
