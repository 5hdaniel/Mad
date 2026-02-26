# Task TASK-2087: Address-Based Email Filtering for Transactions Sharing Contacts

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

## Backlog Item

**BACKLOG-818:** Address-based email filtering for transactions sharing contacts

## Goal

When a real estate agent has multiple active transactions with the same contacts (common -- e.g., a buyer's agent working on several deals for the same client), emails currently get linked to ALL matching transactions based solely on contact email/phone matching. There is no way to distinguish which emails belong to which deal.

Add an address-matching filter layer that, during the email/message linking process:
1. Reads the transaction's `property_address` from the `transactions` table
2. Normalizes it (extracts street number + street name, strips suffixes like "St", "Street", "Way", "Drive", "Blvd", "Ave", etc.)
3. Filters emails/messages to only link ones whose subject or body contains the normalized address string
4. Falls back to current behavior (link all matching) when no address match is found in ANY email, or when the transaction has no `property_address`

**Example:** Agent has two transactions:
- Transaction A: "123 Oak Street" (contacts: John Smith, Jane Doe)
- Transaction B: "456 Elm Drive" (contacts: John Smith, Bob Wilson)

An email from John Smith mentioning "123 Oak" in the subject or body would only link to Transaction A, not Transaction B. An email from John Smith that mentions neither address falls back to the current behavior (links to both).

## Non-Goals

- Do NOT change the manual email linking UI or flow. This only modifies the **automatic** linking logic.
- Do NOT add address fields to the email/message storage schema. The address filter is applied at query time by checking email content.
- Do NOT add geocoding or fuzzy address matching (e.g., "123 Oak St" vs "123 Oak Street" is handled by normalization, but "near Oak Street" is NOT matched).
- Do NOT modify the email sync/fetch flow (Outlook/Gmail fetching). This filter is applied during the linking step, not the fetch step.
- Do NOT modify the transaction CRUD handlers or the transaction form UI.
- Do NOT add address parsing for unit/suite numbers (e.g., "Apt 4B" is ignored in the match; only street number + street name matter).

## Deliverables

### 1. Address Normalization Utility (New File)

**Create:** `electron/utils/addressNormalization.ts`

A pure utility that:
- Extracts the street number and street name from a full address string
- Strips common suffixes (Street, St, Drive, Dr, Boulevard, Blvd, Avenue, Ave, Way, Lane, Ln, Court, Ct, Circle, Cir, Place, Pl, Road, Rd, Terrace, Ter, Trail, Trl, Parkway, Pkwy)
- Returns a normalized string like "123 oak" from "123 Oak Street, Portland, OR 97201"
- Returns `null` if the address cannot be parsed (no street number found)

### 2. Address Filter in autoLinkService.ts (Modify)

**Modify:** `electron/services/autoLinkService.ts`

Add address-aware filtering to:
- `findEmailsByContactEmails()` -- add optional address filter to the SQL query or post-filter
- `findMessagesByContactPhones()` -- add optional address filter

The `autoLinkCommunicationsForContact()` function should:
1. Look up the transaction's `property_address` via `getTransactionInfo()` (extend the query)
2. Normalize it via the new utility
3. Pass the normalized address to the find functions
4. The find functions use the address to filter results (email subject/body_plain contain the address)
5. **Fallback logic:** If ZERO emails match with the address filter, fall back to returning all contact-matched emails (current behavior). This prevents the filter from being too aggressive for transactions where the address is never mentioned in emails.

### 3. Address Filter in messageMatchingService.ts (Modify)

**Modify:** `electron/services/messageMatchingService.ts`

Add address-aware filtering to:
- `autoLinkTextsToTransaction()` -- look up transaction address, filter messages
- `autoLinkEmailsToTransaction()` -- look up transaction address, filter emails
- `findEmailsByAddresses()` -- add optional address filter parameter

Same fallback logic as above: if zero results with address filter, retry without.

### 4. Tests

**Create:** `electron/__tests__/addressNormalization.test.ts`
**Modify:** `electron/services/__tests__/autoLinkService.test.ts`

## Acceptance Criteria

- [ ] When two transactions share the same contact and emails mention only one property address, emails are linked only to the matching transaction
- [ ] When an email mentions no property address at all, it falls back to current behavior (links to the transaction based on contact match alone)
- [ ] When a transaction has no `property_address`, the filter is skipped entirely (current behavior preserved)
- [ ] Address normalization handles common suffix variations: "123 Oak Street" / "123 Oak St" / "123 Oak St." all normalize to the same value
- [ ] Address normalization is case-insensitive
- [ ] Address normalization extracts only street number + street name, ignoring city/state/zip
- [ ] The filter applies to both email subject AND body_plain (if either contains the address, the email matches)
- [ ] The filter applies to both the `emails` table path (autoLinkService) and the `messages` table path (messageMatchingService)
- [ ] Existing auto-link behavior is preserved when the feature does not apply (no address, no shared contacts)
- [ ] All existing tests pass
- [ ] New tests cover: normalization edge cases, filter with matching address, filter with no match (fallback), no address on transaction
- [ ] All CI checks pass

## Implementation Notes

### Database Schema Context

The `transactions` table has these address fields (already existing -- NO schema changes needed):

```sql
property_address  TEXT  -- Full address string, e.g., "123 Oak Street, Portland, OR 97201"
property_street   TEXT  -- Street component, e.g., "123 Oak Street" (may be null)
property_city     TEXT
property_state    TEXT
property_zip      TEXT
```

The `emails` table has content fields:

```sql
subject     TEXT  -- Email subject line
body_plain  TEXT  -- Plain text body
body_html   TEXT  -- HTML body (use body_plain for matching, not HTML)
```

The `messages` table has:

```sql
body        TEXT  -- Message body (iMessage/SMS content)
subject     TEXT  -- Thread subject (if available)
```

### Address Normalization Algorithm

```typescript
// electron/utils/addressNormalization.ts

const STREET_SUFFIXES = new Set([
  'street', 'st', 'drive', 'dr', 'boulevard', 'blvd', 'avenue', 'ave',
  'way', 'lane', 'ln', 'court', 'ct', 'circle', 'cir', 'place', 'pl',
  'road', 'rd', 'terrace', 'ter', 'trail', 'trl', 'parkway', 'pkwy',
  'highway', 'hwy', 'loop', 'lp',
]);

/**
 * Normalize a property address to its core components for content matching.
 *
 * Examples:
 *   "123 Oak Street, Portland, OR 97201" -> "123 oak"
 *   "456 Elm Dr"                         -> "456 elm"
 *   "7890 NW Johnson Blvd, Suite 200"    -> "7890 nw johnson"
 *   ""                                   -> null
 *   "Portland, OR"                       -> null (no street number)
 *
 * @returns Normalized address string (lowercase, no suffix), or null if unparseable
 */
export function normalizeAddress(fullAddress: string): string | null {
  if (!fullAddress || !fullAddress.trim()) return null;

  // Take only the part before the first comma (street portion)
  const streetPart = fullAddress.split(',')[0].trim().toLowerCase();

  // Split into tokens
  const tokens = streetPart.split(/\s+/).filter(Boolean);

  if (tokens.length < 2) return null;

  // First token must start with a digit (street number)
  if (!/^\d/.test(tokens[0])) return null;

  // Remove trailing suffix if it's a known street suffix
  // Also remove trailing period from abbreviations like "St."
  const lastToken = tokens[tokens.length - 1].replace(/\.$/, '');
  if (STREET_SUFFIXES.has(lastToken)) {
    tokens.pop();
  }

  if (tokens.length < 2) return null;

  return tokens.join(' ');
}

/**
 * Check if text content contains the normalized address.
 * Performs case-insensitive substring search.
 */
export function contentContainsAddress(
  content: string | null | undefined,
  normalizedAddress: string
): boolean {
  if (!content) return false;
  return content.toLowerCase().includes(normalizedAddress);
}
```

### Insertion Point in autoLinkService.ts

The key function is `autoLinkCommunicationsForContact()`. Currently it:
1. Gets contact info (emails, phones)
2. Gets transaction info (user ID, dates)
3. Computes date range
4. Finds matching emails by contact email addresses
5. Finds matching messages by contact phone numbers
6. Links them

**Change:** Between steps 2 and 3, also fetch the transaction's `property_address`. Then pass the normalized address to steps 4 and 5 as an optional filter.

```typescript
// In getTransactionInfo() - extend the query to include property_address:
const sql = `
  SELECT user_id, started_at, created_at, closed_at, property_address
  FROM transactions WHERE id = ?
`;

// In TransactionInfo interface:
interface TransactionInfo {
  userId: string;
  started_at: string | null;
  created_at: string | null;
  closed_at: string | null;
  propertyAddress: string | null;  // NEW
}
```

**For findEmailsByContactEmails():** Add an optional `normalizedAddress` parameter. When provided, add a SQL clause:

```sql
AND (
  LOWER(e.subject) LIKE ? OR LOWER(e.body_plain) LIKE ?
)
```

With parameter `%${normalizedAddress}%` for both.

**Fallback strategy:** The calling code should:
1. First call with address filter
2. If result is empty AND address was provided, call again without filter
3. Log the fallback so we can track how often it happens

### Insertion Point in messageMatchingService.ts

Similar pattern. The `autoLinkTextsToTransaction()` and `autoLinkEmailsToTransaction()` functions already query the transaction for `user_id`. Extend the query to also fetch `property_address`, normalize it, and apply the filter.

For `findEmailsByAddresses()`, add an optional `normalizedAddress` parameter and add a content filter clause to the SQL query.

For `findTextMessagesByPhones()` (if it exists), same pattern with `m.body`.

### Performance Considerations

- The address filter adds one or two LIKE clauses to existing SQL queries. These are already filtered by user_id, date range, and contact -- the address filter just narrows the result set further. Performance impact is negligible on local SQLite.
- The fallback (retry without filter) doubles the query cost only when the address filter eliminates ALL results. This should be rare for well-populated email databases.
- `body_plain` can be large, but SQLite LIKE on TEXT columns is fast for local databases.

## Do / Don't

### Do:
- Create a clean, well-tested utility for address normalization
- Use `property_address` as the source (it is the full address string stored on creation)
- Fall back to `property_street` if `property_address` is null but `property_street` exists
- Apply the filter to BOTH email and message linking paths
- Implement the fallback: if address filter eliminates all results, retry without it
- Log when the address filter narrows results (for debugging/tuning)
- Keep the normalization simple -- street number + street name only

### Don't:
- Do NOT add new database columns or schema changes
- Do NOT modify the email sync/fetch logic (only the linking logic)
- Do NOT use regex for content matching -- simple LIKE with the normalized address is sufficient
- Do NOT attempt fuzzy matching or Levenshtein distance -- exact substring match is the right approach
- Do NOT modify the manual linking UI flow
- Do NOT add geocoding APIs or external service calls
- Do NOT change `findEmailsByContactEmails` or `findMessagesByContactPhones` in a way that breaks the function signature for existing callers -- add optional parameters

## When to Stop and Ask

- If `property_address` is stored differently than expected (verify the column exists and has data)
- If the `emails` table does not have `body_plain` populated (some emails might only have `body_html`)
- If you discover that `findEmailsByContactEmails` in `autoLinkService.ts` is called from places that do NOT have a transaction context
- If the SQL LIKE query on `body_plain` causes noticeable slowdown (measure before/after)
- If token cap is approaching

## Testing Expectations (MANDATORY)

### Unit Tests

**New test file:** `electron/__tests__/addressNormalization.test.ts`
- "123 Oak Street, Portland, OR 97201" -> "123 oak"
- "456 Elm Dr" -> "456 elm"
- "7890 NW Johnson Blvd, Suite 200" -> "7890 nw johnson"
- "123 Oak St." -> "123 oak" (period stripped)
- "Oak Street" -> null (no street number)
- "" -> null
- null/undefined -> null
- "123" -> null (no street name)
- "100 Main" -> "100 main" (no suffix to strip)
- contentContainsAddress("Subject about 123 Oak property", "123 oak") -> true
- contentContainsAddress("Unrelated email", "123 oak") -> false
- contentContainsAddress(null, "123 oak") -> false

**Modified test file:** `electron/services/__tests__/autoLinkService.test.ts`
- Auto-link with address filter: only matching emails linked
- Auto-link fallback: when no emails mention address, all contact-matched emails linked
- Auto-link without address: transaction has no property_address, current behavior preserved
- Auto-link with address in body_plain but not subject: still links

### Coverage

- Coverage impact: Should increase (new code, new tests)

### Integration / Manual Testing

1. **Two transactions, same contact, different addresses:** Create Transaction A (123 Oak St) and Transaction B (456 Elm Dr), both with contact "John Smith". Send emails mentioning "123 Oak" -- verify they link only to Transaction A.
2. **Email mentions no address:** Send email from shared contact with no address reference -- verify it links to both transactions (fallback).
3. **Transaction without address:** Create transaction with no property_address -- verify auto-link works as before.
4. **Messages (SMS/iMessage):** Send text mentioning address -- verify address filter applies to message body too.

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(auto-link): add address-based email filtering for shared contacts`
- **Labels**: `feature`, `service`, `auto-link`
- **Depends on**: None

---

## Risk Analysis

### Risk 1: Address normalization too aggressive
- **Impact:** Legitimate emails filtered out because address format doesn't match
- **Mitigation:** The fallback mechanism retries without the filter when zero results are returned. Address normalization is intentionally simple (street number + name only). Edge cases like "One Hundred Oak Street" (spelled-out numbers) are NOT handled -- these are rare in real estate.

### Risk 2: body_plain not populated for some emails
- **Impact:** Address filter can't match email body if only body_html is stored
- **Mitigation:** Also check `subject` field. Additionally, could fall back to checking `body_html` (strip tags), but that adds complexity. Start with subject + body_plain; iterate if needed.

### Risk 3: SQL performance on body_plain LIKE queries
- **Impact:** Slow queries on large email databases
- **Mitigation:** The queries are already filtered by user_id, date range, and contact email. The body_plain LIKE clause only runs on this pre-filtered subset. For local SQLite, this should be fast even with thousands of emails.

### Risk 4: False positives from address substring matching
- **Impact:** "123 oak" could match "12345 Oakland Blvd" or "oak" in an unrelated context
- **Mitigation:** The normalized address includes the street NUMBER, making false positives unlikely. "123 oak" in an email body almost certainly refers to 123 Oak [Street/St/etc]. The street number anchors the match.

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K-60K

**Token Cap:** 240K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 (utility + test) | +15K |
| Files to modify | 3 (autoLinkService, messageMatchingService, autoLinkService.test) | +20K |
| Code volume | ~80 lines production, ~150 lines test | +15K |
| Test complexity | Medium (mocking DB queries) | +10K |
| Integration risk | Low (additive change, no breaking changes) | +5K |

**Confidence:** High (well-scoped, additive change, no schema modifications)

**Risk factors:**
- messageMatchingService.ts is a large file -- navigating it adds tokens
- Fallback logic adds complexity to test setup

**Similar past tasks:** TASK-2068 (email date range refactor, similar scope and file set)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/utils/addressNormalization.ts
- [ ] electron/__tests__/addressNormalization.test.ts

Files modified:
- [ ] electron/services/autoLinkService.ts
- [ ] electron/services/messageMatchingService.ts
- [ ] electron/services/__tests__/autoLinkService.test.ts

Features implemented:
- [ ] Address normalization utility (normalizeAddress, contentContainsAddress)
- [ ] Address filter in autoLinkService findEmailsByContactEmails
- [ ] Address filter in autoLinkService findMessagesByContactPhones
- [ ] Address filter in messageMatchingService autoLinkEmailsToTransaction
- [ ] Address filter in messageMatchingService autoLinkTextsToTransaction
- [ ] Fallback to unfiltered results when address filter eliminates all matches
- [ ] TransactionInfo extended with propertyAddress

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~50K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
