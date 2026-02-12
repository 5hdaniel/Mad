# SPRINT-080A: Security Hardening (Ship-Blockers)

**Status:** Pending
**Created:** 2026-02-11
**Branch From:** develop
**Target:** develop

---

## Sprint Goal

Harden the Electron application security for first production test release. These are ship-blockers that must pass before ANY production build distribution.

## Scope

### In Scope

| Task | Title | Priority | Est. Tokens | Phase |
|------|-------|----------|-------------|-------|
| TASK-1960 | Configure Electron Fuses | P1 | ~30K | 1 |
| TASK-1961 | Enable ASAR Integrity | P1 | ~10K | 2 (after 1960) |
| TASK-1962 | Add Permission Request Handler | P1 | ~15K | 3 (after 1961) |
| TASK-1963 | Windows Code Signing Setup | P1 | ~20K | 1 (parallel, procurement) |

**Total estimated (engineering):** ~75K tokens
**SR Review overhead:** ~30K tokens
**Grand Total:** ~105K tokens

### Out of Scope / Deferred

- macOS Hardened Runtime changes (already configured in notarize.js)
- Linux-specific security (AppArmor, sandbox profiles)
- Runtime CSP changes (already implemented)
- Certificate pinning for API calls

---

## Phase Plan

### Execution: Sequential (shared files)

TASK-1960, 1961, and 1962 share `package.json` and/or `electron/main.ts`. They must run sequentially.

TASK-1963 (Windows code signing) is procurement + CI config only, no shared files. Can start immediately in parallel.

```
Phase 1 (Sequential):
  TASK-1963 (Windows Signing) ─── start procurement immediately (parallel)
  TASK-1960 (Fuses) → TASK-1961 (ASAR) → TASK-1962 (Permissions)
```

**File ownership per task:**

TASK-1960 touches:
- `package.json` (devDependency + afterPack config)
- New: `scripts/afterPack.js`

TASK-1961 touches:
- `package.json` (build.asar config)

TASK-1962 touches:
- `electron/main.ts` (permission handlers)

TASK-1963 touches:
- `.github/workflows/release.yml` (CI secrets config)

---

## Dependency Graph

```
TASK-1960 (Fuses)
    │
    ▼
TASK-1961 (ASAR Integrity) ── depends on fuses including integrity validation fuse
    │
    ▼
TASK-1962 (Permission Handler) ── sequential due to shared main.ts

TASK-1963 (Windows Signing) ── independent, procurement-driven
```

---

## Merge Plan

All branches target `develop` via traditional merge (not squash).

| Task | Branch | Merge Order |
|------|--------|-------------|
| TASK-1960 | `feature/TASK-1960-electron-fuses` | 1st |
| TASK-1961 | `feature/TASK-1961-asar-integrity` | 2nd |
| TASK-1962 | `feature/TASK-1962-permission-handler` | 3rd |
| TASK-1963 | `feature/TASK-1963-windows-signing` | Any time (independent) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `OnlyLoadAppFromAsar` breaks dev mode | Medium | High | Only set in production builds; test with `npm run package:dev` |
| WAL sidecar files excluded from ASAR | Low | Low | extraResources already outside ASAR |
| Windows cert procurement delay | High | Medium | Start first; code tasks proceed in parallel |
| Permission deny-by-default breaks clipboard | Medium | Medium | Whitelist clipboard-read, clipboard-sanitized-write, notifications |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Verification |
|------|-------------|
| TASK-1960 | `npx @electron/fuses read <electron-binary>` after `npm run package:dev` |
| TASK-1961 | Build on macOS, confirm no ASAR integrity failure on launch |
| TASK-1962 | Launch app, test copy-paste in transaction views, check console for permission errors |
| TASK-1963 | Trigger manual release, check Windows installer Digital Signatures tab |

### CI Requirements

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run package:dev` produces working build

---

## Progress Tracking

| Task | Status | Billable Tokens | Duration | PR |
|------|--------|----------------|----------|-----|
| TASK-1960 | Pending | - | - | - |
| TASK-1961 | Pending | - | - | - |
| TASK-1962 | Pending | - | - | - |
| TASK-1963 | Pending | - | - | - |
