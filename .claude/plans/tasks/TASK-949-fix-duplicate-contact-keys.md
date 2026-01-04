# Task TASK-949: Fix Duplicate Contact Keys in ImportContactsModal

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Fix the React key collision warning when importing contacts with duplicate names.

## Non-Goals

- Do NOT change the UI of ImportContactsModal
- Do NOT modify contact data structure

## Deliverables

1. Fix in `electron/contact-handlers.ts` - Use unique IDs instead of names

## Acceptance Criteria

- [ ] No "Encountered two children with the same key" warnings
- [ ] Contact import still works correctly
- [ ] Selection behavior works for contacts with same name
- [ ] All existing tests pass

## Root Cause

In `electron/contact-handlers.ts:182`:

```typescript
id: `contacts-app-${contactInfo.name}`, // Bug: names aren't unique!
```

## Fix

Replace with a unique identifier:

```typescript
// Option A: UUID
id: `contacts-app-${crypto.randomUUID()}`,

// Option B: Index + timestamp (if crypto not available)
id: `contacts-app-${Date.now()}-${index}`,
```

## Files to Change

- `electron/contact-handlers.ts:182` - Change ID generation logic

## PR Preparation

- **Title**: `fix(contacts): use unique IDs for imported contacts`
- **Branch From**: `develop`
- **Branch Into**: `develop`
- **Branch Name**: `fix/TASK-949-duplicate-contact-keys`

---

## PM Estimate (PM-Owned)

**Category:** `fix`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED

### Branch Information

- **Branch From:** `develop`
- **Branch Into:** `develop`
- **Branch Name:** `fix/TASK-949-duplicate-contact-keys`

### Priority

**Medium** - Doesn't block release but should be fixed

---

## Implementation Summary (Engineer-Owned)

*To be filled by engineer agent*
