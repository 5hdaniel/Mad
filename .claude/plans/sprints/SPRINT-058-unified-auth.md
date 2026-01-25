# Sprint Plan: SPRINT-058 - Unified Browser-Based Auth

**Created**: 2026-01-24
**Updated**: 2026-01-24
**Status**: Blocked (Waiting for SPRINT-057)
**Goal**: Implement single browser-based authentication flow with license validation
**Track**: Consumer Launch (3 of 4)
**Dependencies**: SPRINT-057 (Supabase license system must be working)

---

## Sprint Goal

This sprint implements a unified browser-based authentication flow (like Figma, Slack, VS Code):

1. **Browser-Based OAuth** - All auth happens in system browser, not Electron popup
2. **Deep Link Callback** - Desktop receives auth token via `magicaudit://callback`
3. **License Gate at Login** - Validate license immediately after successful auth
4. **Single Flow for All Account Types** - Consumer, enterprise, invited users

This enables:
- Consistent auth experience across desktop and web
- Password manager compatibility
- Better security (no credentials in Electron)
- Seamless license validation at entry point

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] Verify SPRINT-057 is complete (Supabase license system works)
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install && npm rebuild better-sqlite3-multiple-ciphers && npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`

---

## Current vs Target Auth Flow

### Current Flow (Problems)

```
Desktop App:
1. User clicks "Login with Google"
2. Electron opens OAuth popup window
3. Popup handles redirect
4. Token stored in Electron
5. App continues (no license check)

Broker Portal:
1. User goes to portal URL
2. OAuth via Supabase Auth
3. Callback checks org membership
4. Blocks if not in organization_members ❌
```

**Issues**:
- Two different auth flows
- Desktop popups are problematic (security, password managers)
- No license check at login
- Broker portal blocks users before they can do anything

### Target Flow (Solution)

```
Both Desktop and Web:
1. User clicks "Login" → opens system browser
2. Browser goes to auth.magicaudit.com
3. User logs in (any provider)
4. Success → redirect to magicaudit://callback?token=...
5. Desktop receives token via deep link
6. Validate license (block if expired)
7. Show appropriate screen (app, trial prompt, device limit)
```

**Benefits**:
- Single auth flow
- Password manager works
- License check at entry point
- Smooth onboarding for all user types

---

## In Scope (4 Items)

### Phase 1: Deep Link Handler (Sequential)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-482 | Desktop Deep Link Handler | ~25K | P0 | TASK-1191 |

### Phase 2: Auth Landing Page (Sequential - After Phase 1)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-483 | Browser Auth Landing Page | ~30K | P0 | TASK-1192 |

### Phase 3: License Gate Integration (Sequential - After Phase 2)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-484 | License Validation at Auth | ~15K | P0 | TASK-1193 |

### Phase 4: Migration & Cleanup (Sequential - After Phase 3)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-485 | Deprecate OAuth Popup Flow | ~10K | P2 | TASK-1194 |

---

## Phase Plan

### Phase 1: Deep Link Handler

**Goal**: Desktop app can receive auth tokens via `magicaudit://` URL scheme

**Implementation**:

1. **Register URL Scheme (macOS)**:
   ```json
   // electron-builder config
   {
     "protocols": {
       "name": "Magic Audit",
       "schemes": ["magicaudit"]
     }
   }
   ```

   ```xml
   <!-- build/entitlements.mac.plist -->
   <key>com.apple.developer.associated-domains</key>
   <array>
     <string>applinks:auth.magicaudit.com</string>
   </array>
   ```

2. **Handle Deep Link in Main Process**:
   ```typescript
   // electron/main.ts
   app.on('open-url', (event, url) => {
     event.preventDefault();
     handleAuthCallback(url);
   });

   function handleAuthCallback(url: string) {
     const parsed = new URL(url);
     // magicaudit://callback?access_token=...&refresh_token=...

     const accessToken = parsed.searchParams.get('access_token');
     const refreshToken = parsed.searchParams.get('refresh_token');

     if (accessToken && refreshToken) {
       // Store tokens
       // Notify renderer
       mainWindow?.webContents.send('auth:callback', {
         accessToken,
         refreshToken
       });
     }
   }
   ```

