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

### BACKLOG-019: Returning User Experience - Skip Phone Selection
**Priority:** Medium
**Status:** Pending
**Category:** UX

**Description:**
Returning users shouldn't have to re-select their phone type every time they open the app. Store the selection and allow changing it from settings.

**Current behavior:**
- Every app launch shows phone type selection screen
- User must click through onboarding steps each time

**Target behavior:**
- First launch: Show full onboarding (phone type → email → drivers)
- Returning user: Skip to dashboard directly
- Settings: Option to change phone platform (iPhone ↔ Android)
- Settings: Option to re-run onboarding if needed

**Implementation:**
1. Store `phoneType` preference in local storage/database on first selection
2. On app launch, check if `phoneType` exists → skip to dashboard
3. Add "Phone Platform" setting in Settings screen with options:
   - iPhone (current)
   - Android (current)
   - "Change Phone" → triggers re-onboarding flow
4. Store `onboardingCompleted: true` flag to distinguish new vs returning users

**Files to modify:**
- `src/App.tsx` - Check stored preference on launch
- `src/components/settings/` - Add phone platform setting
- `electron/services/databaseService.ts` or localStorage - Store preference

---

### BACKLOG-020: Device UUID Licensing - Single Device Lock
**Priority:** High
**Status:** Pending
**Category:** Licensing/Security

**Description:**
Tie user licenses to a specific device UUID to prevent account sharing. Store device binding in Supabase.

**Requirements:**
1. Generate/retrieve unique device UUID on first launch
2. On login, check if account already bound to a different UUID
3. If bound to different device → show error "This account is already activated on another device"
4. Allow license upgrade for multi-device support

**Implementation:**

1. **Generate Device UUID:**
   ```typescript
   // Use machine-id package or Electron's machineId
   import { machineIdSync } from 'node-machine-id';
   const deviceUuid = machineIdSync();
   ```

2. **Supabase table: `user_devices`**
   ```sql
   CREATE TABLE user_devices (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id),
     device_uuid TEXT NOT NULL,
     device_name TEXT,  -- "Daniel's Windows PC"
     platform TEXT,     -- 'win32', 'darwin'
     first_seen_at TIMESTAMPTZ DEFAULT NOW(),
     last_seen_at TIMESTAMPTZ DEFAULT NOW(),
     is_active BOOLEAN DEFAULT true,
     UNIQUE(user_id, device_uuid)
   );
   ```

3. **On login flow:**
   - Get local device UUID
   - Query `user_devices` for this user
   - If no devices → insert this device (first activation)
   - If devices exist but not this one → check license limit
   - If over limit → reject login with upgrade prompt

