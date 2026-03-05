# TASK-2106: Scaffold Admin Portal with Auth and Deploy to Vercel

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

Create a new Next.js admin portal app at `admin-portal/` that shares the same Supabase backend as the broker portal. The app must authenticate users via Supabase and reject anyone without an `internal_roles` entry. Deploy to Vercel at `admin.keeprcompliance.com`.

## Non-Goals

- Do NOT build any admin features (user search, detail view, account management) — that's SPRINT-110/111
- Do NOT create admin RLS policies for other tables — that's SPRINT-110
- Do NOT add impersonation — that's SPRINT-111
- Do NOT add analytics/stats — that's SPRINT-111
- Do NOT modify the broker portal (`broker-portal/`) in any way
- Do NOT modify the Electron app
- Do NOT modify CI pipeline (we'll add admin-portal to CI in a follow-up if needed)

## Deliverables

### New directory: `admin-portal/`

```
admin-portal/
  app/
    layout.tsx              # Root layout with AuthProvider
    page.tsx                # Root redirect to /dashboard or /login
    globals.css             # Tailwind styles (copy from broker-portal)
    login/
      page.tsx              # Login page with Google/Microsoft buttons
    dashboard/
      layout.tsx            # Dashboard layout with sidebar
      page.tsx              # Dashboard home (placeholder: "Welcome to Keepr Admin")
  components/
    providers/
      AuthProvider.tsx      # Auth context (adapted from broker-portal)
    layout/
      Sidebar.tsx           # Sidebar navigation shell
      Header.tsx            # Top header with user info + sign out
  lib/
    supabase/
      client.ts             # Browser Supabase client
      server.ts             # Server Supabase client
  middleware.ts              # Auth protection + internal role check
  next.config.mjs
  package.json
  tailwind.config.ts
  tsconfig.json
  postcss.config.mjs
  .env.local.example        # Template for local dev
  vercel.json               # Vercel config (if needed)
```

## Acceptance Criteria

- [ ] `admin-portal/` directory exists with complete Next.js app
- [ ] `cd admin-portal && npm install && npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Login page renders with Google and Microsoft sign-in options
- [ ] Middleware rejects unauthenticated users (redirects to /login)
- [ ] Middleware rejects authenticated users WITHOUT an internal_roles entry (shows "not authorized" error)
- [ ] Authenticated internal users see the dashboard shell with sidebar
- [ ] Sign out returns to login page
- [ ] Sidebar has placeholder nav items: Dashboard, Users (disabled), Settings (disabled)
- [ ] App runs locally on port 3002 (`npm run dev` → localhost:3002)
- [ ] Vercel project created and deployed at `admin.keeprcompliance.com`

## Implementation Notes

### Mirror broker portal patterns

Copy and adapt these from `broker-portal/`:
- `lib/supabase/client.ts` and `lib/supabase/server.ts` — Supabase client creation
- `components/providers/AuthProvider.tsx` — auth context
- `middleware.ts` — adapt the auth check pattern

### Key difference from broker portal: internal role check

The broker portal checks `organization_members.role`. The admin portal checks `internal_roles.role` instead.

**Middleware auth flow:**
```typescript
// 1. Get authenticated user
const { data: { user } } = await supabase.auth.getUser();

// 2. If no user, redirect to /login
if (isProtectedRoute && !user) {
  return NextResponse.redirect(new URL('/login', request.url));
}

// 3. If user but no internal role, reject
if (isProtectedRoute && user) {
  const { data: internalRole } = await supabase
    .from('internal_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!internalRole) {
    return NextResponse.redirect(new URL('/login?error=not_authorized', request.url));
  }
}
```

### Login page

Simple login page with:
- Keepr logo + "Admin Portal" title
- "Sign in with Google" button
- "Sign in with Microsoft" button
- Error message display for `?error=not_authorized` → "Your account does not have admin access."
- Use Supabase OAuth: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })`

### Auth callback route

Create `app/auth/callback/route.ts` to handle the OAuth callback:
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### Dashboard shell

Minimal layout with:
- **Sidebar** (left): Logo, nav items (Dashboard active, Users greyed out, Settings greyed out), sign out at bottom
- **Header** (top): "Keepr Admin" title, user avatar/email, sign out button
- **Main content**: "Welcome to Keepr Admin" placeholder with the user's role badge

### Sidebar navigation items (for future sprints)

```typescript
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: true },
  { label: 'Users', href: '/dashboard/users', icon: Users, enabled: false },
  { label: 'Organizations', href: '/dashboard/organizations', icon: Building2, enabled: false },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: false },
];
```

### Package.json

```json
{
  "name": "keepr-admin-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "next lint"
  }
}
```

Dependencies — same as broker portal:
- `next` (15.x), `react` (18.x), `react-dom` (18.x)
- `@supabase/ssr`, `@supabase/supabase-js`
- `lucide-react`
- `tailwindcss`, `postcss`, `autoprefixer`
- `typescript`, `@types/react`, `@types/node`

### Vercel deployment

After code is ready:
1. Create Vercel project: `cd admin-portal && vercel link` (create new project "admin-portal")
2. Set root directory to `admin-portal/`
3. Add environment variables (Production):
   - `NEXT_PUBLIC_SUPABASE_URL` — same as broker portal
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same as broker portal
4. Add `admin.keeprcompliance.com` domain
5. Deploy: `vercel --prod`

### Supabase auth redirect URLs

Add `https://admin.keeprcompliance.com/**` to Supabase redirect URLs (if not already there).

### .env.local.example

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Do / Don't

### Do:
- Mirror broker portal code patterns exactly (auth, Supabase clients, middleware)
- Use Tailwind for all styling
- Use lucide-react for icons
- Keep the dashboard shell minimal — just navigation structure
- Make disabled nav items visually distinct (greyed out, no click handler)

### Don't:
- Don't build any actual features (search, user view, etc.)
- Don't modify broker-portal/ directory
- Don't add Clarity analytics (not needed for internal tool)
- Don't add complex state management — keep it simple
- Don't create API routes (except auth callback)

## When to Stop and Ask

- If Supabase auth redirect URLs need updating and you can't do it via MCP
- If Vercel deployment requires team/billing configuration you can't access
- If the broker portal auth patterns don't translate cleanly to the admin portal
- If CI pipeline needs modifications to support admin-portal/

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (foundation sprint — shell only, no business logic)
- Future sprints will add tests for search, detail view, account management

### Build Verification
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] No TypeScript errors

