# BACKLOG-476: Complete Signed Release Cycle Test

**Category**: infrastructure
**Priority**: P1
**Sprint**: SPRINT-056
**Estimated Tokens**: ~5K
**Status**: Pending

---

## Summary

Document and validate the complete release process from code to distributed signed app.

## Background

After Apple signing and auto-updater are verified, we need a documented, repeatable process for future releases.

## Requirements

### Deliverables

1. **Verified Release Checklist**:
   - Pre-release verification steps
   - Build commands
   - Signing verification
   - Upload to GitHub Releases
   - Post-release verification

2. **Updated AUTO_UPDATE_GUIDE.md**:
   - Actual workflow (not theoretical)
   - Troubleshooting section
   - Rollback procedure

3. **Release Notes Template**:
   - Version number format
   - Changelog format
   - Breaking changes section

## Acceptance Criteria

- [ ] Release checklist document created
- [ ] AUTO_UPDATE_GUIDE.md updated with actual workflow
- [ ] Release notes template created
- [ ] Process tested end-to-end at least once

## Dependencies

- BACKLOG-475: Auto-updater must be verified first

## Related Files

- `AUTO_UPDATE_GUIDE.md`
- `.github/workflows/release.yml`