**SOC 2 Consideration:**
- Device UUID is not PII (it's a machine identifier)
- Storing in Supabase should be fine for SOC 2
- Add audit logging for device activations/deactivations

**Files to modify:**
- `electron/auth-handlers.ts` - Add device check on login
- `electron/services/deviceIdService.ts` - NEW: Get/generate device UUID
- Supabase migrations - Add `user_devices` table

---

### BACKLOG-021: License Management System
**Priority:** High
**Status:** Pending
**Category:** Licensing/Business Logic

**Description:**
Create a comprehensive license management system in Supabase to control feature access, limits, and billing.

**Supabase Tables:**

1. **`license_tiers`** - Define available license levels
   ```sql
   CREATE TABLE license_tiers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,              -- 'free', 'starter', 'professional', 'enterprise'
     display_name TEXT NOT NULL,      -- 'Free Trial', 'Starter', 'Professional', 'Enterprise'
     price_monthly DECIMAL(10,2),
     price_yearly DECIMAL(10,2),

     -- Device Limits
     max_devices INTEGER DEFAULT 1,

     -- Mailbox Limits
     max_mailboxes INTEGER DEFAULT 1,

     -- Export Limits
     exports_per_month INTEGER,       -- NULL = unlimited
     exports_per_year INTEGER,        -- NULL = unlimited

     -- Feature Flags
     feature_email_export BOOLEAN DEFAULT true,
     feature_text_export BOOLEAN DEFAULT false,
     feature_ai_timeline BOOLEAN DEFAULT false,
     feature_attachments BOOLEAN DEFAULT false,
     feature_bulk_export BOOLEAN DEFAULT false,
     feature_api_access BOOLEAN DEFAULT false,
     feature_priority_support BOOLEAN DEFAULT false,

     -- Metadata
     is_active BOOLEAN DEFAULT true,
     sort_order INTEGER DEFAULT 0,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **`user_licenses`** - User's active license
   ```sql
   CREATE TABLE user_licenses (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id) UNIQUE,
     tier_id UUID REFERENCES license_tiers(id),

     -- License Status
     status TEXT CHECK (status IN ('trial', 'active', 'expired', 'cancelled', 'suspended')),

     -- Dates
     trial_start_date TIMESTAMPTZ,
     trial_end_date TIMESTAMPTZ,
     license_start_date TIMESTAMPTZ,
     license_end_date TIMESTAMPTZ,    -- NULL = lifetime/no expiry

     -- Usage Tracking
     exports_this_month INTEGER DEFAULT 0,
     exports_this_year INTEGER DEFAULT 0,
     last_export_reset_at TIMESTAMPTZ DEFAULT NOW(),

     -- Billing (if integrated with Stripe)
     stripe_customer_id TEXT,
     stripe_subscription_id TEXT,

     -- Metadata
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **`license_usage_log`** - Audit trail for usage
   ```sql
   CREATE TABLE license_usage_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id),
     action TEXT,                     -- 'export', 'add_mailbox', 'add_device'
     resource_type TEXT,              -- 'transaction', 'mailbox', 'device'
     resource_id TEXT,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

**Default License Tiers (seed data):**
| Tier | Devices | Mailboxes | Exports/Mo | AI Timeline | Attachments | Price |
|------|---------|-----------|------------|-------------|-------------|-------|
| Trial | 1 | 1 | 5 | ❌ | ❌ | Free (14 days) |
| Starter | 1 | 1 | 25 | ❌ | ❌ | $29/mo |
| Professional | 2 | 3 | Unlimited | ✅ | ✅ | $79/mo |
| Enterprise | 10 | 10 | Unlimited | ✅ | ✅ | Custom |

**Feature Check Implementation:**
```typescript
// electron/services/licenseService.ts
class LicenseService {
  async canExport(userId: string): Promise<boolean> {
    const license = await this.getUserLicense(userId);
    if (license.status !== 'active' && license.status !== 'trial') return false;
    if (license.exports_this_month >= license.tier.exports_per_month) return false;
    return license.tier.feature_email_export;
  }

  async canUseAiTimeline(userId: string): Promise<boolean> {
    const license = await this.getUserLicense(userId);
    return license.tier.feature_ai_timeline;
  }

  async incrementExportCount(userId: string): Promise<void> {
    // Update exports_this_month, log to usage_log
  }
}
```

**Files to create:**
- `supabase/migrations/xxx_license_tables.sql` - Database schema
- `supabase/seed.sql` - Default license tiers
- `electron/services/licenseService.ts` - License checking logic
- `src/hooks/useLicense.ts` - React hook for feature checks
- `src/components/settings/LicenseSettings.tsx` - License info display
- `src/components/UpgradePrompt.tsx` - Shown when hitting limits

---

### BACKLOG-022: Minimizable iPhone Sync Modal
**Priority:** Medium
**Status:** Pending
**Category:** UX

**Description:**
Allow users to minimize the iPhone sync modal while sync is in progress, so they can continue using the rest of the app. The Dashboard "Sync iPhone Messages" button should show sync status when minimized.

**Current behavior:**
- Sync modal blocks user interaction with the app
- User must wait for sync to complete before using other features

**Proposed behavior:**
1. Add a "Minimize" button to the sync modal (next to close/X button)
2. When minimized, modal disappears but sync continues in background
3. Dashboard "Sync iPhone Messages" button transforms to show:
   - Spinning indicator or progress percentage
   - "Syncing... XX%" text
   - Click to re-open the full sync modal
4. When sync completes while minimized, show notification or change button to "Sync Complete - View Results"

**Implementation approach:**
1. Add `isSyncMinimized` state to appCore state machine
2. Add `minimizeIPhoneSync()` / `restoreIPhoneSync()` methods
3. Modify Dashboard component to receive sync status props:
   - `isSyncInProgress: boolean`
   - `syncProgress: number` (0-100)
   - `onRestoreSync: () => void`
4. Update the Dashboard sync button to show progress state when `isSyncInProgress && !showIPhoneSync`
5. Sync continues via existing IPC - only UI visibility changes

**Files to modify:**
- `src/appCore/state/types.ts` - Add minimize state and methods
- `src/appCore/state/useAppStateMachine.ts` - Implement minimize logic
- `src/appCore/AppModals.tsx` - Add minimize button, conditional render
- `src/appCore/AppRouter.tsx` - Pass sync status to Dashboard
- `src/components/Dashboard.tsx` - Update sync button to show progress state
- `src/hooks/useIPhoneSync.ts` - Expose sync status for Dashboard consumption

---

### BACKLOG-023: Detailed Sync Progress with Expandable Steps & Error Report
**Priority:** High
**Status:** Pending
**Category:** UX / Diagnostics

**Description:**
Add a "Show Details" expandable section to the sync modal that shows granular step-by-step progress. Also add error reporting functionality that collects diagnostic info for support.

**User Value:**
1. Users understand exactly what's happening at each stage
2. Users know when to interact with their phone (passcode)
3. Support can diagnose issues with detailed step logs
4. Reduces support tickets with "it's stuck" complaints

**Proposed UI:**

```
┌─────────────────────────────────────────┐
│  🔄 Backing up iPhone...                │
│  Transferring data (keep connected)     │
│                                         │
│  [████████████████░░░░] 78%            │
│  6.2 GB / 8.0 GB • 847 files           │
│                                         │
│  ▼ Show Details                         │
│  ┌─────────────────────────────────────┐│
│  │ Last Sync Info                      ││
│  │ ─────────────────────────────────── ││
│  │ Last synced: Dec 11, 2024 2:36 PM   ││
│  │ Backup size: 46.9 GB                ││
│  │ Messages synced: 626,947            ││
│  │ Contacts synced: 1,091              ││
│  │                                     ││
│  │ Current Sync Progress               ││
│  │ ─────────────────────────────────── ││
│  │ ✓ Connecting to iPhone       0.2s  ││
│  │ ✓ Reading storage info       1.1s  ││
│  │ ✓ Checking existing backup   0.8s  ││
│  │   → Found: 46.9 GB (351 min ago)   ││
│  │ ✓ Estimating sync size       0.3s  ││
│  │ ✓ Waiting for passcode       45s   ││
│  │ ✓ iPhone preparing backup    3m 22s││
│  │ ● Transferring files...      8m 14s││
│  │   → 6.2 GB transferred (847 files) ││
│  │ ○ Reading messages                  ││
│  │ ○ Reading contacts                  ││
│  │ ○ Checking for changes              ││
│  │ ○ Saving to database                ││
│  └─────────────────────────────────────┘│
│                                         │
│  ⚠️ Keep iPhone connected              │
│                                         │
│            [Cancel]                     │
└─────────────────────────────────────────┘
```

**Error State UI (with diagnostic report):**

```
┌─────────────────────────────────────────┐
│  ❌ Sync Failed                         │
│  Connection lost during backup          │
│                                         │
│  ▼ Show Details                         │
│  ┌─────────────────────────────────────┐│
│  │ ✓ Connecting to iPhone       0.2s  ││
│  │ ✓ Reading storage info       1.1s  ││
│  │ ✓ Waiting for passcode       45s   ││
│  │ ✓ iPhone preparing backup    3m 22s││
│  │ ✗ Transferring files         8m 14s││
│  │   Error: Exit code -208            ││
│  │   "Connection to iPhone lost"      ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Copy Diagnostic Report]  [Try Again]  │
└─────────────────────────────────────────┘
```

**Diagnostic Report Format (copied to clipboard):**
```
=== Magic Audit Sync Diagnostic Report ===
Timestamp: 2024-12-11T20:09:20.248Z
App Version: 1.1.0
Platform: Windows 11 (22H2)

