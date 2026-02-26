# SPRINT-101: Keepr Deep Identity Rename

- **Status:** Completed
- **Created:** 2026-02-24
- **Completed:** 2026-02-25
- **Base Branch:** develop
- **PR:** #986

## Goal
Rename all MagicAudit/magicaudit/magic-audit references to Keepr/keepr across the entire codebase — code, config, docs, scripts, tests.

## Tasks

| ID | Title | Backlog | Status | PR |
|----|-------|---------|--------|-----|
| TASK-2078 | SR audit magicaudit references | BACKLOG-807 | Completed | #986 |
| TASK-2079 | Deep identity rename | BACKLOG-808 | Completed | #986 |

## Scope
- 65 files changed, 387 insertions, 394 deletions
- App identity: appId, productName, protocol (keepr://), bundleId
- Deep links: magicaudit:// → keepr://
- Broker portal URLs: broker-portal-two.vercel.app → www.keeprcompliance.com
- Cleanup scripts: rewritten Keepr-only (no legacy paths — no existing users)
- Package names: keepr, keepr-broker-portal
- Docs + compliance: emails → @keeprcompliance.com
- Infrastructure (outside PR): Supabase redirect URI, Vercel deployment, custom domain

## Post-Release Cleanup
- Remove old `magicaudit://callback` from Supabase redirect URLs after production release
