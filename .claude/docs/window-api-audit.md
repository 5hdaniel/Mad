# window.api Usage Audit

**Generated:** 2026-01-11
**Task:** TASK-1027
**Backlog:** BACKLOG-204 (Phase 1 - Architecture Audit)

---

## Summary

This audit documents all direct `window.api` calls in React components and hooks. The goal is to inform future service layer abstraction work per BACKLOG-204.

### Overview

| Domain | Components | Hooks | Total Calls | Service Exists | Migration Complexity |
|--------|------------|-------|-------------|----------------|---------------------|
| transactions | 20 | 6 | 26 | Yes (partial) | Low |
| contacts | 9 | 1 | 10 | Yes | Low |
| auth | 11 | 0 | 11 | Yes | Low |
| system | 13 | 0 | 13 | Yes | Low |
| messages | 4 | 5 | 9 | No | Medium |
| outlook | 11 | 0 | 11 | No | Medium |
| shell | 7 | 0 | 7 | No | Low |
| preferences | 4 | 1 | 5 | Yes (partial) | Low |
| llm | 7 | 0 | 7 | Yes | Low |
| address | 3 | 3 | 6 | Yes | Low |
| feedback | 7 | 1 | 8 | Yes | Low |
| update | 4 | 0 | 4 | No | Medium |
| device | 0 | 1 | 1 | Yes | Low |
| user | 1 | 0 | 1 | Yes (partial) | Low |
| Event Listeners | 16 | 2 | 18 | No | High |

**Total unique window.api call sites:** ~137 (excluding test files)
**Already covered by services:** ~80 (auth, transactions, contacts, system, address, llm, feedback, device, settings)
**Needs service abstraction:** ~57 (messages, outlook, shell, update, event listeners)

---

## Detailed Findings

### Domain: transactions

**Existing Service:** `src/services/transactionService.ts`

The transaction service exists but doesn't cover all API methods. Components still make direct calls for methods not yet wrapped.

| File | Line | Call | Notes |
|------|------|------|-------|
| Transactions.tsx | 141 | `window.api.onTransactionScanProgress(...)` | Event listener, not in service |
| Transactions.tsx | 165 | `window.api.transactions.getAll(userId)` | Covered by `transactionService.getAll()` |
| Transactions.tsx | 195 | `window.api.transactions.scan(userId, {})` | Not in service |
| Transactions.tsx | 219 | `window.api.transactions.cancelScan(userId)` | Not in service |
| Transactions.tsx | 304 | `window.api.transactions.bulkDelete(...)` | Not in service |
| Transactions.tsx | 340 | `window.api.transactions.exportEnhanced(...)` | Not in service |
| Transactions.tsx | 382 | `window.api.transactions.bulkUpdateStatus(...)` | Not in service |
| ExportModal.tsx | 88 | `window.api.transactions.update(...)` | Covered by `transactionService.update()` |
| ExportModal.tsx | 99-109 | `window.api.transactions.exportEnhanced(...)` | Not in service |
| TransactionDetails.tsx | 163 | `window.api.transactions.update(...)` | Covered by `transactionService.update()` |
| TransactionDetails.tsx | 173 | `window.api.transactions.delete(...)` | Covered by `transactionService.delete()` |
| useTransactionDetails.ts | 63 | `window.api.transactions.getDetails(...)` | Covered by `transactionService.getDetails()` |
| useTransactionDetails.ts | 126 | `window.api.transactions.update(...)` | Covered by `transactionService.update()` |
| useTransactionAttachments.ts | 93 | `window.api.transactions.getDetails(...)` | Covered by `transactionService.getDetails()` |
| useTransactionMessages.ts | 42 | `window.api.transactions.getDetails(...)` | Covered by `transactionService.getDetails()` |
| useSuggestedContacts.ts | 76 | `window.api.transactions.assignContact(...)` | Not in service |
| useSuggestedContacts.ts | 204 | `window.api.transactions.assignContact(...)` | Not in service |
| useTransactionCommunications.ts | 40 | `window.api.transactions.unlinkCommunication(...)` | Not in service |
| useTransactionList.ts | 59 | `window.api.transactions.getAll(userId)` | Covered by `transactionService.getAll()` |
| useTransactionScan.ts | 54 | `window.api.onTransactionScanProgress(...)` | Event listener |
| useTransactionScan.ts | 71 | `window.api.transactions.scan(...)` | Not in service |
| useTransactionScan.ts | 104 | `window.api.transactions.cancelScan(...)` | Not in service |
| useBulkActions.ts | 76 | `window.api.transactions.bulkDelete(...)` | Not in service |
| useBulkActions.ts | 120 | `window.api.transactions.exportEnhanced(...)` | Not in service |
| useBulkActions.ts | 170 | `window.api.transactions.bulkUpdateStatus(...)` | Not in service |
| EditTransactionModal.tsx | 103, 195, 199, 264 | Various transaction calls | Mixed coverage |
| TransactionMessagesTab.tsx | 179 | `window.api.transactions.unlinkMessages(...)` | Not in service |
| AttachMessagesModal.tsx | 253, 300, 409 | Various transaction calls | Not in service |
| usePendingTransactions.ts | 41 | `window.api.transactions.getAll(...)` | Covered by service |
| usePendingTransactionCount.ts | 41 | `window.api.transactions.getAll(...)` | Covered by service |
| useAuditTransaction.ts | 450-472 | Various transaction calls | Mixed coverage |