Device Info:
- Name: iPhone
- Model: iPhone 14 Pro
- iOS Version: 17.2
- UDID: 00008140-000264592252801C

Previous Sync Info:
- Last synced: 2024-12-11T14:36:00.000Z (5 hours ago)
- Backup size: 46.9 GB
- Messages in database: 626,947
- Contacts in database: 1,091

Current Sync Session:
- Started: 2024-12-11T19:49:01.016Z
- Failed at: 2024-12-11T20:02:01.128Z
- Duration: 13 minutes
- Data transferred: 7.1 GB (28 files)

Step Log:
[19:49:01] ✓ Connecting to iPhone (0.2s)
[19:49:01] ✓ Reading storage info (1.1s)
[19:49:02] ✓ Checking existing backup (0.8s)
[19:50:57] ✓ Previous backup found: 46.9 GB
[19:50:59] ✓ Estimating sync size: 47 GB
[19:51:00] ✓ Starting backup
[19:57:29] ● Transferred 7.1 GB (28 files)
[20:02:01] ✗ FAILED: Exit code -208

Error Details:
- Exit Code: -208 (unsigned: 4294967088)
- Message: Connection to iPhone was lost
- Possible causes: Cable disconnected, iPhone locked, USB instability

Last 10 Log Lines:
[BackupService] File completed. Total: 7148479795 bytes, Files: 28
[BackupService] Process exited with code -208
[SyncOrchestrator] Backup failed: Connection lost
...
```

**Implementation Steps:**

**Step 1: Define Step Types**
```typescript
// electron/types/syncSteps.ts
export type SyncStepId =
  | 'connecting'
  | 'reading_storage'
  | 'checking_backup'
  | 'estimating_size'
  | 'waiting_passcode'
  | 'iphone_preparing'
  | 'transferring'
  | 'reading_messages'
  | 'reading_contacts'
  | 'checking_changes'
  | 'saving_database';

