# Task TASK-2053: CCPA Data Export

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add CCPA (California Consumer Privacy Act) compliant data export capability. Users can export all their personal data stored in the local SQLite database as a structured JSON file. This satisfies the CCPA "right to know" -- consumers can request a copy of all personal information collected about them.

## Non-Goals

- Do NOT implement CCPA "right to delete" (data deletion). That is a separate feature.
- Do NOT implement GDPR compliance features. CCPA is the priority for US market.
- Do NOT export data from Supabase/cloud. This covers local data only.
- Do NOT export raw database files. Export is structured, human-readable JSON.
- Do NOT export OAuth token values (security risk). Only note their existence.
- Do NOT implement automated CCPA request handling. This is a manual export feature.

## Prerequisites

**Depends on:** TASK-2051 (app:// protocol migration) must be merged first.

**Sprint:** SPRINT-094

**Parallel with:** TASK-2052 (SQLite backup/restore) -- these can run simultaneously.

**Shared files with TASK-2052:** Both modify `electron/handlers/index.ts`, `electron/preload/index.ts`, `src/window.d.ts`, and `src/components/Settings.tsx`. However, they add independent handler registrations, bridge functions, and UI sections. SR Engineer should review for merge conflicts.

## Deliverables

1. **Create:** `electron/services/ccpaExportService.ts` -- Data gathering and JSON export logic
2. **Create:** `electron/handlers/ccpaHandlers.ts` -- IPC handler for data export
3. **Update:** `electron/handlers/index.ts` -- Register new CCPA handler
4. **Update:** `electron/preload/systemBridge.ts` -- Add export IPC channel (or create `privacyBridge.ts`)
5. **Update:** `electron/preload/index.ts` -- Expose privacy API
6. **Update:** `src/window.d.ts` -- Add data export API type definitions
7. **Update:** `src/components/Settings.tsx` -- Add "Privacy" UI section
8. **Create:** Unit tests for `ccpaExportService.ts`

## Acceptance Criteria

- [ ] "Export My Data" button in Settings opens a save dialog and creates a JSON file
- [ ] Export file contains all personal data categories (see Data Categories below)
- [ ] Export file includes metadata (export date, user ID, app version, data categories present)
- [ ] Export file does NOT contain OAuth token values (only notes that tokens exist for each provider)
- [ ] Export file does NOT contain the database encryption key
- [ ] Export file is valid JSON that can be opened in any text editor
- [ ] Export handles empty tables gracefully (category present with empty array)
- [ ] Export shows progress indicator for large datasets
- [ ] Export shows success/failure feedback after completion
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Data Categories (CCPA Mapping)

| CCPA Category | Local Data Source | Table/Service | Include |
|---------------|-------------------|---------------|---------|
| **Identifiers** | User profile (name, email, account ID) | `users` table via `userDbService` | Full records |
| **Commercial Information** | Real estate transactions | `transactions` table via `transactionDbService` | Full records |
| **Contact Information** | Contacts associated with transactions | `contacts` table via `contactDbService` | Full records |
| **Electronic Network Activity** | Email messages, text messages | `messages` table via `communicationDbService` | Full records |
| **Electronic Network Activity** | Email sync history | `emails` table via `emailDbService` | Full records |
| **Inferences** | AI feedback/analysis results | `feedback`, `feedback_learning` tables | Full records |
| **User Preferences** | App settings, preferences | `user_preferences` via `databaseService` | Full records |
| **Audit Trail** | User actions logged | `audit_logs` table via `auditLogDbService` | Full records |
| **Authentication** | Connected accounts | `oauth_tokens` table | Provider + scope only, NOT token values |
| **External Contacts** | Imported contacts (Outlook, Google, etc.) | `external_contacts` via `externalContactDbService` | Full records |

### Export JSON Structure

```json
{
  "metadata": {
    "exportDate": "2026-02-22T15:30:00.000Z",
    "appVersion": "2.3.0",
    "userId": "user-uuid",
    "dataCategories": [
      "identifiers",
      "commercial_information",
      "contacts",
      "electronic_activity",
      "inferences",
      "preferences",
      "audit_trail",
      "authentication",
      "external_contacts"
    ]
  },
  "identifiers": {
    "description": "Personal identification information",
    "records": [
      { "id": "...", "email": "...", "name": "...", "created_at": "..." }
    ]
  },
  "commercial_information": {
    "description": "Real estate transaction records",
    "count": 42,
    "records": [...]
  },
  "contacts": {
    "description": "Contacts associated with your transactions",
    "count": 156,
    "records": [...]
  },
  "electronic_activity": {
    "description": "Email and text message records",
    "messages": {
      "count": 1234,
      "records": [...]
    },
    "emails": {
      "count": 567,
      "records": [...]
    }
  },
  "inferences": {
    "description": "AI-generated analysis and feedback",
    "feedback": [...],
    "feedback_learning": [...]
  },
  "preferences": {
    "description": "Your application settings and preferences",
    "records": [...]
  },
  "audit_trail": {
    "description": "Log of your actions in the application",
    "count": 890,
    "records": [...]
  },
  "authentication": {
    "description": "Connected accounts (token values excluded for security)",
    "connected_providers": [
      { "provider": "google", "scope": "email profile", "created_at": "..." },
      { "provider": "microsoft", "scope": "openid email", "created_at": "..." }
    ]
  },
  "external_contacts": {
    "description": "Contacts imported from external providers",
    "count": 234,
    "records": [...]
  }
}
```

### Service Architecture

```typescript
// electron/services/ccpaExportService.ts
import databaseService from './databaseService';
import { userDb } from './db/userDbService';
import { transactionDb } from './db/transactionDbService';
import { contactDb } from './db/contactDbService';
import { communicationDb } from './db/communicationDbService';
import { emailDb } from './db/emailDbService';
import { auditLogDb } from './db/auditLogDbService';
import { externalContactDb } from './db/externalContactDbService';

export class CcpaExportService {
  /**
   * Export all personal data for the specified user.
   * Returns structured JSON conforming to CCPA categories.
   */
  async exportUserData(
    userId: string,
    onProgress?: (category: string, progress: number) => void
  ): Promise<CcpaExportData> {
    // Gather data from each domain service
    // Call onProgress for UI updates
    // Sanitize sensitive fields (token values)
    // Return structured export object
  }

  /**
   * Write export data to a JSON file.
   */
  async writeExportFile(data: CcpaExportData, filePath: string): Promise<void> {
    // JSON.stringify with indentation for readability
    // Write to file
  }
}
```

### IPC Handler

```typescript
// electron/handlers/ccpaHandlers.ts
ipcMain.handle('privacy:export-data', async (event) => {
  // Get current user ID from session
  // Show save dialog (default filename: magic-audit-data-export-YYYY-MM-DD.json)
  // Call export service with progress callback
  // Send progress events to renderer via webContents.send('privacy:export-progress', ...)
  // Return success/failure
});
```

### UI Design (Settings.tsx)

Add a "Privacy" section to the Settings page:

```
Privacy
-------------------------------------------------
Export Your Data (CCPA)

You have the right to know what personal data is
stored in this application. Click below to export
all your data as a JSON file.

Data included: profile, transactions, contacts,
messages, emails, preferences, and activity logs.
OAuth token values are excluded for security.

[Export My Data]

-------------------------------------------------
```

### Key Files to Examine

- `electron/services/db/` -- All domain-specific database services
- `electron/services/databaseService.ts` -- Facade for data access
- `electron/types/models.ts` -- Data model types (User, Contact, Transaction, Message, etc.)
- `electron/handlers/index.ts` -- Handler registration pattern
- `electron/preload/systemBridge.ts` -- Bridge pattern
- `src/components/Settings.tsx` -- Settings page

### Performance Considerations

For users with large datasets (thousands of messages), the export could be slow. Mitigations:
- Use streaming JSON writing if the file is very large
- Report progress per category to keep UI responsive
- Run data gathering off the main thread if needed (but db access is synchronous in better-sqlite3)
- Set a reasonable limit or paginate very large tables (e.g., messages > 10K records)

## Integration Notes

- Imports from: All `electron/services/db/` domain services, `electron/types/models.ts`
- Exports to: UI via IPC bridge
- Used by: Settings page UI
- Depends on: TASK-2051 (merged first)

## Do / Don't

### Do:
- Include all data categories defined in the CCPA mapping table above
- Exclude OAuth token values (security sensitive)
- Exclude the database encryption key
- Include record counts per category
- Use clear, human-readable category descriptions
- Default export filename: `magic-audit-data-export-YYYY-MM-DD.json`
- Filter file dialog to `.json` files
- Show progress feedback during export
- Handle empty tables (include category with empty array, not omit it)
- Include app version in metadata for future compatibility

### Don't:
- Export raw SQL or database internals
- Include binary data inline (base64-encode if needed, or reference file paths)
- Expose encryption keys or raw token values
- Make the export format proprietary -- use standard JSON
- Skip any data category (even if empty)
- Block the UI during export (use progress events)

## When to Stop and Ask

- If you cannot determine which tables contain user-specific data vs system data
- If the messages table is too large to export as a single JSON array (memory concerns)
- If any domain service lacks a method to retrieve all records for a user
- If the Settings.tsx is too complex to add a section without refactoring
- If you discover personal data stored outside the SQLite database (config files, etc.)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test export includes all required CCPA categories
  - Test export excludes OAuth token values
  - Test export handles empty tables (returns empty arrays, not errors)
  - Test export includes correct metadata (date, version, user ID)
  - Test export JSON is valid and parseable
  - Test export with mock data matches expected structure
  - Test progress callback is called for each category
  - Test IPC handler returns correct success/failure responses

### Coverage

- Coverage impact: Must not decrease; new service should have meaningful coverage

### Integration / Feature Tests

- Required scenarios:
  - Export button creates JSON file at chosen location (manual test)
  - Open exported file in text editor and verify structure (manual test)
  - Verify OAuth token values are NOT present (manual test)
  - Export with large dataset completes without freezing (manual test)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(privacy): add CCPA personal data export capability`
- **Labels**: `feature`, `privacy`, `compliance`, `settings`
- **Depends on**: TASK-2051 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2-3 (service, handlers, possibly bridge) | +15K |
| Files to modify | 4-5 files (index.ts, bridge, window.d.ts, Settings.tsx) | +15K |
| Code volume | ~250-350 lines (service + handlers + UI section) | +10K |
| Test complexity | Medium (mock database services, verify output structure) | +10K |

**Confidence:** Medium-High

**Risk factors:**
- Need to query all domain services; some may lack methods for bulk retrieval
- Large datasets (messages table) could cause memory issues
- Settings.tsx modifications need careful placement

**Similar past tasks:** Service category x0.5 multiplier. Base estimate ~100K applied.

---

## Implementation Summary (Engineer-Owned)

*Completed 2026-02-22*

### Agent ID

```
Engineer Agent ID: agent-ade554bf
```

### Checklist

```
Files created:
- [x] electron/services/ccpaExportService.ts (CCPA data gathering + JSON export)
- [x] electron/handlers/ccpaHandlers.ts (IPC handler for privacy:export-data)
- [x] electron/preload/privacyBridge.ts (preload bridge for privacy API)
- [x] electron/services/__tests__/ccpaExportService.test.ts (18 unit tests)

Files modified:
- [x] electron/handlers/index.ts (export registerCcpaHandlers)
- [x] electron/preload/index.ts (export privacyBridge)
- [x] electron/preload.ts (expose privacy bridge on window.api)
- [x] electron/main.ts (register CCPA handlers)
- [x] electron/types/ipc.ts (add privacy to WindowApi interface)
- [x] src/window.d.ts (add privacy type to MainAPI)
- [x] src/components/Settings.tsx (add Privacy tab + CCPA export UI section)

Features implemented:
- [x] CCPA export service with all 9 data categories
- [x] OAuth token values excluded (only provider/scope/purpose/created_at)
- [x] Structured JSON output with metadata (date, version, userId, categories)
- [x] IPC handler registered (privacy:export-data)
- [x] Preload bridge exposed (window.api.privacy)
- [x] Settings UI section added (Privacy tab with "Export My Data" button)
- [x] Progress indicator during export (category + percentage)
- [x] Error handling for export failures

Verification:
- [x] npm run type-check passes (0 errors)
- [x] npm run lint passes (0 errors)
- [x] npm test passes (18/18 new tests pass; pre-existing integration failures unrelated)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |
| Input Tokens | (auto-captured) |
| Output Tokens | (auto-captured) |
| Cache Read | (auto-captured) |
| Cache Create | (auto-captured) |

**Variance:** PM Est ~50K vs Actual (auto-captured)

### Notes

- Added privacy bridge as a new IPC namespace (`window.api.privacy`) following the same pattern as `resetBridge`
- The CCPA export service queries all 9 data categories: identifiers, commercial_information, contacts, electronic_activity (messages + emails), inferences, preferences, audit_trail, authentication, external_contacts
- OAuth tokens are sanitized to only include provider, scope, purpose, and created_at (NO access_token or refresh_token values)
- The feedback_learning and user_preferences tables are wrapped in try/catch since they may not exist on all installs
- Progress is reported per-category via IPC events back to the renderer
- Settings UI adds a "Privacy" tab between "Data" and "About" with export button, progress bar, and result feedback
- 18 unit tests cover: all categories present, metadata correctness, token sanitization, empty tables, progress callbacks, JSON validity, and file writing
- Pre-existing integration test failure in `transaction-handlers.integration.test.ts` is NOT related to this task (exists on develop)

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~50K | (auto-captured) | (auto-calculated) |
| Duration | - | (auto-captured) | - |

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
