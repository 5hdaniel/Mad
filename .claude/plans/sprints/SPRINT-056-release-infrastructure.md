# Sprint Plan: SPRINT-056 - Release Infrastructure

**Created**: 2026-01-24
**Updated**: 2026-01-24
**Status**: Ready
**Goal**: Get macOS release builds working with code signing and verify auto-updater
**Track**: Consumer Launch (1 of 4)

---

## Sprint Goal

This sprint focuses on release infrastructure - the foundation needed to ship and update the consumer desktop app:

1. **Apple Code Signing on GitHub Actions** - Fix the certificate/secrets issue so CI builds are signed
2. **Auto-Updater Verification** - Test the existing auto-updater works end-to-end
3. **Release Pipeline Test** - Complete a full signed release cycle

This is a prerequisite for all consumer testing - you can't distribute without signing.

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`

**Human Prerequisites (Required):**
- [ ] Access to Apple Developer account
- [ ] Existing signing certificate (works locally)
- [ ] Access to GitHub repository secrets

---

## In Scope (3 Items)

### Phase 1: Apple Signing Fix (Sequential - Human + Engineer)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-406 | Fix Apple Signing Certificate for macOS Release | ~10K | P0 | TASK-1183 |

### Phase 2: Auto-Updater Verification (Sequential - After Phase 1)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-475 | Verify Auto-Updater End-to-End | ~15K | P0 | TASK-1184 |

### Phase 3: Release Pipeline Test (Sequential - After Phase 2)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-476 | Complete Signed Release Cycle Test | ~5K | P1 | TASK-1185 |

---

## Phase Plan

### Phase 1: Apple Signing Fix

**Goal**: Get GitHub Actions to produce signed and notarized macOS builds

**Current State**:
- Local signing works
- GitHub Actions workflow exists (`.github/workflows/release.yml`)
- Secrets not configured or misconfigured

**Steps (Human + Engineer)**:

1. **Export Certificate (Human)**:
   ```bash
   # Find your Developer ID Application certificate
   security find-identity -v -p codesigning

   # Export to .p12 (include private key)
   # Use Keychain Access GUI: Right-click cert > Export > .p12
   ```

2. **Encode and Upload (Human)**:
   ```bash
   # Base64 encode the certificate
   base64 -i ~/path/to/certificate.p12 | pbcopy

   # Add to GitHub Secrets:
   # Settings > Secrets > Actions > New repository secret
   # MACOS_CERTIFICATE = (paste base64)
   # MACOS_CERTIFICATE_PASSWORD = (your .p12 password)
   ```

3. **Notarization Secrets (Human)**:
   ```
   APPLE_ID = your@email.com
   APPLE_APP_PASSWORD = app-specific-password (from appleid.apple.com)
   APPLE_TEAM_ID = XXXXXXXXXX (10 char team ID)
   ```

4. **Test Build (Engineer)**:
   - Trigger workflow manually
   - Verify signing succeeds
   - Download and test artifact

**Files Modified**:
- GitHub Secrets (web UI)
- Possibly `.github/workflows/release.yml` if adjustments needed

**Integration checkpoint**: `release-macos` job succeeds with signed artifacts.

---

### Phase 2: Auto-Updater Verification

**Goal**: Confirm auto-updater downloads and installs new versions

**Current State**:
- Auto-updater code exists in `electron/main.ts`
- Update handlers in `electron/handlers/updaterHandlers.ts`
- Never tested end-to-end with signed builds

**Test Plan**:

1. **Install v1.0.X (current)**:
   - Build and install signed version
   - Note version number

2. **Publish v1.0.X+1**:
   - Bump version in package.json
   - Build and publish to GitHub Releases
   - Include `latest-mac.yml`

3. **Verify Update Flow**:
   - Open installed v1.0.X
   - Check logs for "Update available"
   - UI should show download progress
   - "Install & Restart" should work
   - App relaunches with new version

**Files to Check/Modify**:
- `electron/main.ts` (update check logic)
- `src/components/Settings.tsx` (update UI)
- `package.json` (publish config)

**Integration checkpoint**: Update from vX to vX+1 works without user intervention beyond clicking "Install".

---

### Phase 3: Release Pipeline Test

**Goal**: Document and validate the complete release process

**Deliverables**:
- Verified release checklist
- Updated `AUTO_UPDATE_GUIDE.md` with actual workflow
- Release notes template

**Integration checkpoint**: Documented, repeatable release process.

---

## Dependency Graph

```
Phase 1: Apple Signing
            │
            ▼
Phase 2: Auto-Updater Test
            │
            ▼
Phase 3: Release Pipeline
```

Phases 1-3 are sequential - can't test updates without signed builds.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Certificate export fails | Low | High | Use Keychain Access GUI, check private key included |
| Notarization times out | Medium | Medium | Apple notarization can be slow, add retry logic |
| Auto-updater code has bugs | Low | Medium | Existing code is standard electron-updater |
| GitHub Secrets misconfigured | Medium | Medium | Document exact secret names and formats |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Human Work |
|-------|-------|-------------|------------|
| Phase 1: Apple Signing | BACKLOG-406 | ~10K | Certificate export, secrets setup |
| Phase 2: Auto-Updater | BACKLOG-475 | ~15K | Testing |
| Phase 3: Pipeline Test | BACKLOG-476 | ~5K | Documentation |
| **Total** | **3 tasks** | **~30K** | ~2-3 hours human work |

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-1183 | BACKLOG-406 | Blocked | - | - | - |
| 2 | TASK-1184 | BACKLOG-475 | Blocked | - | - | - |
| 3 | TASK-1185 | BACKLOG-476 | Blocked | - | - | - |

---

## Success Criteria
- [ ] GitHub Actions produces signed macOS .dmg and .zip
- [ ] Notarization completes successfully
- [ ] Auto-updater detects new version
- [ ] Update downloads in background
- [ ] "Install & Restart" relaunches with new version
- [ ] Release process documented

---

## Related Documentation

- **Release Workflow**: `.github/workflows/release.yml`
- **Auto-Update Guide**: `AUTO_UPDATE_GUIDE.md`
- **Electron Builder Docs**: https://www.electron.build/code-signing

---

## Next Sprint

After SPRINT-056 completes, proceed to **SPRINT-057: Supabase License System**.