**Service Gap:** Needs methods for `scan`, `cancelScan`, `bulkDelete`, `bulkUpdateStatus`, `exportEnhanced`, `assignContact`, `unlinkCommunication`, `unlinkMessages`, `linkMessages`, `batchUpdateContacts`, `getMessageContacts`, `getMessagesByContact`.

---

### Domain: contacts

**Existing Service:** `src/services/contactService.ts`

The contact service has good coverage. Most direct calls can be easily migrated.

| File | Line | Call | Notes |
|------|------|------|-------|
| useContactList.ts | 39 | `window.api.contacts.getAll(userId)` | Covered by `contactService.getAll()` |
| useContactList.ts | 62 | `window.api.contacts.checkCanDelete(...)` | Covered by `contactService.checkCanDelete()` |
| useContactList.ts | 91 | `window.api.contacts.remove(...)` | Covered by `contactService.remove()` |
| ContactFormModal.tsx | 48 | `window.api.contacts.update(...)` | Covered by `contactService.update()` |
| ContactFormModal.tsx | 54 | `window.api.contacts.create(...)` | Covered by `contactService.create()` |
| RoleAssignment.tsx | 65 | `window.api.contacts.getSortedByActivity(...)` | Covered by `contactService.getSortedByActivity()` |
| RoleAssignment.tsx | 69 | `window.api.contacts.getAll(userId)` | Covered by `contactService.getAll()` |
| EditTransactionModal.tsx | 642-643 | `window.api.contacts.getSortedByActivity/getAll` | Covered by service |
| ImportContactsModal.tsx | 37 | `window.api.contacts.getAvailable(userId)` | Covered by `contactService.getAvailable()` |
| ImportContactsModal.tsx | 78 | `window.api.contacts.import(...)` | Covered by `contactService.import()` |
| TransactionMessagesTab.tsx | 109 | `window.api.contacts.getNamesByPhones(...)` | Not in service |
| PermissionsStep.tsx | 219, 281, 288 | Various contact calls (via `as any`) | Type issues, partial coverage |
| useAutoRefresh.ts | 374 | `window.api.contacts.getAll(uid)` | Covered by service |

**Service Gap:** Needs `getNamesByPhones` method. Also needs type cleanup for `onImportProgress` event.

---

### Domain: auth

**Existing Service:** `src/services/authService.ts`

Comprehensive service coverage. Most components should migrate easily.