3. **Windows Deep Link** (different approach):
   ```typescript
   // Windows uses second instance
   app.on('second-instance', (event, commandLine) => {
     const url = commandLine.find(arg => arg.startsWith('magicaudit://'));
     if (url) handleAuthCallback(url);
   });
   ```

**Files to Modify**:
- `electron/main.ts`
- `electron-builder.yml` or `package.json` build config
- `build/entitlements.mac.plist`
- `electron/preload.ts` (expose auth:callback listener)

**Integration checkpoint**: App opens when `magicaudit://callback?token=test` is triggered.

---

### Phase 2: Auth Landing Page

**Goal**: Create web page that handles OAuth and redirects to desktop

**Implementation Options**:

**Option A**: Add to existing broker-portal:
```
broker-portal/app/auth/desktop/page.tsx
```

**Option B**: Separate auth subdomain:
```
auth.magicaudit.com (simple static site)
```

**Recommended**: Option A (reuse existing Supabase Auth setup)

**Flow**:

```
1. Desktop opens: https://app.magicaudit.com/auth/desktop?returnTo=magicaudit://callback

2. Web page shows login options:
   [Login with Google]
   [Login with Microsoft]

3. User clicks → Supabase OAuth

4. Supabase callback → /auth/desktop/callback

5. Callback page:
   - Gets session from Supabase
   - Redirects to: magicaudit://callback?access_token=...&refresh_token=...
   - Shows "Redirecting to Magic Audit..." message
   - Fallback: "Click here to open Magic Audit"
```

**Web Page Code**:
```typescript
// broker-portal/app/auth/desktop/page.tsx
'use client';

import { createClient } from '@/lib/supabase/client';

export default function DesktopAuth() {
  const supabase = createClient();

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/desktop/callback`
      }
    });
  };

  const loginWithMicrosoft = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/desktop/callback`,
        scopes: 'email profile openid'
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4">
        <h1>Sign in to Magic Audit</h1>
        <button onClick={loginWithGoogle}>Continue with Google</button>
        <button onClick={loginWithMicrosoft}>Continue with Microsoft</button>
      </div>
    </div>
  );
}
```

```typescript
// broker-portal/app/auth/desktop/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DesktopCallback() {
  const [status, setStatus] = useState('Signing you in...');

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Redirect to desktop app with tokens
        const callbackUrl = new URL('magicaudit://callback');
        callbackUrl.searchParams.set('access_token', session.access_token);
        callbackUrl.searchParams.set('refresh_token', session.refresh_token);

        setStatus('Opening Magic Audit...');
        window.location.href = callbackUrl.toString();

        // Fallback after 2 seconds
        setTimeout(() => {
          setStatus('Click below if Magic Audit didn\'t open');
        }, 2000);
      } else {
        setStatus('Login failed. Please try again.');
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>{status}</p>
        <a
          href="magicaudit://callback"
          className="mt-4 text-blue-600 underline"
        >
          Open Magic Audit
        </a>
      </div>
    </div>
  );
}
```

**Files to Create/Modify**:
- `broker-portal/app/auth/desktop/page.tsx`
- `broker-portal/app/auth/desktop/callback/page.tsx`
- Update Supabase redirect URLs in dashboard

**Integration checkpoint**: Full flow works: desktop → browser → login → desktop.

---

### Phase 3: License Gate Integration

**Goal**: Validate license immediately after successful auth

**Flow**:
```
1. Desktop receives tokens via deep link
2. Set Supabase session with tokens
3. Get user ID
4. Call validateLicense(userId) from SPRINT-057
5. Based on result:
   - Valid: Continue to app
   - Expired: Show upgrade screen
   - Device limit: Show device management
   - No license: Create trial license
```