### Manual Testing
- [ ] Login page loads at localhost:3002
- [ ] Google OAuth login works for internal user
- [ ] Non-internal user sees "not authorized" error
- [ ] Dashboard shell renders with sidebar
- [ ] Sign out works
- [ ] Deployed and accessible at admin.keeprcompliance.com

### CI Requirements
- CI pipeline update deferred — admin-portal is not yet in the CI matrix
- Build verification is manual for this sprint

## PR Preparation

- **Title**: `feat: scaffold admin portal with internal auth at admin.keeprcompliance.com`
- **Base**: `int/sprint-109-admin-portal`
- **Labels**: `feature`, `admin-portal`
- **Depends on**: TASK-2105 (internal_roles table must exist)

---

## PM Estimate (PM-Owned)

**Category:** `service` (new app scaffold)

**Estimated Tokens:** ~40K (service category × 0.5 = ~20K actual expected)

**Token Cap:** 160K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | ~15 new files | +15K |
| Code volume | ~500 lines (mostly adapted from broker-portal) | +10K |
| Supabase client setup | Reuse patterns | +3K |
| Vercel deployment | CLI commands | +5K |
| Build verification | build + lint | +5K |

**Confidence:** Medium — new app scaffold has some unknowns (Vercel project setup, Supabase redirect URLs).

**Risk factors:**
- Vercel project creation may require interactive setup
- Supabase cookie handling across subdomains (app. vs admin.) may need debugging

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/package.json
- [ ] admin-portal/app/layout.tsx
- [ ] admin-portal/app/page.tsx
- [ ] admin-portal/app/login/page.tsx
- [ ] admin-portal/app/auth/callback/route.ts
- [ ] admin-portal/app/dashboard/layout.tsx
- [ ] admin-portal/app/dashboard/page.tsx
- [ ] admin-portal/components/providers/AuthProvider.tsx
- [ ] admin-portal/components/layout/Sidebar.tsx
- [ ] admin-portal/components/layout/Header.tsx
- [ ] admin-portal/lib/supabase/client.ts
- [ ] admin-portal/lib/supabase/server.ts
- [ ] admin-portal/middleware.ts
- [ ] admin-portal/next.config.mjs
- [ ] admin-portal/tailwind.config.ts
- [ ] admin-portal/tsconfig.json

Verification:
- [ ] npm run build passes
- [ ] npm run lint passes
- [ ] Deployed to admin.keeprcompliance.com
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
