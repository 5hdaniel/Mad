# BACKLOG-397: Portal - Supabase Auth (OAuth)

**Priority:** P0 (Critical)
**Category:** auth / portal
**Created:** 2026-01-22
**Status:** Completed
**Sprint:** SPRINT-050
**Estimated Tokens:** ~20K

---

## Summary

Implement authentication for the broker portal using Supabase Auth with Google and Microsoft OAuth providers, matching the desktop app's authentication experience.

---

## Problem Statement

The broker portal needs:
1. Secure authentication before accessing submissions
2. OAuth with Google and Microsoft (same as desktop)
3. Session management with Supabase
4. Route protection (middleware)
5. User context for RLS policies

---

## Proposed Solution

### Login Page

Create `broker-portal/app/login/page.tsx`:

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) console.error('Error:', error)
  }

  const signInWithMicrosoft = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile openid',
      },
    })
    if (error) console.error('Error:', error)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Magic Audit
          </h1>
          <p className="mt-2 text-gray-600">
            Broker Portal
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <GoogleIcon className="h-5 w-5" />
            <span>Continue with Google</span>
          </button>

          <button
            onClick={signInWithMicrosoft}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <MicrosoftIcon className="h-5 w-5" />
            <span>Continue with Microsoft</span>
          </button>
        </div>

        <p className="text-sm text-center text-gray-500">
          Sign in with your brokerage email to access submissions.
        </p>
      </div>
    </div>
  )
}
```

### Auth Callback Handler

Create `broker-portal/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth error:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }
    
    // Verify user is a member of an organization with broker/admin role
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['broker', 'admin'])
        .single()
      
      if (!membership) {
        // User exists but is not a broker/admin
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_authorized`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

### Middleware (Route Protection)

Create `broker-portal/middleware.ts`:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect logged-in users away from login
  if (request.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Auth Context

Create `broker-portal/components/providers/AuthProvider.tsx`:

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

### Logout Handler

Create `broker-portal/app/auth/logout/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  
  const requestUrl = new URL(request.url)
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `broker-portal/app/login/page.tsx` | Login page with OAuth buttons |
| `broker-portal/app/auth/callback/route.ts` | OAuth callback handler |
| `broker-portal/app/auth/logout/route.ts` | Logout handler |
| `broker-portal/middleware.ts` | Route protection |
| `broker-portal/components/providers/AuthProvider.tsx` | Auth context |
| `broker-portal/app/layout.tsx` | Wrap with AuthProvider |

---

## Dependencies

- BACKLOG-396: Next.js project setup
- BACKLOG-388: RLS policies (auth enables RLS)

---

## Acceptance Criteria

- [ ] Login page displays with Google and Microsoft options
- [ ] Google OAuth redirects and authenticates
- [ ] Microsoft OAuth redirects and authenticates
- [ ] Auth callback exchanges code for session
- [ ] Non-broker users rejected with error message
- [ ] Middleware protects /dashboard routes
- [ ] Session persists across page refreshes
- [ ] Logout clears session and redirects
- [ ] Auth state available via useAuth hook

---

## Technical Notes

### Supabase Auth Providers

Both Google and Microsoft are already configured in the Supabase project (used by desktop app). The broker portal uses the same providers.

### Role Verification

After successful OAuth, verify the user has a broker or admin role:

```typescript
const { data: membership } = await supabase
  .from('organization_members')
  .select('role, organization_id')
  .eq('user_id', user.id)
  .in('role', ['broker', 'admin'])
  .single()
```

If no membership found, sign out and show error.

### Session Storage

Supabase SSR uses cookies for session storage. This enables:
- Server-side session access
- Middleware protection
- Automatic refresh

### Error States

Handle these error cases on login page:

| Error Code | Message |
|------------|---------|
| `auth_failed` | "Authentication failed. Please try again." |
| `not_authorized` | "Your account is not authorized for the broker portal." |

```tsx
const searchParams = useSearchParams()
const error = searchParams.get('error')

{error === 'not_authorized' && (
  <Alert variant="error">
    Your account is not authorized to access the broker portal.
    Contact your administrator.
  </Alert>
)}
```

---

## Testing Plan

1. Click Google login, complete OAuth flow
2. Click Microsoft login, complete OAuth flow
3. Verify redirect to dashboard after auth
4. Access /dashboard without login, verify redirect to /login
5. Create user without broker role, verify rejected
6. Click logout, verify session cleared
7. Refresh page, verify session persists
8. Test error message display

---

## Related Items

- BACKLOG-396: Next.js Setup (dependency)
- BACKLOG-388: RLS Policies (auth enables RLS)
- BACKLOG-398: Dashboard (uses auth context)
- SPRINT-050: B2B Broker Portal Demo
