# BACKLOG-406: Fix Apple Signing Certificate for macOS Release

**Priority:** P1 (High)
**Category:** infrastructure / release
**Created:** 2026-01-22
**Status:** Pending
**Estimated Tokens:** ~5K

---

## Summary

Fix the Apple signing certificate issue preventing macOS builds from completing in the v2.0.0 release workflow.

---

## Problem Statement

The v2.0.0 release workflow failed for macOS at the "Import Apple Certificate" step. Windows build succeeded and `MagicAudit.Setup.2.0.0.exe` was uploaded, but no macOS artifacts (`.dmg`, `.zip`) were produced.

**Current state:**
- Windows: SUCCESS - `MagicAudit.Setup.2.0.0.exe` available
- macOS: FAILED - No artifacts, certificate import error

---

## Proposed Solution

1. **Export new Apple Developer certificate** as `.p12` file from Keychain Access
2. **Base64 encode** the certificate: `base64 -i certificate.p12 | pbcopy`
3. **Update GitHub Secrets:**
   - `APPLE_CERTIFICATE` - base64-encoded .p12 content
   - `APPLE_CERTIFICATE_PASSWORD` - password used when exporting
4. **Verify Apple Developer credentials:**
   - `APPLE_ID` - Apple Developer account email
   - `APPLE_ID_PASSWORD` - App-specific password (not account password)
   - `APPLE_TEAM_ID` - Team ID from Apple Developer portal
5. **Re-run release workflow** or create new patch release (v2.0.1)

---

## Files to Check

| File | Purpose |
|------|---------|
| `.github/workflows/release.yml` | Release workflow with signing steps |
| `scripts/notarize.js` | macOS notarization script |
| `build/entitlements.mac.plist` | macOS entitlements |

---

## Acceptance Criteria

- [ ] Apple certificate exported and base64 encoded
- [ ] GitHub Secrets updated with valid credentials
- [ ] Release workflow completes for macOS
- [ ] Both `.dmg` and `.zip` artifacts uploaded to release
- [ ] v2.0.0 (or v2.0.1) release has Windows AND macOS installers

---

## Technical Notes

### Certificate Export Steps

1. Open Keychain Access
2. Find "Developer ID Application" certificate
3. Right-click > Export
4. Save as `.p12` with password
5. Base64 encode: `base64 -i Certificates.p12 | pbcopy`
6. Paste into GitHub Secrets as `APPLE_CERTIFICATE`

### App-Specific Password

For `APPLE_ID_PASSWORD`, create an app-specific password at:
https://appleid.apple.com/account/manage > Security > App-Specific Passwords

---

## Related Items

- Release v2.0.0: https://github.com/5hdaniel/Mad/releases/tag/v2.0.0
- SPRINT-049: Testing sprint that preceded this release
