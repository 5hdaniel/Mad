# File Lifecycle Protocol

This document defines the mandatory process for handling files during refactoring, replacement, and deprecation.

---

## Core Principle

**When you replace a file, delete the old file in the same PR.**

Git history preserves all deleted files indefinitely. There is no need for:
- ❌ `_deprecated/` folders (creates clutter, never cleaned)
- ❌ `@deprecated` comments on entire files (delays cleanup)
- ❌ Separate cleanup tasks (they get forgotten)

---

## Refactor Checklist (MANDATORY)

When any task involves refactoring, extracting, or replacing files:

### For Engineer (During Implementation)

```markdown
## File Lifecycle Check

### New Files Created
- [ ] `path/to/new/File.tsx`
- [ ] `path/to/new/OtherFile.tsx`

### Files Replaced (MUST DELETE)
- [ ] `old/path/OldFile.tsx` → DELETED (replaced by `new/path/NewFile.tsx`)
- [ ] `old/path/OtherOld.tsx` → DELETED (replaced by `new/path/Other.tsx`)

### Associated Test Files
- [ ] Old test deleted: `old/__tests__/OldFile.test.tsx`
- [ ] New test created: `new/__tests__/NewFile.test.tsx`

### Verification
- [ ] `npm run type-check` passes (no dangling imports)
- [ ] `npm test` passes (no missing test subjects)
- [ ] No files importing the deleted files
```

### For SR Engineer (During PR Review)

Add to PR review checklist:

```markdown
## File Lifecycle Review

- [ ] **Orphan Check**: No replaced files left behind
- [ ] **Import Check**: No dangling imports to deleted files
- [ ] **Test Check**: Old tests removed, new tests added
- [ ] **Export Check**: No barrel exports referencing deleted files
```

---

## Detection Commands

### Find Orphaned Files (Run Before PR)

```bash
# Check for files with zero imports (excluding entry points and tests)
# Engineer should run this for any refactor task

# Find component files not imported anywhere
for file in src/components/*.tsx; do
  basename=$(basename "$file" .tsx)
  if ! grep -r "from.*$basename" src/ --include="*.tsx" --include="*.ts" | grep -v "$file" > /dev/null; then
    echo "POSSIBLY ORPHANED: $file"
  fi
done
```

### Quick Grep Check

```bash
# Check if a specific file is imported anywhere
grep -r "ContactDetails" src/ --include="*.tsx" --include="*.ts"
# If only self-references → ORPHANED
```

---

## Task Types Requiring This Protocol

| Task Type | File Lifecycle Check Required |
|-----------|------------------------------|
| Component extraction | ✅ Yes - delete original if fully extracted |
| Hook extraction | ✅ Yes - delete original if fully extracted |
| Service refactor | ✅ Yes - delete old service files |
| Directory restructure | ✅ Yes - delete files moved to new locations |
| Feature replacement | ✅ Yes - delete old feature files |
| Bug fix | ❌ No - typically modifies, doesn't replace |
| New feature | ❌ No - only adds files |

---

## Examples

### Good: Contacts Refactor (TASK-606)

```
PR includes:
+ src/components/contact/Contacts.tsx (new, extracted)
+ src/components/contact/components/ContactCard.tsx (new)
+ src/components/contact/hooks/useContactList.ts (new)
- src/components/ContactDetails.tsx (DELETED - replaced)
- src/components/ContactList.tsx (DELETED - replaced)
- src/components/__tests__/ContactDetails.test.tsx (DELETED)
```

### Bad: What Actually Happened

```
PR includes:
+ src/components/contact/Contacts.tsx (new, extracted)
+ src/components/contact/components/ContactCard.tsx (new)
+ src/components/contact/hooks/useContactList.ts (new)
# OLD FILES LEFT BEHIND - VIOLATION
# src/components/ContactDetails.tsx still exists
# src/components/ContactList.tsx still exists
```

---

## Violation Handling

### If Orphaned Files Found During PR Review

1. **SR Engineer blocks PR**
2. Engineer adds deletions to PR
3. Re-run verification
4. Proceed with merge

### If Orphaned Files Found Post-Merge

1. Create immediate cleanup task (e.g., TASK-618)
2. Priority: LOW (but do not defer beyond current sprint)
3. Add root cause to sprint retro

---

## Integration Points

### Engineer Agent (`engineer.md`)

Add to "Pre-PR Quality Gates":
```markdown
### File Lifecycle (Refactor Tasks Only)
- [ ] Old/replaced files deleted
- [ ] Old test files deleted
- [ ] No dangling imports (type-check passes)
```

### SR Engineer Agent (`senior-engineer-pr-lead.md`)

Add to PR review checklist:
```markdown
### File Lifecycle Check
- [ ] No orphaned files from refactoring
- [ ] Imports verified (no dangling references)
```

### PM Agent (`agentic-pm.md`)

Add to task creation for refactor tasks:
```markdown
### File Lifecycle
- Files to delete after extraction: [list or "N/A"]
```