| File | Line | Call | Notes |
|------|------|------|-------|
| Login.tsx | 134 | `window.api.auth.googleLogin()` | Covered by `authService.googleLogin()` |
| Login.tsx | 236 | `window.api.auth.microsoftLogin()` | Covered by `authService.microsoftLogin()` |
| Login.tsx | 275 | `window.api.auth.googleCompleteLogin(...)` | Covered by `authService.googleCompleteLogin()` |
| Login.tsx | 277 | `window.api.auth.microsoftCompleteLogin(...)` | Covered by `authService.microsoftCompleteLogin()` |
| Settings.tsx | 167 | `window.api.auth.googleConnectMailbox(userId)` | Covered by `authService.googleConnectMailbox()` |
| Settings.tsx | 192 | `window.api.auth.microsoftConnectMailbox(userId)` | Covered by `authService.microsoftConnectMailbox()` |
| Settings.tsx | 216 | `window.api.auth.googleDisconnectMailbox(userId)` | Covered by `authService.googleDisconnectMailbox()` |
| Settings.tsx | 230 | `window.api.auth.microsoftDisconnectMailbox(userId)` | Covered by `authService.microsoftDisconnectMailbox()` |
| SystemHealthMonitor.tsx | 92 | `window.api.auth.googleConnectMailbox(userId)` | Covered by service |
| SystemHealthMonitor.tsx | 117 | `window.api.auth.microsoftConnectMailbox(userId)` | Covered by service |

**Service Gap:** None - full coverage available.

---

### Domain: system

**Existing Service:** `src/services/systemService.ts`

Good coverage. A few edge calls need migration.

| File | Line | Call | Notes |
|------|------|------|-------|
| ErrorBoundary.tsx | 59 | `window.api.system.getDiagnostics()` | Covered by `systemService.getDiagnostics()` |
| ErrorBoundary.tsx | 134 | `window.api.system.contactSupport(...)` | Covered by `systemService.contactSupport()` |
| PermissionsStep.tsx | 314 | `window.api.system.checkPermissions()` | Covered by `systemService.checkAllPermissions()` |
| PermissionsStep.tsx | 345 | `window.api.system.openSystemSettings()` | Not in service |
| PermissionsStep.tsx | 442 | `window.api.system.triggerFullDiskAccess()` | Not in service |
| OfflineFallback.tsx | 69 | `window.api.system.getDiagnostics()` | Covered by service |
| OfflineFallback.tsx | 81 | `window.api.system.contactSupport(...)` | Covered by service |
| SystemHealthMonitor.tsx | 48 | `window.api.system.healthCheck(...)` | Covered by `systemService.healthCheck()` |
| SystemHealthMonitor.tsx | 84 | `window.api.system.openPrivacyPane(...)` | Covered by `systemService.openPrivacyPane()` |
| Settings.tsx | 72 | `window.api.system.checkAllConnections(...)` | Covered by `systemService.checkAllConnections()` |
| Profile.tsx | 79-80 | `window.api.system.checkGoogle/MicrosoftConnection(...)` | Covered by service |
| ExportSuccessMessage.tsx | 22 | `window.api.system` (dynamic) | Edge case |
| RoleAssignment.tsx | 170 | `window.api.system.openPrivacyPane(...)` | Covered by service |

**Service Gap:** Needs `openSystemSettings`, `triggerFullDiskAccess` methods.

---

### Domain: messages

**Existing Service:** None

This is a significant gap. Messages API is used for macOS iMessage import functionality.

| File | Line | Call | Notes |
|------|------|------|-------|
| PermissionsStep.tsx | 215 | `window.api.messages.onImportProgress(...)` | Event listener |
| PermissionsStep.tsx | 263 | `window.api.messages.importMacOSMessages(userId)` | Import function |
| MacOSMessagesImportSettings.tsx | 42 | `window.api.messages.onImportProgress(...)` | Event listener |
| MacOSMessagesImportSettings.tsx | 59 | `window.api.messages.importMacOSMessages(...)` | Import function |
| ConversationList/index.tsx | 99 | `window.api.messages.exportConversations(...)` | Export function |
| ConversationViewModal.tsx | 236 | `window.api.messages.getMessageAttachmentsBatch(...)` | Get attachments |
| useConversations.ts | 62 | `window.api.messages.getConversations()` | Get all conversations |
| useMacOSMessagesImport.ts | 60 | `window.api.messages.importMacOSMessages(userId)` | Import function |
| useAutoRefresh.ts | 163 | `window.api.messages.onImportProgress(...)` | Event listener |
| useAutoRefresh.ts | 327 | `window.api.messages.importMacOSMessages(uid)` | Import function |

