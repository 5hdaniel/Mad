# Task TASK-1510: Browser Auth Landing Page with Provider Selection

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-548
**Status**: Ready
**Execution**: Sequential (Phase 3, after TASK-1507)

---

## MANDATORY WORKFLOW (6 Steps)

**DO NOT SKIP ANY STEP. Each agent step requires recording the Agent ID.**

```
Step 1: PLAN        -> Plan Agent creates implementation plan
                       Record: Plan Agent ID

Step 2: SR REVIEW   -> SR Engineer reviews and approves plan
                       Record: SR Engineer Agent ID

Step 3: USER REVIEW -> User reviews and approves plan
                       GATE: Wait for user approval

Step 4: COMPACT     -> Context reset before implementation
                       /compact or new session

Step 5: IMPLEMENT   -> Engineer implements approved plan
                       Record: Engineer Agent ID

Step 6: PM UPDATE   -> PM updates sprint/backlog/metrics
```

**Reference:** `.claude/docs/ENGINEER-WORKFLOW.md`

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow`
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1510-auth-provider-selection`

---

## Goal

Create a browser landing page that allows users to choose their OAuth provider (Google or Microsoft) before authenticating. Currently, "Sign in with Browser" hardcodes Google. This blocks Microsoft/Outlook auth testing.

## Non-Goals

- Do NOT modify the deep link callback handler (TASK-1507 already handles this)
- Do NOT change how tokens are received (existing `magicaudit://callback` flow)
- Do NOT add new OAuth providers beyond Google and Microsoft
- Do NOT implement custom auth (use Supabase OAuth)

---

## Estimated Tokens

**Est. Tokens**: ~20K (feature)
**Token Cap**: ~80K (4x estimate)

---

## Deliverables

### Recommended Approach: Broker Portal Page

Create/update the auth landing page at `broker-portal/app/auth/desktop/` to show provider selection.

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `broker-portal/app/auth/desktop/page.tsx` | Modify | Add provider selection UI with Google/Microsoft buttons |
| `broker-portal/app/auth/desktop/components/ProviderButton.tsx` | Create | Reusable provider button component |
| `electron/preload/authBridge.ts` | Modify | Update URL to point to provider selection page (if needed) |

---

## Implementation Notes

### Step 1: Update Broker Portal Auth Page

The page should:
1. Display Magic Audit branding
2. Show two provider buttons: Google and Microsoft
3. Each button redirects to Supabase OAuth with appropriate provider

```typescript
// broker-portal/app/auth/desktop/page.tsx
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function DesktopAuthPage() {
  const supabase = createClientComponentClient();

  const handleProviderLogin = async (provider: 'google' | 'azure') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'magicaudit://callback',
      },
    });

    if (error) {
      console.error('OAuth error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Magic Audit</h1>
          <p className="text-gray-600 mt-2">Sign in to continue</p>
        </div>

        {/* Provider Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => handleProviderLogin('google')}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          <button
            onClick={() => handleProviderLogin('azure')}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-3"
          >
            <MicrosoftIcon />
            <span>Continue with Microsoft</span>
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          You will be redirected back to the app after signing in.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      {/* Google icon SVG path */}
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      {/* Microsoft icon SVG path */}
    </svg>
  );
}
```

### Step 2: Ensure Correct Redirect URL

The desktop app's `openAuthInBrowser()` should open the broker portal page, not Supabase directly.

In `electron/preload/authBridge.ts`:
```typescript
openAuthInBrowser: (): void => {
  // Points to broker portal provider selection page
  const authUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/auth/desktop'
    : 'https://app.magicaudit.com/auth/desktop';

  shell.openExternal(authUrl);
},
```

### Step 3: Supabase Configuration

Ensure both providers are configured in Supabase dashboard:
- Google OAuth (existing)
- Microsoft/Azure OAuth (may need setup)

Both must have `magicaudit://callback` as allowed redirect URL.

---

## Testing Requirements

### Manual Testing

1. **Google Sign In**:
   - Click "Sign in with Browser"
   - Verify landing page shows provider options
   - Click "Continue with Google"
   - Complete Google OAuth
   - Verify redirect back to app works
   - Verify login completes successfully

2. **Microsoft Sign In**:
   - Click "Sign in with Browser"
   - Click "Continue with Microsoft"
   - Complete Microsoft OAuth
   - Verify redirect back to app works
   - Verify login completes successfully

3. **Error Handling**:
   - Cancel OAuth flow
   - Verify can return to provider selection
   - Verify can retry with different provider

---

## Acceptance Criteria

- [ ] Clicking "Sign in with Browser" opens provider selection page
- [ ] Google button initiates Google OAuth flow
- [ ] Microsoft button initiates Microsoft/Azure OAuth flow
- [ ] Successful Google auth redirects to app with tokens
- [ ] Successful Microsoft auth redirects to app with tokens
- [ ] Page displays Magic Audit branding
- [ ] Both flows work with existing deep link handling (no changes to callback)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Integration Notes

- **Depends on**: TASK-1507 (deep link auth flow) - Complete
- **Prerequisite**: Microsoft OAuth configured in Supabase dashboard
- **Next**: Continue Phase 3 testing

---

## Do / Don't

### Do:
- Use Supabase's built-in OAuth providers
- Match Magic Audit branding on landing page
- Use recognizable provider icons/colors
- Test both providers end-to-end

### Don't:
- Modify the deep link callback handler
- Change how tokens are processed in main.ts
- Hardcode OAuth URLs (use Supabase SDK)
- Skip testing either provider

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Microsoft OAuth not configured in Supabase
- Broker portal deployment is blocked
- Deep link redirect not working for one provider
- Provider SDK behaves differently than expected

---

## PR Preparation

**Title**: `feat: add browser auth landing page with provider selection`

**Labels**: `sprint-062`, `auth`, `feature`

**PR Body Template**:
```markdown
## Summary
- Add provider selection landing page to broker-portal
- Support Google and Microsoft OAuth providers
- Update desktop app to open provider selection page

## Test Plan
- [ ] Google: sign in -> callback -> app authenticated
- [ ] Microsoft: sign in -> callback -> app authenticated
- [ ] Cancel flow -> can retry with either provider
- [ ] Page displays correctly with branding

## Dependencies
- TASK-1507 (deep link auth flow) - Complete
- Microsoft OAuth configured in Supabase
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | Pending |
| 4. Compact | (Context reset) | N/A | N/A | Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | Pending |
| 6. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

*To be completed by Engineer Agent after implementation*

### Files Changed
- [ ] List files changed here

### Approach Taken
- Describe approach taken

### Testing Done
- [ ] TypeScript type-check passes
- [ ] ESLint passes
- [ ] Manual testing of Google flow
- [ ] Manual testing of Microsoft flow

### Notes for SR Review
- Any notes for the SR Engineer