**Implementation**:
```typescript
// In auth callback handler
async function handleAuthSuccess(accessToken: string, refreshToken: string) {
  // 1. Set session
  const { data: { user } } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (!user) {
    showError('Login failed');
    return;
  }

  // 2. Validate license
  const licenseStatus = await validateLicense(user.id);

  if (!licenseStatus.isValid) {
    // Show appropriate screen
    navigateTo('/license-blocked', { reason: licenseStatus.blockReason });
    return;
  }

  // 3. Register device
  const deviceResult = await registerDevice(user.id);

  if (!deviceResult.success) {
    navigateTo('/device-limit');
    return;
  }

  // 4. Continue to app
  navigateTo('/dashboard');
}
```

**Files to Modify**:
- `electron/main.ts` (auth callback handler)
- `src/App.tsx` (license gate routes)
- `src/appCore/state/flows/useAuthFlow.ts` (if applicable)

**Integration checkpoint**: Expired license blocks access at login.

---

### Phase 4: Migration & Cleanup

**Goal**: Remove old OAuth popup code, update documentation

**Tasks**:
1. Deprecate (don't delete yet):
   - `electron/services/googleAuthService.ts` OAuth popup methods
   - `electron/services/microsoftAuthService.ts` OAuth popup methods

2. Update login UI:
   - "Login with Google" → opens browser
   - "Login with Microsoft" → opens browser

3. Update documentation:
   - `AUTO_UPDATE_GUIDE.md`
   - Any auth-related docs

**Files to Modify**:
- `src/components/LoginScreen.tsx` or equivalent
- Auth service files (deprecation comments)
- Documentation

**Integration checkpoint**: All auth flows use browser-based approach.

---

## Dependency Graph

```yaml
dependency_graph:
  nodes:
    - id: SPRINT-057
      type: sprint
      title: "Supabase License System"
      status: must_be_complete
    - id: BACKLOG-482
      type: task
      phase: 1
      title: "Desktop Deep Link Handler"
    - id: BACKLOG-483
      type: task
      phase: 2
      title: "Browser Auth Landing Page"
    - id: BACKLOG-484
      type: task
      phase: 3
      title: "License Validation at Auth"
    - id: BACKLOG-485
      type: task
      phase: 4
      title: "Deprecate OAuth Popup Flow"

  edges:
    - from: SPRINT-057
      to: BACKLOG-482
      type: depends_on
      reason: "License validation requires Supabase system"
    - from: BACKLOG-482
      to: BACKLOG-483
      type: depends_on
    - from: BACKLOG-483
      to: BACKLOG-484
      type: depends_on
    - from: BACKLOG-484
      to: BACKLOG-485
      type: depends_on
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deep link not working on Windows | Medium | High | Test early, have fallback (manual token entry) |
| Browser popup blocked | Low | Medium | Use window.location, not window.open |
| Token expiry during redirect | Low | Low | Tokens have sufficient lifetime |
| Users confused by browser redirect | Medium | Low | Clear messaging in UI |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: Deep Link | BACKLOG-482 | ~25K | Sequential |
| Phase 2: Auth Page | BACKLOG-483 | ~30K | Sequential |
| Phase 3: License Gate | BACKLOG-484 | ~15K | Sequential |
| Phase 4: Cleanup | BACKLOG-485 | ~10K | Sequential |
| **Total** | **4 tasks** | **~80K** | - |

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-1191 | BACKLOG-482 | Blocked | - | - | - |
| 2 | TASK-1192 | BACKLOG-483 | Blocked | - | - | - |
| 3 | TASK-1193 | BACKLOG-484 | Blocked | - | - | - |
| 4 | TASK-1194 | BACKLOG-485 | Blocked | - | - | - |

**Blocker**: SPRINT-057 must complete first.

---

## Success Criteria

- [ ] `magicaudit://` deep link registered on macOS and Windows
- [ ] Desktop opens browser for login
- [ ] Browser auth page shows Google/Microsoft options
- [ ] Successful login redirects back to desktop
- [ ] License validated before entering app
- [ ] Expired license blocked at login
- [ ] Old OAuth popup code deprecated

---

## Next Sprint

After SPRINT-058 completes, proceed to **SPRINT-059: Telemetry Foundation**.
