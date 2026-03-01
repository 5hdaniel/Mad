# BACKLOG-825: Dynamic Contact Source Selection in Onboarding and Sync

**Type:** Feature
**Area:** Electron + UI
**Priority:** Medium
**Status:** Pending
**Created:** 2026-02-27

## Background & Motivation

Discovered during SPRINT-105 (BACKLOG-823 fix) that the contacts sync system has a fundamental coupling problem:

1. **Single sync type for multiple sources:** The `useAutoRefresh` hook pushes a single `'contacts'` sync type which runs BOTH macOS Contacts (Phase 1) and Outlook contacts (Phase 2) sequentially. There's no way to request just one source.

2. **Redundant gating:** The hook gated contacts sync behind `(isMacOS && hasPermissions) || emailConnected`, but the SyncOrchestratorService and IPC handlers already have their own internal guards. This caused contacts sync to be skipped entirely when both conditions were false — even though one source might work independently.

3. **No user choice:** Users are never asked which contact sources they use. The system assumes macOS Contacts + Outlook, but users might use:
   - Only Outlook contacts
   - Only macOS Contacts app
   - Gmail contacts (not yet supported but planned)
   - Both Outlook and Gmail (dual email accounts)
   - Any combination

4. **Settings-only workaround:** Currently the only way to trigger macOS Contacts import is from the Settings page. The sync should handle this automatically based on user preferences.

## Proposed Design

### 1. Onboarding Step: "Where do you save your contacts?"

Add a new step in the onboarding flow AFTER email connection (step 4) and BEFORE data-sync (step 5):

- **Multi-select card buttons** for each source:
  - macOS Contacts App (icon: address book)
  - Outlook / Microsoft 365 (icon: Outlook logo)
  - Gmail / Google Contacts (icon: Google logo) — future
  - "I'll set this up later" skip option

- Selection saves to `contactSources.direct` preferences in Supabase:
  ```json
  {
    "contactSources": {
      "direct": {
        "macosContacts": true,
        "outlookContacts": true,
        "gmailContacts": false
      }
    }
  }
  ```

### 2. Parameterized Sync Types

Change the sync system from a flat string type to a parameterized type:

```typescript
// Current (flat):
type SyncType = 'contacts' | 'emails' | 'messages';
typesToSync.push('contacts'); // always runs ALL sources

// Proposed (parameterized):
type SyncType = 'contacts' | 'emails' | 'messages';
interface SyncRequest {
  type: SyncType;
  sources?: string[]; // optional — if omitted, uses all enabled from preferences
}
typesToSync.push({ type: 'contacts', sources: ['macosContacts', 'outlookContacts'] });
```

### 3. Orchestrator Reads Preferences

The SyncOrchestratorService already partially does this (via `getImportSource` and `isContactSourceEnabled`). Consolidate to:
- Read `contactSources.direct` preferences once at sync start
- Only run phases for enabled sources
- Skip disabled sources without error

### 4. Settings Page Consistency

The Settings page already has source toggles (MacOSContactsImportSettings). Ensure changes there are reflected in the next sync cycle automatically (they already are via preference reads).

## Files to Modify

### New Files
- `src/components/onboarding/steps/ContactSourceStep.tsx` — New onboarding step with multi-select cards

### Modified Files
- `src/components/onboarding/flows/macosFlow.ts` — Add `contact-source` step after `email-connect`
- `src/components/onboarding/flows/windowsFlow.ts` — Add `contact-source` step (Outlook only on Windows)
- `src/services/SyncOrchestratorService.ts` — Read source preferences, conditionally run phases
- `src/hooks/useAutoRefresh.ts` — Pass source preferences to sync request
- `src/components/onboarding/types/steps.ts` — Add new step type

## Current Preference System (For Reference)

The preference system already exists:
- `electron/utils/preferenceHelper.ts` — `isContactSourceEnabled()` checks Supabase preferences
- `contactSources.direct.macosContacts` / `contactSources.direct.outlookContacts` — boolean toggles
- Defaults to `true` (fail-open) if preferences not set
- Settings UI: `src/components/settings/MacOSContactsImportSettings.tsx`

## Dependencies
- BACKLOG-823 / TASK-2092 must be merged first (fixes the syncExternal call) — DONE
- Gmail contacts support would be a separate backlog item (API integration needed)
