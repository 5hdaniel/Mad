# TASK-1824: Add Microsoft Clarity Analytics to Broker Portal

**Backlog Item:** BACKLOG-624
**Status:** pending
**Estimated Tokens:** ~2-3K
**Category:** feature
**Created:** 2026-02-06

## Objective

Integrate Microsoft Clarity analytics into the broker-portal Next.js app to enable session recordings, heatmaps, and user behavior tracking.

## Requirements

### 1. Install Clarity Package

```bash
cd broker-portal
npm install @microsoft/clarity
```

### 2. Add Environment Variable

Create/update `broker-portal/.env.local` (for local testing):
```
NEXT_PUBLIC_CLARITY_PROJECT_ID=your_project_id_here
```

**Note:** The actual project ID will be provided by the user or found in their Clarity dashboard.

### 3. Initialize Clarity in Root Layout

Add Clarity initialization to `broker-portal/app/layout.tsx`:

**Implementation Guidelines:**
- Use the `next/script` component with `afterInteractive` strategy
- Only load in production environment
- Use the environment variable for project ID
- Check both `NODE_ENV` and optionally `NEXT_PUBLIC_VERCEL_ENV`

**Example approach:**
```tsx
import Script from 'next/script';

// In the root layout component
{process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
  <Script
    id="clarity-script"
    strategy="afterInteractive"
    dangerouslySetInnerHTML={{
      __html: `
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
      `
    }}
  />
)}
```

**Alternative:** If using the NPM package's API, follow the package documentation for initialization.

### 4. Vercel Environment Configuration

After implementation, the environment variable must be added to Vercel:
- Go to Vercel project settings → Environment Variables
- Add `NEXT_PUBLIC_CLARITY_PROJECT_ID` with the project ID value
- Set for "Production" environment
- Redeploy to apply

## Acceptance Criteria

- [ ] `@microsoft/clarity` or `clarity-js` package installed in `broker-portal/package.json`
- [ ] Clarity initialization added to root layout (`app/layout.tsx`)
- [ ] Uses `NEXT_PUBLIC_CLARITY_PROJECT_ID` environment variable (not hardcoded)
- [ ] Only loads when `NODE_ENV === 'production'`
- [ ] Uses `next/script` with `afterInteractive` strategy
- [ ] No TypeScript errors
- [ ] No console errors in browser when running locally in production mode
- [ ] Documentation added (inline comments explaining the setup)

## Testing Plan

### Local Testing (Production Mode)
```bash
cd broker-portal
npm run build
npm run start
```

- Open browser dev tools
- Verify no Clarity errors in console
- Verify Clarity script tag is present in DOM
- Verify Clarity does NOT load in development mode (`npm run dev`)

### Production Testing (After Deployment)
- Deploy to Vercel with environment variable set
- Visit production URL
- Check Clarity dashboard for incoming session data (may take a few minutes)

## Files to Modify

- `broker-portal/package.json` - Add Clarity dependency
- `broker-portal/app/layout.tsx` - Add Clarity initialization
- `broker-portal/.env.example` - Document the environment variable (optional)

## Implementation Notes

- **Do not hardcode** the Clarity project ID
- The script should be loaded using Next.js Script component for optimal performance
- Use `afterInteractive` strategy to avoid blocking page interactivity
- Consider adding a comment explaining what Clarity does for future maintainers

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** feature/task-1824-microsoft-clarity

## Agent ID

**Engineer Agent ID:** _[To be filled by implementing agent]_

## Implementation Summary

_[To be completed by implementing agent after work is done]_

### Changes Made
- _[List files modified/created]_

### Issues/Blockers
- _[Document any issues encountered or state "None"]_

### Testing Results
- _[Summary of local testing]_
- _[Note about production verification needed after deployment]_
