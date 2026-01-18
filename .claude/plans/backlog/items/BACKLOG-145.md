# BACKLOG-145: Duplicate Contact Keys in ImportContactsModal

## Problem

React warning: "Encountered two children with the same key" when importing contacts. Multiple contacts with the same name cause key collisions.

**Reported:** 2026-01-04 during SPRINT-021 manual testing
**Severity:** Medium
**Type:** Bug

## Error Message

```
Warning: Encountered two children with the same key, `contacts-app-Sharanya Jacobs Friend`.
Keys should be unique so that components maintain their identity across updates.
```

## Root Cause

In `electron/contact-handlers.ts:182`:

```typescript
id: `contacts-app-${contactInfo.name}`, // Temporary ID for UI
```

Contact IDs are generated using the contact's name, but names are not unique. Two contacts named "Sharanya Jacobs Friend" will have the same ID.

## Impact

- React may duplicate or omit contacts during rendering
- Selection behavior may be unpredictable
- Console warnings clutter developer experience

## Fix

Use a unique identifier instead of name:

```typescript
// Option A: Use index + name + timestamp
id: `contacts-app-${Date.now()}-${index}-${contactInfo.name}`,

// Option B: Use crypto UUID
id: `contacts-app-${crypto.randomUUID()}`,

// Option C: Hash of all contact fields
id: `contacts-app-${hash(JSON.stringify(contactInfo))}`,
```

## Files to Change

- `electron/contact-handlers.ts:182` - Change ID generation

## Priority

**Medium** - Doesn't block release but causes user-visible issues

## Related

- ImportContactsModal.tsx - Where the error manifests
- BACKLOG-143 (if exists) - Original duplicate contacts import issue
