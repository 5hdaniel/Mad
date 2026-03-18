# TASK-2226: Auto-Sync -- Extract BACKLOG-XXXX from Branch Names + Configure GitHub Secrets

**Backlog ID:** BACKLOG-1018
**Sprint:** SPRINT-141
**Phase:** 3 (Infrastructure)
**Branch:** `feature/task-2226-auto-sync`
**Estimated Tokens:** ~20K (config category, x0.5 multiplier = ~10K effective, but keeping at 20K for scope)

---

## Objective

Create a GitHub Actions workflow that automatically extracts `BACKLOG-XXXX` identifiers from branch names and PR titles, then updates the corresponding Supabase backlog item status (e.g., marking as `in_progress` when a PR is opened, `completed` when merged). Also document the required GitHub secrets configuration.

---

## Context

The PM module tracks backlog items in Supabase via `pm_*` RPCs. Currently, status updates are manual (through the UI or agent scripts). This task automates status transitions based on GitHub branch/PR activity:

- Branch created with `BACKLOG-1234` in name -> Item status = `in_progress`
- PR merged with `BACKLOG-1234` in title/branch -> Item status = `completed`

The admin-portal repo is at `5hdaniel/admin-portal` on GitHub.

---

## Requirements

### Must Do:
1. **Create GitHub Actions workflow** at `admin-portal/.github/workflows/pm-auto-sync.yml`
2. **Extract BACKLOG-XXXX** from:
   - Branch name (e.g., `fix/BACKLOG-1020-parent-search`)
   - PR title (e.g., `fix: BACKLOG-1020 parent search fix`)
   - PR body (look for `BACKLOG-XXXX` pattern)
3. **Status transitions:**
   - PR opened -> call `pm_update_item_status` with `in_progress`
   - PR merged -> call `pm_update_item_status` with `completed`
   - PR closed (not merged) -> no action (leave status as-is)
4. **Call Supabase RPC** using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets
5. **Document the required GitHub secrets** in a README section or inline comments
6. **Handle edge cases:**
   - Multiple BACKLOG-XXXX in a single branch/PR -> update all
   - No BACKLOG-XXXX found -> skip silently
   - RPC call fails -> log error but don't fail the workflow

### Must NOT Do:
- Do NOT store secrets in the workflow file
- Do NOT create Supabase migrations
- Do NOT modify existing CI workflows
- Do NOT change any TypeScript source files

---

## Acceptance Criteria

- [ ] Workflow file exists at `admin-portal/.github/workflows/pm-auto-sync.yml`
- [ ] Workflow triggers on: `pull_request` opened, merged, closed events
- [ ] Extracts BACKLOG-XXXX from branch name and/or PR title
- [ ] On PR opened: calls `pm_update_item_status` with `in_progress`
- [ ] On PR merged: calls `pm_update_item_status` with `completed`
- [ ] Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from GitHub secrets
- [ ] Gracefully handles missing BACKLOG-XXXX (skips silently)
- [ ] Gracefully handles RPC failures (logs error, workflow succeeds)
- [ ] Required secrets documented in workflow comments
- [ ] `npx tsc --noEmit` passes (no TS changes, but verify no breakage)

---

## Files to Create

- `admin-portal/.github/workflows/pm-auto-sync.yml` -- GitHub Actions workflow

## Files to Read (for context)

- `admin-portal/.github/workflows/` -- Existing CI workflows (if any) for pattern reference
- `admin-portal/lib/pm-queries.ts` -- `updateItemStatus()` to understand the RPC signature

---

## Implementation Notes

**Workflow file:**

