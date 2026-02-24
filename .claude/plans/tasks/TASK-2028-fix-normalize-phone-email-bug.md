# TASK-2028: Fix normalizePhone Email Bug in 4 Remaining Implementations

**Backlog ID:** BACKLOG-756
**Sprint:** SPRINT-090
**Phase:** 1 (CRITICAL -- before Monday)
**Branch:** `fix/task-2028-normalize-phone-email-bug`
**Estimated Tokens:** ~60K
**Token Cap:** ~240K (4x estimate)

---

## Objective

Add email handle guards to 4 remaining `normalizePhone` / `normalizePhoneNumber` implementations that currently destroy email addresses by stripping all non-digit characters. The fixed version in `contactResolutionService.ts` already has the correct pattern -- apply it to the 4 remaining copies.

---

## Context

TASK-2027 (SPRINT-089, PR #907) fixed the `normalizePhone()` in `electron/services/contactResolutionService.ts` to preserve email handles:

```typescript
// CORRECT (already fixed in contactResolutionService.ts):
export function normalizePhone(phone: string): string {
  if (phone.includes("@")) return phone.toLowerCase();
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
```

However, 4 other implementations still have the bug. The most dangerous is in `messageMatchingService.ts`, used by `autoLinkService.ts` for auto-linking messages to transactions. When a contact's iMessage handle is an email (e.g., `paul@icloud.com`), calling `normalizePhone("paul@icloud.com")` returns `null` (after stripping to empty string and failing the digit-length check), causing the message to silently fail to auto-link.

---

## Requirements

### Must Do:

1. **Fix `electron/utils/phoneUtils.ts` `normalizePhoneNumber()`** -- Add email guard before stripping non-digits
2. **Fix `electron/utils/phoneNormalization.ts` `normalizePhoneNumber()`** -- Add email guard before stripping non-digits
3. **Fix `electron/services/messageMatchingService.ts` `normalizePhone()`** -- Add email guard before stripping non-digits
4. **Fix `src/utils/threadMergeUtils.ts` `normalizePhone()`** -- Add email guard before stripping non-digits
5. **Update existing unit tests** to cover email handle inputs
6. **Add email handle test cases** to each test file

### Must NOT Do:

- Do NOT consolidate these 4 implementations into a single shared module (that is a separate refactoring concern for a future sprint)
- Do NOT change the function signatures or return types
- Do NOT modify `contactResolutionService.ts` (already fixed)
- Do NOT modify `src/utils/phoneNormalization.ts` (renderer-side, already handles emails via `normalizePhoneForLookup`)
- Do NOT rename any functions

---

## Acceptance Criteria

- [ ] `normalizePhoneNumber("user@icloud.com")` returns `"user@icloud.com"` in `electron/utils/phoneUtils.ts`
- [ ] `normalizePhoneNumber("user@icloud.com")` returns `"user@icloud.com"` in `electron/utils/phoneNormalization.ts`
- [ ] `normalizePhone("user@icloud.com")` returns `"user@icloud.com"` in `electron/services/messageMatchingService.ts`
- [ ] `normalizePhone("user@icloud.com")` returns `"user@icloud.com"` in `src/utils/threadMergeUtils.ts`
- [ ] Existing phone number tests still pass (no regression)
- [ ] New email handle test cases pass in each test file
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

| File | What Changes |
|------|-------------|
| `electron/utils/phoneUtils.ts` | Add `if (phone.includes("@")) return phone;` guard at top of `normalizePhoneNumber()` |
| `electron/utils/phoneNormalization.ts` | Add `if (phone.includes("@")) return phone.toLowerCase();` guard at top of `normalizePhoneNumber()` |
| `electron/services/messageMatchingService.ts` | Add `if (phone.includes("@")) return phone.toLowerCase();` guard at top of `normalizePhone()` |
| `src/utils/threadMergeUtils.ts` | Add `if (phone.includes("@")) return phone.toLowerCase();` guard at top of `normalizePhone()` |

## Test Files to Modify

| File | What Changes |
|------|-------------|
| `electron/utils/__tests__/phoneUtils.test.ts` | Add test cases for email inputs |
| `electron/utils/__tests__/phoneNormalization.test.ts` | Add test cases for email inputs |
| `electron/services/__tests__/messageMatchingService.test.ts` | Add test cases for email inputs to `normalizePhone` |

## Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/contactResolutionService.ts` | Reference implementation with correct email guard (lines 37-42) |
| `electron/services/autoLinkService.ts` | Consumer of messageMatchingService.normalizePhone -- understand impact |
| `electron/contact-handlers.ts` | Consumer of phoneNormalization.normalizePhoneNumber -- understand impact |
| `electron/services/contactsService.ts` | Consumer of phoneUtils.normalizePhoneNumber -- understand impact |
| `electron/services/iosContactsParser.ts` | Consumer of phoneNormalization.normalizePhoneNumber -- understand impact |

---

## Implementation Notes

### Pattern to Apply

Each of the 4 functions has a slightly different signature, so the guard must adapt:

**1. `electron/utils/phoneUtils.ts` -- handles `null | undefined`:**
```typescript
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  if (phone.includes("@")) return phone.toLowerCase(); // ADD THIS LINE
  return phone.replace(REGEX_PATTERNS.PHONE_NORMALIZE, "");
}
```

**2. `electron/utils/phoneNormalization.ts` -- returns `+` prefixed E.164:**
```typescript
export function normalizePhoneNumber(phone: string): string {
  if (phone.includes("@")) return phone.toLowerCase(); // ADD THIS LINE
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "1" + digits;
  }
  return "+" + digits;
}
```

**3. `electron/services/messageMatchingService.ts` -- returns `null` for invalid:**
```typescript
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.includes("@")) return phone.toLowerCase(); // ADD THIS LINE
  const digits = phone.replace(/\D/g, "");
  // ... rest of function
}
```

**4. `src/utils/threadMergeUtils.ts` -- simple last-10-digits:**
```typescript
function normalizePhone(phone: string): string {
  if (phone.includes("@")) return phone.toLowerCase(); // ADD THIS LINE
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
```

### Test Cases to Add

For each test file, add a describe block:

```typescript
describe("email handle preservation", () => {
  it("should preserve email handles unchanged", () => {
    expect(normalizePhone("user@icloud.com")).toBe("user@icloud.com");
  });

  it("should lowercase email handles", () => {
    expect(normalizePhone("User@ICLOUD.COM")).toBe("user@icloud.com");
  });

  it("should still normalize regular phone numbers", () => {
    expect(normalizePhone("+1 (415) 555-0000")).toBe(/* expected */);
  });
});
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **Existing tests to update:** `phoneUtils.test.ts`, `phoneNormalization.test.ts`, `messageMatchingService.test.ts`
- **New tests to write:** Email handle test cases in each test file
- **threadMergeUtils:** If no test file exists, create one at `src/utils/__tests__/threadMergeUtils.test.ts` with at least normalizePhone email tests

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix: add email handle guards to 4 remaining normalizePhone implementations`
- **Branch:** `fix/task-2028-normalize-phone-email-bug`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-21*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: 2026-02-21
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [x] CI passes (gh pr checks --watch)
- [x] SR Engineer review requested

Completion:
- [x] SR Engineer approved and merged
- [x] PM notified for next task
```

### Results

- **Before**: 4 normalizePhone/normalizePhoneNumber implementations strip all non-digit characters from email handles, destroying them (e.g., "user@icloud.com" becomes "" or "+")
- **After**: All 4 implementations now check for "@" and return the email lowercased before any digit stripping. Email handles are preserved correctly.
- **Actual Tokens**: ~30K (Est: ~60K)
- **PR**: #910, merged 2026-02-21

### Notes

**Deviations from plan:**
None. Implemented exactly as specified.

**Issues encountered:**
None. The `normalizePhone` in `threadMergeUtils.ts` is a private (non-exported) function, so it was tested indirectly through `mergeThreadsByContact` rather than with direct unit tests. Added 2 integration-level tests that exercise the email handle path through the merge logic.

---

## Guardrails

**STOP and ask PM if:**
- Any of the 4 functions has consumers you didn't expect (beyond those listed in Files to Read)
- The email guard pattern would break any existing test in unexpected ways
- You discover a 5th implementation of normalizePhone not listed here
- You encounter blockers not covered in the task file