**Recommendation:** Create `messageService.ts` with methods for `importMacOSMessages`, `getConversations`, `exportConversations`, `getMessageAttachmentsBatch` and event handling.

---

### Domain: outlook

**Existing Service:** None

Outlook integration for email export functionality.

| File | Line | Call | Notes |
|------|------|------|-------|
| MicrosoftLogin.tsx | 42 | `window.api.outlook.initialize()` | Initialize Outlook |
| MicrosoftLogin.tsx | 52 | `window.api.outlook.isAuthenticated()` | Check auth status |
| MicrosoftLogin.tsx | 55 | `window.api.outlook.getUserEmail()` | Get user email |
| MicrosoftLogin.tsx | 91-92 | `window.api.outlook.onDeviceCode(...)` | Event listener |
| MicrosoftLogin.tsx | 96 | `window.api.outlook.authenticate()` | Authenticate |
| OutlookExport.tsx | 70-71 | `window.api.outlook.onExportProgress(...)` | Event listener |
| OutlookExport.tsx | 85 | `window.api.outlook.initialize()` | Initialize |
| OutlookExport.tsx | 93 | `window.api.outlook.isAuthenticated()` | Check auth |
| OutlookExport.tsx | 108 | `window.api.outlook.getUserEmail()` | Get email |
| OutlookExport.tsx | 123 | `window.api.outlook.authenticate()` | Authenticate |
| OutlookExport.tsx | 158 | `window.api.outlook.exportEmails(...)` | Export emails |

**Recommendation:** Create `outlookService.ts` with methods for initialization, authentication, email retrieval, and export.

---

### Domain: shell

**Existing Service:** None

Shell operations for opening external URLs/folders.

| File | Line | Call | Notes |
|------|------|------|-------|
| ErrorBoundary.tsx | 140 | `window.api.shell.openExternal(...)` | Open URL |
| Login.tsx | 457 | `window.api.shell.openExternal(authUrl)` | Open auth URL |
| OfflineFallback.tsx | 87 | `window.api.shell.openExternal(...)` | Open URL |
| OutlookExport.tsx | 176 | `window.api.shell.openFolder(...)` | Open folder |
| MoveAppPrompt.tsx | 26 | `window.api.shell.openFolder("/Applications")` | Open Applications |
| ExportComplete.tsx | 138 | `window.api.shell.openFolder(...)` | Open export folder |
| EmailViewModal.tsx | 112 | `window.api.shell.openExternal(href)` | Open link |

**Recommendation:** Create `shellService.ts` with `openExternal` and `openFolder` methods. Simple, low-complexity migration.

---

### Domain: preferences

**Existing Service:** `src/services/settingsService.ts` (partial)

Settings service covers preferences but components still make direct calls.

| File | Line | Call | Notes |
|------|------|------|-------|
| ExportModal.tsx | 52 | `window.api.preferences.get(userId)` | Covered by `settingsService.getPreferences()` |
| Settings.tsx | 90 | `window.api.preferences.get(userId)` | Covered by service |
| Settings.tsx | 120 | `window.api.preferences.update(userId, {...})` | Covered by `settingsService.updatePreferences()` |
| Settings.tsx | 134 | `window.api.preferences.update(...)` | Covered by service |
| Settings.tsx | 152 | `window.api.preferences.update(...)` | Covered by service |
| useAutoRefresh.ts | 254 | `window.api.preferences.get(userId)` | Covered by service |

**Service Gap:** None - full coverage available.

---

### Domain: llm

**Existing Service:** `src/services/llmService.ts`

Full coverage available for LLM configuration.

