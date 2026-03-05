# BACKLOG-839: Smart download/open prompt on auth callback page

## Summary

Added conditional UI to the desktop auth callback page (`/auth/desktop/callback`) that checks whether the user has ever logged in from the Keepr desktop app by querying the `devices` table.

## Behavior

- **No desktop devices found**: Shows "Download Keepr" as the primary button with a small "Open Keepr" text link below ("Already have Keepr? Open Keepr")
- **Desktop devices exist**: Shows "Open Keepr" as the primary blue button with a secondary gray "Download Keepr" button alongside it

## Implementation

- File changed: `broker-portal/app/auth/desktop/callback/page.tsx`
- Added `hasDesktopApp` state variable
- After auth succeeds, queries `devices` table for the user (`limit 1`)
- Conditional rendering in the success state based on `hasDesktopApp`

## PR

- PR #1026 merged to develop
- Deployed to production via Vercel CLI (`app.keeprcompliance.com`)
