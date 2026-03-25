# TASK-2320: Auto-Assign Default Roles to Contacts Based on Prior Transactions

**Backlog ID:** BACKLOG-1355
**Sprint:** SPRINT-P
**Branch:** `feature/task-2320-auto-assign-contact-roles`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~40K (feature, multi-layer: schema + service + UI)
**Status:** Pending

---

## Objective

Save each contact's last-used role from transaction assignment and auto-fill that role when the same contact is added to a new transaction. This reduces repetitive role selection for returning contacts.

---

## Context

### Current State
- Contacts are stored in `contacts` table (SQLite) with fields: id, user_id, display_name, company, title, source, etc.
- Transaction-contact relationships are in `transaction_contacts` table with: transaction_id, contact_id, role, role_category, specific_role
- When a user adds a contact to a new transaction, they must manually select the role every time
- Roles are defined in `src/constants/contactRoles.ts` (SPECIFIC_ROLES)
- Contact assignment happens in `src/components/audit/ContactAssignmentStep.tsx` and `src/components/shared/RoleAssigner.tsx`

### Data Model
The `contacts` table does NOT currently have a `preferred_role` or `last_role` column.
The `transaction_contacts` table already stores the role for each contact in each transaction.

### Two Approaches

**Option A (Simpler): Query last-used role from `transaction_contacts` at assignment time**
- No schema change needed
- Query: `SELECT specific_role FROM transaction_contacts WHERE contact_id = ? ORDER BY created_at DESC LIMIT 1`
- Pros: No migration, uses existing data
- Cons: Requires a query per contact when populating the role selector

**Option B (Denormalized): Add `preferred_role` column to `contacts` table**
- Requires SQLite migration
- Updated whenever a contact is assigned to a transaction
- Pros: Fast lookup, single column read
- Cons: Data duplication, migration needed

**Recommendation: Option A** -- simpler, no migration, leverages existing data. The query is fast (indexed on contact_id) and only runs when a user is actively assigning contacts.

---

## Requirements

### Must Do:

**Backend (Electron service layer):**

1. Add a new IPC handler `contacts:get-last-role` (or extend existing contact query) that:
   - Accepts a `contact_id` parameter
   - Queries `transaction_contacts` for the most recent role used for that contact
   - Returns `{ role: string | null, specific_role: string | null, role_category: string | null }`
   - Query: `SELECT role, specific_role, role_category FROM transaction_contacts WHERE contact_id = ? ORDER BY created_at DESC LIMIT 1`

2. Alternatively, add a batch version `contacts:get-last-roles` that accepts an array of contact_ids and returns a map of `{ [contactId]: { role, specific_role, role_category } }` -- more efficient for the assignment step which shows multiple contacts.

**Frontend (React UI):**

3. In the contact assignment flow (ContactAssignmentStep or RoleAssigner), when a contact is selected/added to a role slot:
   - Query the contact's last-used role
   - If a last-used role exists, pre-select it in the role dropdown
   - If no last-used role, leave the dropdown at its default (no selection / "Select role")
   - The user can always change the pre-selected role

4. Show a subtle indicator when a role is auto-filled, e.g.:
   - Small text "(last used)" next to the pre-selected role
   - Or a different background color briefly (subtle highlight)
   - This helps the user know the role was auto-filled vs. manually set

### Must NOT Do:
- Do NOT add new columns to the `contacts` table (use Option A - query approach)
- Do NOT auto-assign roles without showing them to the user (always pre-select, never auto-commit)
- Do NOT change the available role list or role constants
- Do NOT modify the transaction_contacts table schema
- Do NOT affect the role assignment for contacts that have never been used in a transaction

---

## Acceptance Criteria

- [ ] When adding a contact to a new transaction, their last-used role is pre-selected
- [ ] The pre-selected role can be changed by the user
- [ ] Contacts with no prior transactions show no pre-selected role (default behavior)
- [ ] The auto-fill is based on the MOST RECENT transaction, not the most common role
- [ ] A subtle "(last used)" or similar indicator shows when role is auto-filled
- [ ] The feature works for all role types (specific_role values from contactRoles.ts)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

### Electron (Backend)
- `electron/handlers/contactHandlers.ts` -- Add `contacts:get-last-roles` IPC handler
- `electron/services/db/contactDbService.ts` -- Add query method for last-used roles
- `electron/preload/contactBridge.ts` -- Expose the new IPC channel
- `electron/types/ipc/window-api-contacts.ts` -- Add type for the new API