export type SyncStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface SyncStep {
  id: SyncStepId;
  label: string;
  status: SyncStepStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // ms
  error?: string;
  details?: string; // e.g., "46.9 GB found"
}

export interface SyncStepLog {
  steps: SyncStep[];
  currentStepId: SyncStepId | null;
}

export interface LastSyncInfo {
  lastSyncedAt: Date | null;
  backupSizeBytes: number | null;
  messagesCount: number;
  contactsCount: number;
}
```

**Step 1b: Query Last Sync Info**
The last sync info can be retrieved from:
```typescript
// electron/services/iPhoneSyncStorageService.ts
async getLastSyncInfo(userId: string): Promise<LastSyncInfo> {
  const db = databaseService.getRawDatabase();

  // Get message/contact counts from database
  const msgCount = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE user_id = ? AND channel IN ('sms', 'imessage')
  `).get(userId) as { count: number };

  const contactCount = db.prepare(`
    SELECT COUNT(*) as count FROM contacts
    WHERE user_id = ? AND source = 'contacts_app'
  `).get(userId) as { count: number };

  // Get backup size and last modified from file system
  const backupPath = getBackupPath(udid); // from backupService
  const backupStats = await getBackupStats(backupPath);

  return {
    lastSyncedAt: backupStats?.lastModified ?? null,
    backupSizeBytes: backupStats?.totalSize ?? null,
    messagesCount: msgCount.count,
    contactsCount: contactCount.count,
  };
}
```

**Step 2: Emit Step Events from Backend**
Modify `syncOrchestrator.ts` to emit granular step events:
```typescript
this.emit('step', { id: 'connecting', status: 'in_progress' });
// ... do work ...
this.emit('step', { id: 'connecting', status: 'completed', duration: 200 });
```

**Step 3: Track Steps in Frontend**
Add `steps` state to `useIPhoneSync.ts`:
```typescript
const [steps, setSteps] = useState<SyncStep[]>([]);

syncApi.onStep((step) => {
  setSteps(prev => updateStep(prev, step));
});
```

**Step 4: Create Expandable UI Component**
```typescript
// src/components/iphone/SyncStepDetails.tsx
export const SyncStepDetails: React.FC<{ steps: SyncStep[] }> = ({ steps }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Render collapsible step list with icons, labels, durations
};
```

**Step 5: Create Diagnostic Report Generator**
```typescript
// electron/services/diagnosticReportService.ts
export function generateSyncDiagnosticReport(
  steps: SyncStep[],
  device: iOSDevice,
  error?: Error
): string {
  // Collect: app version, platform, device info, step log, error details, recent logs
}
```

**Passcode Detection Heuristic (Confirmed from real logs):**
The "waiting for passcode" step can be detected by:
1. `[BackupService] Starting backup with args` logged
2. `[BackupService] Backup path: ...` logged
3. **No file transfer progress for ~30-60 seconds** (user reported ~1 minute delay)
4. No error reported during this time
5. Transition: When first file transfer begins OR `[BackupService] File completed` appears, mark passcode step complete

**Timing info to show users:**
From the logs, the time between clicking "Sync" and passcode prompt is measurable:
- `20:34:30.706` - Sync started
- `20:36:53.608` - Backup command started (2m 23s for pre-backup checks)
- `~20:37:53` - Passcode prompt appeared (~1 minute after backup started)
- **Total: ~3.5 minutes from sync click to passcode prompt**

This timing can be shown to users: "Preparing sync... This typically takes 2-4 minutes before your iPhone asks for a passcode."

**Files to Create:**
- `electron/types/syncSteps.ts` - Step type definitions
- `src/components/iphone/SyncStepDetails.tsx` - Expandable step list UI
- `src/components/iphone/DiagnosticReport.tsx` - Error report with copy button
- `electron/services/diagnosticReportService.ts` - Report generator

**Files to Modify:**
- `electron/services/syncOrchestrator.ts` - Emit step events at each stage
- `electron/sync-handlers.ts` - Forward step events to renderer
- `electron/preload.ts` - Add `onStep` listener
- `src/hooks/useIPhoneSync.ts` - Track steps state
- `src/components/iphone/SyncProgress.tsx` - Integrate SyncStepDetails
- `src/components/iphone/IPhoneSyncFlow.tsx` - Show diagnostic report on error

**Existing Pattern Reference:**
Check if there's an existing error report component in the codebase that can be reused for consistency.

---

### BACKLOG-024: Auto-Start Sync on App Launch for Returning Users
**Priority:** Medium
**Status:** Pending
**Category:** UX / Convenience

**Description:**
Add a user setting to automatically start iPhone sync when the app launches and a device is connected. This saves returning users from having to manually click "Sync iPhone" every time.

**User Setting:**
- Location: Settings → iPhone Sync
- Option: "Auto-sync when iPhone connected" (toggle, default: OFF)
- Behavior: When enabled and user opens app with iPhone already connected, automatically start sync

**Implementation:**
1. Add `autoSyncOnConnect` preference to user settings
2. On app launch, after session restore:
   - Check if user has iPhone phone type selected
   - Check if `autoSyncOnConnect` is enabled
   - Start device detection
   - If device found within 5 seconds, automatically trigger sync
3. Show toast: "Auto-syncing iPhone... (disable in Settings)"

**Files to Modify:**
- `electron/services/preferencesService.ts` - Add setting
- `src/appCore/state/useAppStateMachine.ts` - Check setting on restore
- `src/components/settings/SettingsModal.tsx` - Add toggle UI

---

### BACKLOG-025: Resume Failed Sync Prompt
**Priority:** Medium
**Status:** Pending
**Category:** UX / Error Recovery

**Description:**
When a user logs in and their last sync failed or was interrupted, prompt them to resume/retry the sync.

**Detection:**
- Store last sync status in database: `last_sync_status` (success/failed/interrupted)
- Store `last_sync_error` message if applicable
- Store `last_sync_timestamp`

**UX Flow:**
1. User logs in
2. System checks `last_sync_status`
3. If failed/interrupted AND within last 24 hours:
   - Show modal: "Your last iPhone sync was interrupted. Would you like to resume?"
   - Options: [Resume Sync] [Dismiss]
4. If "Resume Sync" clicked:
   - Check if iPhone connected
   - If not: "Please connect your iPhone to continue"
   - If yes: Start sync

**Implementation:**
1. Add `sync_sessions` table or columns to track sync state
2. On sync start: record `status = 'in_progress'`
3. On sync complete: update `status = 'success'`
4. On sync error: update `status = 'failed'`, `error = message`
5. On app crash/close during sync: status remains 'in_progress' (detected as interrupted)
6. On login: check for interrupted/failed syncs

---

### BACKLOG-026: Skip Driver Install Check for Returning Users
**Priority:** High
**Status:** Pending
**Category:** UX / Onboarding

**Description:**
Currently the app prompts users to install Apple drivers every time, even if they're already installed. The app DOES check driver status (as seen in logs), but still shows the install screen.

**Current Behavior (from logs):**
```
[DriverHandlers] Apple driver status: {
  isInstalled: true,
  version: '19.0.1.27',
  serviceRunning: true,
  error: null
}
```
Despite `isInstalled: true`, user is still shown the driver install screen.

**Expected Behavior:**
- If `isInstalled: true` AND `serviceRunning: true`: Skip driver setup entirely
- Only show driver screen if drivers need install or update

**Root Cause Investigation:**
Check why `AppleDriverSetup.tsx` is being rendered when drivers are already installed. Likely the navigation logic in `AppRouter.tsx` or `useAppStateMachine.ts` doesn't check the actual driver status before routing to that screen.

**Fix:**
1. On app launch for returning iPhone users:
   - Call `drivers:check-apple` IPC
   - If `{ isInstalled: true, serviceRunning: true }`: Skip to Dashboard
   - If not: Show driver setup screen
2. Store driver check result to avoid repeated checks during session

**Files to Modify:**
- `src/appCore/AppRouter.tsx` - Check driver status before routing
- `src/appCore/state/useAppStateMachine.ts` - Add driver status to state

---

### BACKLOG-027: Skip Mailbox Permission for Already-Authorized Users
**Priority:** Medium
**Status:** Pending
**Category:** UX / Onboarding

**Description:**
If a user has already granted mailbox permissions (OAuth tokens exist and are valid), don't prompt them to connect email again on subsequent logins.

**Current Issue:**
Session-only OAuth means tokens are cleared on app close. User has to re-authorize mailbox every session.

**Options:**

**Option A: Persist Mailbox Tokens (Recommended)**
- Store OAuth refresh tokens encrypted in database
- On login, check for existing valid tokens
- If valid: Skip mailbox connection screen
- If expired: Try refresh, only prompt if refresh fails

**Option B: Remember Authorization State Only**
- Store flag `mailbox_authorized = true` in user preferences
- On login, if flag is true: Skip to Dashboard (assume user will re-auth if needed)
- Lazy re-auth: Only prompt for mailbox when user actually tries to fetch emails

**Consideration:**
Need to balance security (session-only tokens) vs. UX (not re-authorizing every time). Option A is better UX but requires secure token storage.

**Files to Modify:**
- `electron/auth-handlers.ts` - Check for existing valid tokens
- `electron/services/databaseService.ts` - Persist tokens securely (if Option A)
- `src/appCore/state/useAppStateMachine.ts` - Check token validity on restore

---

### BACKLOG-030: Message Parser Async Yielding for Large Databases
**Priority:** Critical
**Status:** Pending
**Category:** Performance

**Description:**
The message parsing phase (`getConversations()` and `getMessages()`) runs synchronously and blocks the main Electron process for large databases (627k+ messages). This causes "App Not Responding" during extraction.

**Root Cause:**
- `iosMessagesParser.getConversations()` runs N+1 queries (one per chat for participants + last message)
- `getMessages()` loads all messages for each conversation synchronously
- With 2000+ conversations and 627k messages, this blocks the event loop

**Symptoms:**
- App shows "Not Responding" after backup completes
- Logs show "Opened database" then nothing for several minutes
- App eventually recovers but UX is poor

**Solution Options:**

**Option A: Async Yielding (like iPhoneSyncStorageService)**
```typescript
async getConversationsAsync(): Promise<iOSConversation[]> {
  const chats = this.db.prepare(...).all();
  const conversations = [];

  for (let i = 0; i < chats.length; i++) {
    // Yield every 50 chats
    if (i % 50 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
    // Process chat...
  }
  return conversations;
}
```

**Option B: Worker Thread**
- Move parsing to a worker thread
- Main thread stays responsive
- More complex but better for truly heavy operations

**Option C: Optimize Queries**
- Use JOINs to get participants and last message in fewer queries
- Batch queries instead of per-chat queries
- Could reduce 4000 queries to ~10

**Recommended:** Option A first (quick win), then Option C (optimization)

**Files to Modify:**
- `electron/services/iosMessagesParser.ts` - Add async versions
- `electron/services/syncOrchestrator.ts` - Use async methods

---

### BACKLOG-028: Create App Logo & Branding Assets
**Priority:** Medium
**Status:** Pending
**Category:** Design / Branding

**Description:**
Create a professional logo and branding assets for Magic Audit. Currently the app may be using placeholder or no logo.

**Assets Needed:**
1. **App Icon** - Multiple sizes for different platforms:
   - Windows: `.ico` file (16x16, 32x32, 48x48, 256x256)
   - macOS: `.icns` file (16x16 to 1024x1024)
   - Taskbar/tray icons (16x16, 24x24)

2. **Logo Variants:**
   - Full logo (icon + text)
   - Icon only (square, for app icon)
   - Horizontal logo (for headers)
   - Light version (for dark backgrounds)
   - Dark version (for light backgrounds)

3. **Splash Screen Assets:**
   - Logo SVG for loading screen (BACKLOG-029)
   - Animated version (optional)

**Design Considerations:**
- Professional look suitable for financial/audit software
- Works well at small sizes (taskbar, favicon)
- Recognizable silhouette
- Colors that work in both light/dark modes
- Consider "MA" monogram or audit-related imagery (checkmark, magnifying glass, document)

**File Locations:**
- `public/logo.svg` - Main logo
- `public/icon.ico` - Windows app icon
- `public/icon.icns` - macOS app icon
- `build/icon.png` - Electron builder icon (512x512 or 1024x1024)

**Tools:**
- Figma/Sketch for design
- Online converters for `.ico`/`.icns` generation
- Or use electron-icon-builder package

---

### BACKLOG-029: App Startup Performance & Loading Screen
**Priority:** Medium
**Status:** Pending
**Category:** Performance / UX

**Description:**
Improve perceived app startup time by showing a loading screen immediately while heavy initialization happens in the background. Currently users may see a blank/white screen while the app initializes database, checks sessions, and loads the UI.

**Current Startup Flow (estimated):**
1. Electron window opens (shows white/blank)
2. React app loads and mounts
3. Database initializes (encryption, migrations)
4. Session restoration (check existing user)
5. API/service initialization
6. First meaningful paint

**Proposed Improvements:**

**Phase 1: Immediate Visual Feedback**
- Add a lightweight splash/loading screen in `index.html` (pure HTML/CSS, no React)
- Shows app logo + subtle loading animation
- Displayed instantly before React bundle loads
- Hide splash once React app is mounted and ready

**Phase 2: Lazy Loading & Code Splitting**
- Split large components into lazy-loaded chunks:
  - Settings modal
  - Transaction flow components
  - iPhone sync components
  - Chart/visualization libraries
- Use `React.lazy()` + `Suspense` for route-based splitting
- Defer non-critical initialization until after first paint

**Phase 3: Background Initialization**
- Show basic UI immediately (shell/skeleton)
- Initialize database in background
- Show "Restoring session..." indicator if needed
- Progressive enhancement as services become ready

**Implementation - Splash Screen:**
```html
<!-- index.html - Add before React root -->
<div id="splash-screen" style="
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 9999;
  transition: opacity 0.3s ease;
">
  <div style="text-align: center; color: white;">
    <img src="./logo.svg" alt="Magic Audit" width="80" />
    <p style="margin-top: 16px; font-size: 14px;">Loading...</p>
  </div>
</div>
```

```typescript
// App.tsx - Hide splash when ready
useEffect(() => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 300);
  }
}, []);
```

**Metrics to Track:**
- Time to first paint (splash visible)
- Time to interactive (app ready)
- Bundle size (main vs lazy chunks)

**Files to Modify:**
- `index.html` - Add splash screen HTML/CSS
- `src/App.tsx` or `src/main.tsx` - Hide splash on mount
- `vite.config.ts` - Configure code splitting
- Various components - Add lazy loading wrappers

**Success Criteria:**
- User sees visual feedback within 100ms of app launch
- Perceived load time feels faster even if total time is similar
- No more blank white screen during startup

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
2024-12-11 - Added BACKLOG-019: Returning User Experience - Skip Phone Selection (Medium priority)
2024-12-11 - Added BACKLOG-020: Device UUID Licensing - Single Device Lock (High priority)
2024-12-11 - Added BACKLOG-021: License Management System (High priority)
2024-12-11 - Added BACKLOG-022: Minimizable iPhone Sync Modal (Medium priority)
2024-12-11 - Added BACKLOG-023: Detailed Sync Progress with Expandable Steps & Error Report (High priority)
2024-12-11 - Added BACKLOG-024: Auto-Start Sync on App Launch for Returning Users (Medium priority)
2024-12-11 - Added BACKLOG-025: Resume Failed Sync Prompt (Medium priority)
2024-12-11 - Added BACKLOG-026: Skip Driver Install Check for Returning Users (High priority)
2024-12-11 - Added BACKLOG-027: Skip Mailbox Permission for Already-Authorized Users (Medium priority)
2024-12-11 - Added BACKLOG-028: Create App Logo & Branding Assets (Medium priority)
2024-12-11 - Added BACKLOG-029: App Startup Performance & Loading Screen (Medium priority)
2024-12-11 - Added BACKLOG-030: Message Parser Async Yielding for Large Databases (Critical priority)
