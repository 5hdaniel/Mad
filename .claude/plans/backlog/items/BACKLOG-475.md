# BACKLOG-475: Verify Auto-Updater End-to-End

**Category**: infrastructure
**Priority**: P0
**Sprint**: SPRINT-056
**Estimated Tokens**: ~15K
**Status**: Pending

---

## Summary

Test the existing auto-updater code end-to-end with signed builds to verify it can detect, download, and install updates.

## Background

The auto-updater code exists in `electron/main.ts` and `electron/handlers/updaterHandlers.ts`, but has never been tested with actual signed builds. This is a critical path for consumer release.

## Requirements

### Test Plan

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

### Files to Check/Modify

- `electron/main.ts` (update check logic)
- `src/components/Settings.tsx` (update UI)
- `package.json` (publish config)

## Acceptance Criteria

- [ ] Auto-updater detects new version
- [ ] Download progress shown in UI
- [ ] "Install & Restart" button works
- [ ] App relaunches with correct new version
- [ ] No manual intervention required beyond clicking install

## Dependencies

- BACKLOG-406: Apple signing must be working first

## Related Files

- `electron/main.ts`
- `electron/handlers/updaterHandlers.ts`
- `src/components/Settings.tsx`
- `AUTO_UPDATE_GUIDE.md`
