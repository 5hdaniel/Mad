# SPRINT-108: Broker Portal Domain Migration

**Sprint Goal:** Migrate the broker portal from `www.keeprcompliance.com` to `app.keeprcompliance.com`, freeing `www` for a future marketing site and establishing the subdomain structure for the admin portal (`admin.keeprcompliance.com`).

**Branch:** `int/sprint-108-domain-migration`
**Base:** `develop`
**Merge Target:** `develop`

---

## Context

BACKLOG-836 is a prerequisite for BACKLOG-837 (admin portal) and BACKLOG-838 (impersonation). The broker portal must move to `app.` before `admin.` can be built, since both share the same Supabase backend and need distinct subdomain-based routing.

### Key Discovery

The codebase has two categories of `www.keeprcompliance.com` references:

1. **Auth/functional URLs** (MUST change to `app.keeprcompliance.com`):
   - `electron/handlers/sessionHandlers.ts:1141` - BROKER_PORTAL_URL fallback
   - `broker-portal/lib/actions/inviteUser.ts:170` - NEXT_PUBLIC_APP_URL fallback
   - `.github/workflows/release.yml:100,225` - .env.production generation
   - `.env.production:10` - local production env
   - `.env.development:41` - dev env (comment update only — value stays localhost)
   - `broker-portal/__tests__/lib/actions/inviteUser.test.ts:193,244,245` - test assertions

2. **Marketing/info URLs** (stay on `www`, unaffected):
   - `StartNewAuditModal.tsx:304` - /beta upgrade link
   - `UpgradeScreen.tsx:50` - /beta upgrade link
   - `Dashboard.tsx:216` - /beta upgrade link
   - `TransactionLimitModal.tsx:66` - /beta upgrade link
   - `Settings.tsx:1875,1881` - /legal links
   - `release.yml:346` - release notes link

---

## In-Scope

| # | Task | Backlog | Status |
|---|------|---------|--------|
| 1 | TASK-2103: Infrastructure setup (Vercel, Supabase, OAuth) | BACKLOG-836 | Pending |
| 2 | TASK-2104: Code changes (URLs, env vars, tests) | BACKLOG-836 | Pending |

## Out of Scope / Deferred

- BACKLOG-837: Admin portal build (separate sprint after 836 lands)
- BACKLOG-838: Impersonation support (depends on 837)
- Moving `www` to a marketing site (future work — `www` will continue serving the broker portal via redirect until marketing site is ready)
- Changing marketing/info URLs (`/beta`, `/legal`) — these stay on `www`

---

## Dependency Graph

```
TASK-2103 (Infra: Vercel + Supabase + OAuth)
    │
    ▼
TASK-2104 (Code: URLs + env vars + tests)
```

TASK-2103 must complete first — the domain must be configured and auth redirects working before code changes point to it.

---

## Merge Plan

1. TASK-2103 is manual infrastructure work (Vercel dashboard, Supabase dashboard, Google Cloud Console, Azure AD). No code PR — just a verification checklist.
2. TASK-2104 creates a single PR to `int/sprint-108-domain-migration` with all code changes.
3. After TASK-2104 PR merges to integration branch, test end-to-end on the integration branch.
4. Merge `int/sprint-108-domain-migration` → `develop` via PR.
5. Next desktop app release will pick up the new BROKER_PORTAL_URL from release.yml.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth redirect URI mismatch causes login failures | High | TASK-2103 adds `app.` URIs alongside existing `www` URIs — don't remove old ones until verified |
| Existing desktop app versions still use `www` | Medium | Vercel redirect from `www/auth/*` to `app/auth/*` as fallback, or keep `www` alias active during transition |
| Supabase auth redirect URL missing new domain | High | Add `app.keeprcompliance.com` to allowed redirect URLs before any code change |
| Invite emails with old domain in transit | Low | Old `www` domain continues working via Vercel alias during transition period |

---

## Testing & Quality Plan

### Manual Testing (TASK-2103)
- [ ] `app.keeprcompliance.com` resolves and shows broker portal
- [ ] Google OAuth login works on `app.keeprcompliance.com`
- [ ] Azure AD login works on `app.keeprcompliance.com`
- [ ] Supabase auth callbacks redirect correctly to `app.`

### Automated Tests (TASK-2104)
- [ ] `inviteUser.test.ts` updated with new domain assertions
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] CI pipeline passes (Test & Lint, Security Audit, Build)

### Integration Testing (Post-merge)
- [ ] Desktop app with new BROKER_PORTAL_URL opens `app.keeprcompliance.com/auth/desktop`
- [ ] Invite links use `app.keeprcompliance.com/invite/...`
- [ ] Deep links (`magicaudit://`) still work (should be unaffected)
- [ ] `www.keeprcompliance.com` still accessible (alias or redirect)

---

## Validation Checklist (Sprint Close)

- [ ] All tasks complete and PRs merged
- [ ] `app.keeprcompliance.com` is the primary broker portal domain
- [ ] `www.keeprcompliance.com` still works (redirect or alias)
- [ ] Google OAuth accepts `app.keeprcompliance.com` callbacks
- [ ] Azure AD accepts `app.keeprcompliance.com` callbacks
- [ ] Supabase auth allows `app.keeprcompliance.com` redirects
- [ ] No orphaned PRs: `gh pr list --state open --search "SPRINT-108"`
- [ ] Effort metrics recorded
- [ ] BACKLOG-836 status → Completed
