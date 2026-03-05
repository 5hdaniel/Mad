# TASK-2104: Update Domain URLs and Environment Variables

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Update all auth/functional references from `www.keeprcompliance.com` to `app.keeprcompliance.com` in the codebase. This includes environment variable defaults, hardcoded fallback URLs, CI workflow env generation, and test assertions.

## Non-Goals

- Do NOT change marketing/info URLs (upgrade links to `/beta`, legal links) — these stay on `www`
- Do NOT change `.env.example` or `broker-portal/.env.local.example` — these use `localhost`
- Do NOT change the release notes URL in `release.yml:346` — that's a marketing link
- Do NOT modify any Vercel/Supabase/OAuth infrastructure — that's TASK-2103
- Do NOT set up redirects from `www` to `app` — that's future work
- Do NOT touch `magicaudit://` deep link protocol — unaffected by this change

## Deliverables

1. Update: `electron/handlers/sessionHandlers.ts` (line 1141) — fallback URL
2. Update: `broker-portal/lib/actions/inviteUser.ts` (line 170) — fallback URL
3. Update: `.github/workflows/release.yml` (lines 100, 225) — BROKER_PORTAL_URL in .env.production generation
4. Update: `.env.production` (line 10) — BROKER_PORTAL_URL
5. Update: `.env.development` (line 41) — comment update only (value stays `www` for staging parity, or update to `app` if it's the production URL used for dev testing)
6. Update: `broker-portal/__tests__/lib/actions/inviteUser.test.ts` (lines 193, 244, 245) — test assertions

## Acceptance Criteria

- [ ] `sessionHandlers.ts:1141` fallback is `https://app.keeprcompliance.com`
- [ ] `inviteUser.ts:170` fallback is `https://app.keeprcompliance.com`
- [ ] `release.yml:100` writes `BROKER_PORTAL_URL=https://app.keeprcompliance.com`
- [ ] `release.yml:225` writes `BROKER_PORTAL_URL=https://app.keeprcompliance.com`
- [ ] `.env.production` has `BROKER_PORTAL_URL=https://app.keeprcompliance.com`
- [ ] `inviteUser.test.ts` assertions use `https://app.keeprcompliance.com`
- [ ] Marketing URLs (`/beta`, `/legal`) are NOT changed — still use `www`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Changes are mechanical string replacements

Every change is replacing `www.keeprcompliance.com` with `app.keeprcompliance.com` in specific auth-related locations.

### File-by-file guide

**`electron/handlers/sessionHandlers.ts:1141`**
```typescript
// Before:
const brokerPortalUrl = process.env.BROKER_PORTAL_URL || 'https://www.keeprcompliance.com';
// After:
const brokerPortalUrl = process.env.BROKER_PORTAL_URL || 'https://app.keeprcompliance.com';
```

**`broker-portal/lib/actions/inviteUser.ts:170`**
```typescript
// Before:
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.keeprcompliance.com';
// After:
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keeprcompliance.com';
```

**`.github/workflows/release.yml:100` (macOS .env.production)**
```yaml
# Before:
echo "BROKER_PORTAL_URL=https://www.keeprcompliance.com"
# After:
echo "BROKER_PORTAL_URL=https://app.keeprcompliance.com"
```

**`.github/workflows/release.yml:225` (Windows .env.production)**
```powershell
# Before:
"BROKER_PORTAL_URL=https://www.keeprcompliance.com",
# After:
"BROKER_PORTAL_URL=https://app.keeprcompliance.com",
```

**`.env.production:10`**
```
# Before:
BROKER_PORTAL_URL=https://www.keeprcompliance.com
# After:
BROKER_PORTAL_URL=https://app.keeprcompliance.com
```

**`.env.development:41`**
```
# Before:
BROKER_PORTAL_URL=https://www.keeprcompliance.com
# After:
BROKER_PORTAL_URL=https://app.keeprcompliance.com
```
(This is the production URL used when developing locally against prod — update it.)

**`broker-portal/__tests__/lib/actions/inviteUser.test.ts`**
```typescript
// Line 193 - Before:
inviteLink: 'https://www.keeprcompliance.com/invite/abc123',
// After:
inviteLink: 'https://app.keeprcompliance.com/invite/abc123',

// Line 244 - Before:
const link = generateInviteLink('https://www.keeprcompliance.com', 'abc123def456');
// After:
const link = generateInviteLink('https://app.keeprcompliance.com', 'abc123def456');

// Line 245 - Before:
expect(link).toBe('https://www.keeprcompliance.com/invite/abc123def456');
// After:
expect(link).toBe('https://app.keeprcompliance.com/invite/abc123def456');
```

### URLs that must NOT change (marketing/info — stay on `www`)

| File | Line | URL | Why |
|------|------|-----|-----|
| `StartNewAuditModal.tsx` | 304 | `www.keeprcompliance.com/beta` | Upgrade/marketing |
| `UpgradeScreen.tsx` | 50 | `www.keeprcompliance.com/beta` | Upgrade/marketing |
| `Dashboard.tsx` | 216 | `www.keeprcompliance.com/beta` | Upgrade/marketing |
| `TransactionLimitModal.tsx` | 66 | `www.keeprcompliance.com/beta` | Upgrade/marketing |
| `Settings.tsx` | 1875 | `www.keeprcompliance.com/legal#privacy` | Legal page |
| `Settings.tsx` | 1881 | `www.keeprcompliance.com/legal#terms` | Legal page |
| `release.yml` | 346 | `www.keeprcompliance.com` | Release notes link |

## Integration Notes

- **Depends on:** TASK-2103 (infra must be configured first so `app.keeprcompliance.com` resolves)
- **Blocks:** BACKLOG-837 (admin portal), BACKLOG-838 (impersonation)
- **Desktop release:** After this merges to `develop` and a release is cut, new desktop builds will use `app.keeprcompliance.com`. Existing installed versions will continue using `www` (which must remain active during transition).

## Do / Don't

### Do:
- Use exact string replacement — no refactoring
- Update the comment on `sessionHandlers.ts:1140` to say `app.keeprcompliance.com` instead of `www`
- Run full test suite to verify no regressions

### Don't:
- Don't touch marketing URLs (see table above)
- Don't change `.env.example` or `.env.local.example` (localhost values)
- Don't refactor how BROKER_PORTAL_URL is consumed
- Don't add new environment variables

## When to Stop and Ask

- If any other files reference `www.keeprcompliance.com` in an auth context not listed here
- If tests fail for reasons unrelated to the URL change
- If `.env.development` line 41 contains something different than expected

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: Yes
- Existing tests to update:
  - `broker-portal/__tests__/lib/actions/inviteUser.test.ts` — update 3 URL assertions (lines 193, 244, 245)
- No new tests needed — this is a config change

### Coverage
- Coverage impact: No change (same tests, updated assertions)

### Integration / Feature Tests
- No automated integration tests to update
- Manual verification covered by TASK-2103 checklist and sprint validation

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (`npm test`)
- [ ] Type checking (`npm run type-check`)
- [ ] Lint / format checks (`npm run lint`)
- [ ] Build Application
- [ ] Security Audit

**PRs without passing CI WILL BE REJECTED.**

## PR Preparation

- **Title**: `chore: migrate broker portal URLs from www to app.keeprcompliance.com`
- **Base**: `int/sprint-108-domain-migration`
- **Labels**: `infra`, `chore`
- **Depends on**: TASK-2103 (infra verified)

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~8K (config category × 0.5 = ~4K actual expected)

**Token Cap:** 32K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 6 files | +3K |
| Code volume | ~10 lines changed (string replacements) | +1K |
| Test updates | 3 assertions in 1 test file | +1K |
| Verification | type-check + lint + test | +3K |

**Confidence:** High — mechanical string replacements with clear file:line targets.

**Risk factors:**
- `.env.development` line 41 might have shifted since last read
- Test file line numbers may have shifted

**Similar past tasks:** Config tasks historically come in at 50% of estimate (× 0.5 multiplier).

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
Files modified:
- [ ] electron/handlers/sessionHandlers.ts
- [ ] broker-portal/lib/actions/inviteUser.ts
- [ ] .github/workflows/release.yml
- [ ] .env.production
- [ ] .env.development
- [ ] broker-portal/__tests__/lib/actions/inviteUser.test.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Marketing URLs unchanged (grep verification)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any>

**Issues encountered:**
<If any>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
