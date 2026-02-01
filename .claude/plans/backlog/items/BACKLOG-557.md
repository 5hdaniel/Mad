# BACKLOG-557: macOS Gatekeeper Blocks App - Notarization Required for Distribution

**Created**: 2026-01-27
**Priority**: P1 (High - Blocks user testing/distribution)
**Type**: Infrastructure
**Related**: TASK-1174 (Apple Signing Certificate)

---

## Problem Statement

When test users try to install the DMG, macOS displays:

> **"MagicAudit" Not Opened**
> Apple could not verify "MagicAudit" is free of malware that may harm your Mac or compromise your privacy.
> [Done] [Move to Trash]

This prevents users from installing the app without manual workarounds.

## Root Cause

The app is **signed but not notarized**. Build output shows:

```
• signing         file=dist/mac-arm64/MagicAudit.app platform=darwin type=distribution
• skipped macOS notarization  reason=`notarize` options were unable to be generated
Skipping notarization: Missing APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID environment variables
```

## Current State

| Step | Status |
|------|--------|
| Code signing | ✅ Working (Developer ID certificate) |
| Notarization | ❌ Skipped (missing credentials) |
| Gatekeeper approval | ❌ Blocked |

## User Workarounds (Temporary)

Users can bypass Gatekeeper with one of:

1. **Right-click → Open** (shows "Open Anyway" option)
2. **System Settings → Privacy & Security → "Open Anyway"**
3. **Terminal**: `xattr -cr /Applications/MagicAudit.app`

These are NOT acceptable for production distribution.

## Solution

Set up notarization credentials in `.env.local`:

```bash
# Apple Developer Credentials for Notarization
APPLE_ID=your-apple-id@example.com
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### Steps to Get Credentials

1. **APPLE_ID**: Your Apple Developer account email

2. **APPLE_TEAM_ID**:
   - Go to https://developer.apple.com/account
   - Click "Membership" → Team ID is displayed
   - Or run: `security find-identity -v -p codesigning`

3. **APPLE_APP_SPECIFIC_PASSWORD**:
   - Go to https://appleid.apple.com
   - Security → App-Specific Passwords → Generate
   - Name it "MagicAudit Notarization"
   - Copy the `xxxx-xxxx-xxxx-xxxx` format password

## Acceptance Criteria

- [ ] Notarization credentials configured in `.env.local`
- [ ] `npm run package` completes with notarization success
- [ ] DMG passes Gatekeeper without warnings
- [ ] `spctl -a -vv dist/mac-arm64/MagicAudit.app` shows "accepted source=Notarized Developer ID"

## Documentation

Full setup guide: `NOTARIZATION.md`

## Notes

- Notarization adds 5-15 minutes to build time (Apple server processing)
- Credentials should NEVER be committed to git
- For CI/CD, credentials go in GitHub Secrets (see TASK-1174)