### React (Frontend)
- `src/components/shared/RoleAssigner.tsx` -- Pre-select role when contact is assigned
- OR `src/components/audit/ContactAssignmentStep.tsx` -- Fetch and pass last-used roles
- `src/components/shared/ContactRoleRow.tsx` -- Show "(last used)" indicator if role was auto-filled

## Files to Read (for context)

- `electron/database/schema.sql` -- `contacts` and `transaction_contacts` table definitions
- `src/constants/contactRoles.ts` -- Role constants and display names
- `src/utils/transactionRoleUtils.ts` -- Role utility functions
- `src/components/shared/RoleAssigner.tsx` -- Current role assignment UI
- `src/components/shared/ContactRoleRow.tsx` -- Individual contact-role row rendering
- `src/components/audit/ContactAssignmentStep.tsx` -- The wizard step for contact assignment
- `src/components/shared/ContactSelector.tsx` -- Contact selection/search component
- `electron/handlers/contactHandlers.ts` -- Existing contact IPC handlers
- `electron/services/db/contactDbService.ts` -- Existing contact DB methods

---

## Implementation Notes

### IPC Handler Pattern

Follow existing patterns in `contactHandlers.ts`:

```typescript
ipcMain.handle(
  "contacts:get-last-roles",
  async (_event: IpcMainInvokeEvent, contactIds: string[]): Promise<Record<string, LastUsedRole | null>> => {
    // Query transaction_contacts for each contact's most recent role
    const results: Record<string, LastUsedRole | null> = {};
    for (const contactId of contactIds) {
      const row = db.prepare(`
        SELECT role, specific_role, role_category
        FROM transaction_contacts
        WHERE contact_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(contactId);
      results[contactId] = row ? { role: row.role, specificRole: row.specific_role, roleCategory: row.role_category } : null;
    }
    return results;
  }
);
```

### Frontend Integration

In the component where contacts are assigned to roles:

```typescript
// Fetch last-used roles when contacts are loaded
const [lastUsedRoles, setLastUsedRoles] = useState<Record<string, LastUsedRole | null>>({});

useEffect(() => {
  const contactIds = selectedContacts.map(c => c.id);
  if (contactIds.length > 0) {
    window.api.contacts.getLastRoles(contactIds).then(setLastUsedRoles);
  }
}, [selectedContacts]);

// When rendering role selector, use last-used role as default
const defaultRole = lastUsedRoles[contact.id]?.specificRole ?? '';
```

---

## Testing Expectations

### Unit Tests
- **Required:** Test the `getLastRoles` DB query in `contactDbService.test.ts` or `contactHandlers.test.ts`
  - Test with contact that has prior transactions (returns most recent role)
  - Test with contact that has no prior transactions (returns null)
  - Test with multiple contacts (batch query)
- **Frontend:** Test that RoleAssigner/ContactAssignmentStep pre-selects the role when provided

### Manual Testing
1. Add a contact to a transaction with a specific role (e.g., "Buyer Agent")
2. Create a new transaction, add the same contact
3. Verify the role dropdown pre-selects "Buyer Agent"
4. Verify "(last used)" indicator appears
5. Change the role to something else, save
6. Create another new transaction -- verify the NEW role is now pre-selected
7. Test with a brand new contact -- verify no auto-fill happens

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## PR Preparation

- **Title:** `feat: auto-assign last-used roles to contacts in new transactions (BACKLOG-1355)`
- **Branch:** `feature/task-2320-auto-assign-contact-roles`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely
- [ ] Read existing contact handler patterns

Implementation:
- [ ] IPC handler created for contacts:get-last-roles
- [ ] DB query method added
- [ ] Preload bridge updated
- [ ] Window API types updated
- [ ] Frontend role pre-selection working
- [ ] "(last used)" indicator showing
- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass (new + existing)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested
```

### Results

- **Before**: Contacts always default to no role when added to transactions
- **After**: Contacts auto-fill their last-used role with user ability to change
- **Actual Tokens**: ~XK (Est: 40K)
- **PR**: [URL after PR created]

---

## Guardrails

**STOP and ask PM if:**
- The `transaction_contacts` table is not indexed on `contact_id` (performance concern for the query)
- The role assignment UI uses a different pattern than described (not a simple dropdown)
- The contact assignment step renders differently depending on transaction type (purchase vs sale)
- There are more than 5 files that need modification in the frontend
- You discover the role pre-selection would require changing shared components used outside of transaction creation