| File | Line | Call | Notes |
|------|------|------|-------|
| LLMSettings.tsx | 471 | `window.api.llm.getConfig(userId)` | Covered by `llmService.getConfig()` |
| LLMSettings.tsx | 472 | `window.api.llm.getUsage(userId)` | Covered by `llmService.getUsage()` |
| LLMSettings.tsx | 515 | `window.api.llm.validateKey(provider, key)` | Covered by `llmService.validateKey()` |
| LLMSettings.tsx | 528 | `window.api.llm.setApiKey(...)` | Covered by `llmService.setApiKey()` |
| LLMSettings.tsx | 547 | `window.api.llm.removeApiKey(...)` | Covered by `llmService.removeApiKey()` |
| LLMSettings.tsx | 576 | `window.api.llm.updatePreferences(...)` | Covered by `llmService.updatePreferences()` |
| LLMSettings.tsx | 588 | `window.api.llm.recordConsent(...)` | Covered by `llmService.recordConsent()` |

**Service Gap:** None - full coverage available.

---

### Domain: address

**Existing Service:** `src/services/addressService.ts`

Full coverage for address autocomplete and geocoding.

| File | Line | Call | Notes |
|------|------|------|-------|
| useAuditTransaction.ts | 157 | `window.api.address.initialize("")` | Covered by `addressService.initialize()` |
| useAuditTransaction.ts | 241 | `window.api.address.getSuggestions(...)` | Covered by `addressService.getSuggestions()` |
| useAuditTransaction.ts | 274 | `window.api.address.getDetails(placeId)` | Covered by `addressService.getDetails()` |

**Service Gap:** None - full coverage available.

---

### Domain: feedback

**Existing Service:** `src/services/feedbackService.ts`

Full coverage for AI feedback functionality.

| File | Line | Call | Notes |
|------|------|------|-------|
| useAuditTransaction.ts | 456-457 | `window.api.feedback.recordTransaction(...)` | Covered by `feedbackService.recordTransaction()` |
| useSuggestedContacts.ts | 86-87 | `window.api.feedback.recordRole(...)` | Covered by `feedbackService.recordRole()` |
| useSuggestedContacts.ts | 145-146 | `window.api.feedback.recordRole(...)` | Covered by service |
| useSuggestedContacts.ts | 214-215 | `window.api.feedback.recordRole(...)` | Covered by service |

**Service Gap:** None - full coverage available.

---

### Domain: update

**Existing Service:** None

Auto-update notifications and installation.

| File | Line | Call | Notes |
|------|------|------|-------|
| UpdateNotification.tsx | 16 | `window.api.update.onAvailable(...)` | Event listener |
| UpdateNotification.tsx | 23 | `window.api.update.onProgress(...)` | Event listener |
| UpdateNotification.tsx | 29 | `window.api.update.onDownloaded(...)` | Event listener |
| UpdateNotification.tsx | 37 | `window.api.update.install()` | Install update |

**Recommendation:** Create `updateService.ts` with methods for checking updates, event handling, and installation.

---

### Domain: Event Listeners (Top-Level)

**Existing Service:** None

These are IPC event listeners attached directly to `window.api`. They require special handling for cleanup.

| File | Line | Call | Notes |
|------|------|------|-------|
| Login.tsx | 79-80 | `window.api.onGoogleLoginComplete(...)` | Auth event |
| Login.tsx | 108-109 | `window.api.onGoogleLoginPending(...)` | Auth event |
| Login.tsx | 125-126 | `window.api.onGoogleLoginCancelled(...)` | Auth event |
| Login.tsx | 181-182 | `window.api.onMicrosoftLoginComplete(...)` | Auth event |
| Login.tsx | 210-211 | `window.api.onMicrosoftLoginPending(...)` | Auth event |
| Login.tsx | 227-228 | `window.api.onMicrosoftLoginCancelled(...)` | Auth event |
| Settings.tsx | 171 | `window.api.onGoogleMailboxConnected(...)` | Mailbox event |
| Settings.tsx | 196 | `window.api.onMicrosoftMailboxConnected(...)` | Mailbox event |
| SystemHealthMonitor.tsx | 96 | `window.api.onGoogleMailboxConnected(...)` | Mailbox event |
| SystemHealthMonitor.tsx | 121 | `window.api.onMicrosoftMailboxConnected(...)` | Mailbox event |
| Transactions.tsx | 141 | `window.api.onTransactionScanProgress(...)` | Scan progress |
| useIPhoneSync.ts | 157 | `window.api.device.startDetection` | Device detection |
| useIPhoneSync.ts | 165 | `window.api.device.stopDetection` | Device detection |
| useAutoRefresh.ts | 163 | `window.api.messages.onImportProgress(...)` | Import progress |
| useAutoRefresh.ts | 205 | `window.api.contacts.onImportProgress` (via `as any`) | Contact import |