```yaml
name: PM Auto-Sync

# Required GitHub Secrets:
#   SUPABASE_URL - Your Supabase project URL (e.g., https://xxxx.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY - Service role key for RPC calls

on:
  pull_request:
    types: [opened, closed]

jobs:
  sync-status:
    runs-on: ubuntu-latest
    steps:
      - name: Extract BACKLOG IDs
        id: extract
        env:
          BRANCH: ${{ github.event.pull_request.head.ref }}
          TITLE: ${{ github.event.pull_request.title }}
          BODY: ${{ github.event.pull_request.body }}
        run: |
          # SECURITY: Use env vars, NOT inline ${{ }} to prevent shell injection

          # Extract all BACKLOG-XXXX patterns
          ALL_TEXT="$BRANCH $TITLE $BODY"
          IDS=$(echo "$ALL_TEXT" | grep -oP 'BACKLOG-\d+' | sort -u | tr '\n' ' ')

          echo "Found IDs: $IDS"
          echo "ids=$IDS" >> $GITHUB_OUTPUT

          if [ -z "$IDS" ]; then
            echo "skip=true" >> $GITHUB_OUTPUT
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi

      - name: Determine new status
        if: steps.extract.outputs.skip == 'false'
        id: status
        run: |
          if [ "${{ github.event.action }}" == "opened" ]; then
            echo "status=in_progress" >> $GITHUB_OUTPUT
          elif [ "${{ github.event.action }}" == "closed" ] && [ "${{ github.event.pull_request.merged }}" == "true" ]; then
            echo "status=completed" >> $GITHUB_OUTPUT
          else
            echo "status=skip" >> $GITHUB_OUTPUT
          fi

      - name: Update Supabase item status
        if: steps.extract.outputs.skip == 'false' && steps.status.outputs.status != 'skip'
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          STATUS="${{ steps.status.outputs.status }}"
          IDS="${{ steps.extract.outputs.ids }}"

          for LEGACY_ID in $IDS; do
            echo "Updating $LEGACY_ID -> $STATUS"

            # First, look up the item by legacy_id
            RESPONSE=$(curl -s -X POST \
              "${SUPABASE_URL}/rest/v1/rpc/pm_get_item_by_legacy_id" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -d "{\"p_legacy_id\": \"$LEGACY_ID\"}")

            ITEM_ID=$(echo "$RESPONSE" | jq -r '.item.id // empty')

            if [ -z "$ITEM_ID" ]; then
              echo "Warning: Could not find item for $LEGACY_ID, skipping"
              continue
            fi

            # Update status
            curl -s -X POST \
              "${SUPABASE_URL}/rest/v1/rpc/pm_update_item_status" \
              -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
              -H "Content-Type: application/json" \
              -d "{\"p_item_id\": \"$ITEM_ID\", \"p_new_status\": \"$STATUS\"}" \
              || echo "Warning: Failed to update $LEGACY_ID status"
          done
```

**GitHub Secrets to configure (manual step):**

| Secret | Value | Source |
|--------|-------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Supabase project settings > API > service_role key |

**Note:** The service role key bypasses RLS, which is needed because the GitHub Actions runner has no user session. The `pm_update_item_status` RPC is `SECURITY DEFINER`, so it should work with the service role key.

**Edge cases:**
- Branch `feature/multi-fix` with no BACKLOG-XXXX: workflow skips silently
- PR title `fix: BACKLOG-1020 and BACKLOG-1022`: both items updated
- RPC fails (item not found, invalid transition): curl logs error, continues to next ID

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Push the workflow file to a test branch
  2. Create a PR with `BACKLOG-XXXX` in the branch name or title
  3. Check the Actions tab -- workflow should run and log the extracted IDs
  4. Verify the Supabase item status changed to `in_progress`
  5. Merge the PR -- workflow should run again and set status to `completed`

### CI Requirements
- [ ] Existing CI workflows not affected
- [ ] Workflow file has valid YAML syntax

---

## PR Preparation

- **Title:** `feat(pm): auto-sync backlog status from GitHub branch/PR activity`
- **Branch:** `feature/task-2226-auto-sync`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 20K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You cannot verify the Supabase RPC endpoint format (need MCP access)
- The service role key approach has security concerns for this repo
- The workflow needs `jq` or other tools not available in `ubuntu-latest`
- You encounter blockers not covered in the task file
