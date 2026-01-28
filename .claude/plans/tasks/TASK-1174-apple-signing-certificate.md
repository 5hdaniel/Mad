# TASK-1174: Fix Apple Signing Certificate for macOS Release

**Sprint**: SPRINT-052
**Backlog Item**: BACKLOG-406
**Status**: Pending
**Estimated Tokens**: ~5K

---

## Summary

Fix the Apple signing certificate issue preventing macOS builds from completing in the release workflow. Windows build succeeded but macOS failed at "Import Apple Certificate" step.

---

## Branch Information

**Branch From**: develop
**Branch Into**: develop
**Branch Name**: fix/task-1174-apple-signing

**Note**: This is primarily a GitHub Secrets and certificate management task, not a code change.

---

## Problem Statement

The v2.0.0 release workflow failed for macOS at the "Import Apple Certificate" step.

**Current state:**
- Windows: SUCCESS - `MagicAudit.Setup.2.0.0.exe` available
- macOS: FAILED - No artifacts, certificate import error

---

## Requirements

### Functional Requirements

1. **Export valid Apple Developer certificate**
   - Must be "Developer ID Application" certificate
   - Must be exported as .p12 with password

2. **Update GitHub Secrets**
   - `APPLE_CERTIFICATE` - base64-encoded .p12 content
   - `APPLE_CERTIFICATE_PASSWORD` - export password
   - Verify Apple Developer credentials are correct

3. **Test release workflow**
   - macOS build should complete
   - Both .dmg and .zip artifacts should be uploaded

---

## Technical Steps

### 1. Export Apple Certificate

```bash
# 1. Open Keychain Access on macOS
# 2. Find "Developer ID Application: <Your Name/Org>" certificate
# 3. Right-click > Export
# 4. Save as .p12 with a strong password
```

### 2. Base64 Encode Certificate

```bash
base64 -i Certificates.p12 | pbcopy
# Paste result into GitHub Secrets
```

### 3. Update GitHub Secrets

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 content |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting |
| `APPLE_ID` | Apple Developer account email (verify correct) |
| `APPLE_ID_PASSWORD` | App-specific password (not account password) |
| `APPLE_TEAM_ID` | Team ID from Apple Developer portal |

### 4. Create App-Specific Password (if needed)

If `APPLE_ID_PASSWORD` is outdated:
1. Go to https://appleid.apple.com/account/manage
2. Security > App-Specific Passwords
3. Generate new password
4. Update GitHub Secret

### 5. Test Release Workflow

```bash
# Option 1: Re-run failed workflow
gh run rerun <workflow-run-id>

# Option 2: Create patch release
git tag v2.0.1
git push origin v2.0.1
# This triggers the release workflow
```

---

## Files to Check (Not Modify)

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
- [ ] .dmg artifact uploaded to release
- [ ] .zip artifact uploaded to release
- [ ] Code signing verified (no Gatekeeper warnings)
- [ ] Notarization completed (apple stapling)

---

## Testing Requirements

### Manual Testing
1. Trigger release workflow (via re-run or new tag)
2. Verify macOS job completes successfully
3. Download .dmg and .zip artifacts
4. Install on macOS, verify no security warnings
5. Verify app launches correctly

---

## Dependencies

- Access to Apple Developer account
- Access to GitHub repository secrets

---

## Blocked By

- None (independent infrastructure task)

---

## Blocks

- None

---

## Notes

- This task does NOT require code changes
- Primary work is certificate management and GitHub Secrets
- May need to involve team member with Apple Developer access
- Consider documenting certificate renewal process for future

---

## Implementation Summary

*To be filled by engineer after implementation*

### Steps Completed
-

### Secrets Updated
-

### Release Workflow Results
-

### PR
- N/A (no code changes) or chore PR if workflow file updated