**Recommendation:** Event listener patterns should be standardized. Consider:
1. Adding event listener methods to existing services
2. Creating a centralized `eventService.ts` for cross-cutting events
3. Using React hooks that encapsulate subscription/cleanup patterns

---

## Recommendations

### Priority 1: High-Impact Services (Create New)

1. **messageService.ts** (9 calls)
   - Core iMessage functionality
   - Methods: `importMacOSMessages`, `getConversations`, `exportConversations`, `getMessageAttachmentsBatch`
   - Event handlers for import progress
   - Estimated effort: 2-3 hours

2. **outlookService.ts** (11 calls)
   - Email export integration
   - Methods: `initialize`, `isAuthenticated`, `authenticate`, `getUserEmail`, `exportEmails`
   - Event handlers for device code and export progress
   - Estimated effort: 2-3 hours

3. **shellService.ts** (7 calls)
   - Simple utility service
   - Methods: `openExternal`, `openFolder`
   - Estimated effort: 30 minutes

4. **updateService.ts** (4 calls)
   - Auto-update functionality
   - Methods: `install`, event handlers for available/progress/downloaded
   - Estimated effort: 1 hour

### Priority 2: Extend Existing Services

1. **transactionService.ts** (add ~12 methods)
   - Missing: `scan`, `cancelScan`, `bulkDelete`, `bulkUpdateStatus`, `exportEnhanced`, `assignContact`, `unlinkCommunication`, `unlinkMessages`, `linkMessages`, `batchUpdateContacts`, `getMessageContacts`, `getMessagesByContact`
   - Estimated effort: 2-3 hours

2. **systemService.ts** (add 2 methods)
   - Missing: `openSystemSettings`, `triggerFullDiskAccess`
   - Estimated effort: 30 minutes

3. **contactService.ts** (add 1 method)
   - Missing: `getNamesByPhones`
   - Estimated effort: 15 minutes

### Priority 3: Migrate Components (After Service Work)

After services are complete, migrate components in this order:

1. **High-traffic components first:**
   - `Transactions.tsx` (6 direct calls)
   - `Settings.tsx` (9 direct calls)
   - `Login.tsx` (11 direct calls + events)

2. **Hooks with multiple calls:**
   - `useAutoRefresh.ts` (6 direct calls)
   - `useAuditTransaction.ts` (6 direct calls)
   - `useSuggestedContacts.ts` (5 direct calls)

3. **Remaining components** in alphabetical order

### Priority 4: Event Listener Standardization

Create a consistent pattern for IPC event subscriptions:
- Move event listeners into services where possible
- Create custom React hooks that handle subscription/cleanup
- Document the pattern for future development

---

## Total Effort Estimate

| Task | Estimated Effort |
|------|------------------|
| Create new services (4) | 6-7 hours |
| Extend existing services (3) | 3-4 hours |
| Migrate components (~15 files) | 4-6 hours |
| Event listener refactoring | 2-3 hours |
| Testing and validation | 2-3 hours |
| **Total** | **17-23 hours** |

---

## Next Steps

1. Review this audit with the team
2. Prioritize based on upcoming feature work
3. Create Phase 2 tasks for service creation (TASK-1028+)
4. Create Phase 3 tasks for component migration (TASK-1035+)
5. Update architecture guardrails to enforce service usage
