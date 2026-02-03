# Task TASK-1804: Verify Release Workflow Triggers

---

## WORKFLOW REQUIREMENT

**This is a VERIFICATION task.**

This task verifies the release workflow functions correctly after the version bump.

---

## Goal

Verify the GitHub Actions release workflow triggers correctly when a version tag is pushed, and confirm release artifacts are built and available.

## Non-Goals

- Do NOT fix issues found (create new backlog items if needed)
- Do NOT modify the release workflow
- Do NOT publish to external channels

## Deliverables

1. Verification report documenting:
   - Tag creation and push
   - Workflow trigger confirmation
   - Build status for all platforms
   - Artifact availability

## Acceptance Criteria

- [ ] Tag `v2.0.7` created and pushed
- [ ] Release workflow triggered automatically
- [ ] macOS build succeeds
- [ ] Windows build succeeds
- [ ] Release artifacts uploaded to GitHub Releases
- [ ] DMG and EXE files downloadable

## Implementation Notes

### Steps to Perform

1. **Create and Push Tag**
   ```bash
   git tag v2.0.7
   git push origin v2.0.7
   ```

2. **Monitor Workflow**
   ```bash
   gh run list --workflow=release.yml --limit=5
   gh run watch <run-id>
   ```

3. **Check Release Page**
   ```bash
   gh release view v2.0.7
   ```

4. **Verify Artifacts**
   - [ ] Magic-Audit-2.0.7.dmg available
   - [ ] Magic-Audit-Setup-2.0.7.exe available
   - [ ] Release notes generated

### Troubleshooting

If workflow doesn't trigger:
1. Check `.github/workflows/release.yml` exists
2. Verify tag pattern matches trigger
3. Check Actions tab for errors

If build fails:
1. Check build logs: `gh run view <run-id> --log-failed`
2. Verify .env.production file is correct
3. Check code signing status

## Integration Notes

- Depends on: TASK-1803 (version bump must be merged)
- This is the final task in the sprint

## Do / Don't

### Do:
- Document all observations
- Take screenshots of workflow runs
- Note any warnings even if build succeeds
- Create backlog items for any issues found

### Don't:
- Fix issues directly (document only)
- Re-run failed workflows without documenting
- Skip verification of both platforms

## Verification Report Template

```markdown
## Release Verification Report: v2.0.7

**Date:** YYYY-MM-DD
**Verified by:** <agent_id>

### Tag Creation
- Tag: v2.0.7
- Commit: <sha>
- Pushed at: <timestamp>

### Workflow Execution
- Workflow run ID: <id>
- Status: SUCCESS / FAILURE
- Duration: X minutes

### Platform Builds
| Platform | Status | Duration | Notes |
|----------|--------|----------|-------|
| macOS    | PASS/FAIL | X min | |
| Windows  | PASS/FAIL | X min | |

### Artifacts
| Artifact | Size | Available |
|----------|------|-----------|
| Magic-Audit-2.0.7.dmg | X MB | Yes/No |
| Magic-Audit-Setup-2.0.7.exe | X MB | Yes/No |

### Issues Found
- None / List any issues

### Recommendations
- None / List any recommendations
```

## Testing Expectations

This is a verification task - no code tests needed.

## PR Preparation

No PR needed - this is verification only.
Update the sprint plan with verification results.

---

## PM Estimate (PM-Owned)

**Category:** `verification`

**Estimated Tokens:** ~4K-5K

**Token Cap:** 20K (4x upper estimate)

**Confidence:** High

---

## Verification Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Verification Agent ID: <agent_id from Task tool output>
```

### Report

<Paste completed verification report here>
