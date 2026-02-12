# Task TASK-1963: Windows Code Signing Setup

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Configure Windows code signing for the Electron app installer. This involves procuring a code signing certificate and configuring the GitHub Actions release workflow to use it.

## Non-Goals

- Do NOT modify macOS signing/notarization (already working)
- Do NOT add EV certificate requirements (OV is sufficient for initial release)
- Do NOT modify the electron-builder signing configuration beyond what's needed

## Deliverables

1. Update: `.github/workflows/release.yml` (lines 230-247) — configure WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD secrets (already has placeholder support)
2. Documentation: Add signing setup instructions to the PR description

## Acceptance Criteria

- [ ] OV certificate procured OR Azure Trusted Signing configured
- [ ] GitHub secrets `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` configured
- [ ] `.github/workflows/release.yml` correctly references the signing secrets
- [ ] Manual release trigger produces a signed Windows installer
- [ ] Windows installer shows valid Digital Signature in Properties tab
- [ ] All CI checks pass

## Implementation Notes

### Options

**Option A: OV Certificate (~$200-400/yr)**
- Purchase from DigiCert, Sectigo, or similar CA
- Export as `.pfx` file
- Base64 encode and store as `WIN_CSC_LINK` GitHub secret
- Store password as `WIN_CSC_KEY_PASSWORD` secret

**Option B: Azure Trusted Signing (~$10/mo)**
- Set up Azure account with Trusted Signing resource
- Configure `azure-code-signing` action in release workflow
- More modern, better SmartScreen reputation

### Existing Configuration

The release workflow already has placeholder support (lines 230-247):
```yaml
env:
  WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
  WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

### Important Details

- Multi-day procurement lead time — start immediately
- SmartScreen reputation builds over time (expect initial warnings for ~2 weeks)
- The `.pfx` file itself should NEVER be committed to the repository

## Integration Notes

- Independent of TASK-1960/1961/1962 (no shared files)
- Can be done in parallel with the fuses/ASAR/permissions chain

## Do / Don't

### Do:
- Document the exact procurement steps taken
- Verify the certificate chain is complete (root + intermediate + leaf)
- Test with a manual release before marking complete

### Don't:
- Do NOT commit any certificate files to the repository
- Do NOT store credentials anywhere other than GitHub Secrets
- Do NOT use self-signed certificates

## When to Stop and Ask

- If Azure Trusted Signing requires org-level Azure admin approval
- If the certificate procurement requires company verification docs
- If the existing release.yml structure doesn't match expectations

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (CI/CD configuration)
- Verify via: Trigger manual release, check Windows installer signature

### CI Requirements
- [ ] Release workflow runs without errors
- [ ] Windows installer is signed

## PR Preparation

- **Title:** `ci(signing): configure Windows code signing`
- **Labels:** `ci`, `security`
- **Depends on:** None

---

## PM Estimate (PM-Owned)

**Category:** `security`
**Estimated Tokens:** ~20K
**Token Cap:** 80K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] .github/workflows/release.yml (signing config)

Procurement:
- [ ] Certificate obtained (OV / Azure Trusted Signing)
- [ ] GitHub secrets configured
- [ ] Manual release test successful

Verification:
- [ ] Windows installer shows valid Digital Signature
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Security review: <PASS/FAIL>
- CI configuration review: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
