# Module: Backlog Maintenance

## Objective

Keep the backlog accurate, current, and actionable by:
- **Adding new items** from user requests, code TODOs, engineer feedback, or code reviews
- Marking completed items when work merges
- Extracting new items from code TODOs and engineer feedback
- Cleaning up stale, duplicate, or obsolete items
- Ensuring items have proper priority and categorization

## When to Use

Invoke this module when:
- User requests adding a new feature/bug/task to the backlog
- A sprint completes (mark items done, capture learnings)
- A PR merges (check if backlog items are resolved)
- Codebase scan reveals new TODOs
- Senior engineer identifies technical debt or refactoring needs
- User reports backlog is out of date
- Periodic maintenance (weekly recommended)

## Procedure

### 0. Adding New Items (Primary Action)

When user requests a new item or you identify work that should be tracked:

1. **Get next ID**: Find highest BACKLOG-XXX number and increment
2. **Determine category**: Bug, Feature, Refactor, Performance, Testing, Documentation, CI/CD, UX
3. **Assess priority**:
   - Critical: Blocks release or causes data loss
   - High: Should be in next sprint
   - Medium: Important but not urgent
   - Low: Nice to have
4. **Estimate complexity**: Use LLM complexity guide from backlog-prioritization module
5. **Write item** using template (see "Backlog Item Template" below)
6. **Add to appropriate section** in BACKLOG.md
7. **Update changelog** at bottom of file

**Sources for new items:**
- Direct user requests ("add X to the backlog")
- Senior engineer code reviews (technical debt, refactoring)
- Sprint retrospectives (process improvements)
- Bug reports
- Feature requests
- Code TODOs (see section 2)

### 1. Completion Scan

Check recently merged PRs and mark corresponding backlog items:

```bash
# Get recent merges to develop/main
git log --oneline --merges -20

# For each merge, check if it resolves a BACKLOG-XXX item
```

**Update format:**
```markdown
**Status:** ✅ Completed (YYYY-MM-DD)
**Resolved by:** PR #XXX or commit hash
```

### 2. TODO Extraction

Scan codebase for actionable TODOs not yet in backlog:

```bash
# Find TODOs in source files
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ electron/ --include="*.ts" --include="*.tsx"
```

**For each TODO found:**
1. Check if already captured in backlog (search by file path or description)
2. If new, create backlog item with:
   - Source file and line number
   - Category based on file location
   - Priority based on severity (FIXME > TODO > HACK)
   - LLM complexity estimate

### 3. Stale Item Detection

Items are potentially stale if:
- Referenced file no longer exists
- Code at referenced location has changed significantly
- Item has been "Pending" for >30 days without activity
- Duplicate of another item

**Action for stale items:**
- Verify still relevant (read referenced code)
- Update description if scope changed
- Mark as `Status: Obsolete` if no longer applicable
- Merge duplicates (keep lower ID, reference higher ID)

### 4. Priority Rebalancing

After maintenance, ensure priorities reflect current reality:

| Priority | Meaning | Review Cadence |
|----------|---------|----------------|
| Critical | Blocks release or causes data loss | Every sprint |
| High | Should be in next sprint | Every sprint |
| Medium | Important but not urgent | Monthly |
| Low | Nice to have | Quarterly |
| Deferred | Explicitly postponed | As needed |

### 5. Changelog Update

Always update the "Last Updated" section at bottom of BACKLOG.md:

```markdown
YYYY-MM-DD - Maintenance: Marked X items complete, added Y new items, removed Z obsolete items
```

## Output Format

When performing maintenance, produce a summary:

```markdown
## Backlog Maintenance Summary (YYYY-MM-DD)

### Completed (X items)
| ID | Title | Resolved By |
|----|-------|-------------|
| BACKLOG-XXX | ... | PR #YYY |

### New Items Added (Y items)
| ID | Title | Source | Priority |
|----|-------|--------|----------|
| BACKLOG-XXX | ... | src/file.ts:123 | High |

### Marked Obsolete (Z items)
| ID | Title | Reason |
|----|-------|--------|
| BACKLOG-XXX | ... | File deleted |

### Priority Changes
| ID | Old Priority | New Priority | Reason |
|----|--------------|--------------|--------|
| BACKLOG-XXX | Medium | High | Blocking feature Y |

### Duplicates Merged
| Kept | Merged |
|------|--------|
| BACKLOG-XXX | BACKLOG-YYY |
```

## Backlog Item Template

When adding new items, use this format:

```markdown
### BACKLOG-XXX: <Title>
**Priority:** <Critical|High|Medium|Low|Deferred>
**Status:** Pending
**Category:** <Bug|Feature|Refactor|Performance|Testing|Documentation|CI/CD|UX>

**Description:**
<Clear description of what needs to be done>

**Source:** (if from code)
- File: `path/to/file.ts`
- Line: XXX
- Original TODO: "<exact TODO text>"

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Files likely to modify:**
- `path/to/file1.ts`
- `path/to/file2.ts`

**LLM Complexity:** <trivial|simple|moderate|complex|very_complex>
**Estimated Turns:** <number>
**Estimated Tokens:** <number>K

---
```

## Tracking Actual vs Estimated Metrics

When a task completes, record the actual turns and tokens used:

### On Task Completion

Update the backlog item with actuals:

```markdown
**LLM Complexity:** moderate
**Estimated Turns:** 10-15
**Estimated Tokens:** 40-60K
**Actual Turns:** 12
**Actual Tokens:** 52K
**Variance Notes:** <optional - explain if significantly over/under>
```

### Updating INDEX.md

The INDEX.md should track estimated and actual metrics with full granularity:

```markdown
| ID | Title | Est. Turns | Est. Tokens | Est. Time | Impl Turns | Impl Tokens | Impl Time | PR Turns | PR Tokens | PR Time | Debug Turns | Debug Tokens | Debug Time | Status |
|----|-------|------------|-------------|-----------|------------|-------------|-----------|----------|-----------|---------|-------------|--------------|------------|--------|
| BACKLOG-058 | Split databaseService | 60-80 | 200-300K | - | - | - | - | - | - | - | - | - | - | Pending |
| BACKLOG-059 | Fix skipped tests | 40-60 | 150-200K | - | 35 | ~140K | 180m | 8 | ~32K | 40m | 5 | ~20K | 25m | ✅ Done |
```

**Column definitions:**
- `Est. Turns | Est. Tokens | Est. Time` → PM estimates from task file
- `Impl Turns | Impl Tokens | Impl Time` → Engineer's implementation phase
- `PR Turns | PR Tokens | PR Time` → Senior Engineer's PR review phase
- `Debug Turns | Debug Tokens | Debug Time` → Engineer's debugging/fix phase

**Where to get actual metrics:**
- Read from merged PR description
- Engineer reports: Impl + Debug metrics
- Senior Engineer reports: PR metrics (commits before merge)

### Using Variance for Future Estimates

Over time, variance data helps calibrate estimates:
- If tasks consistently take 50% more tokens than estimated, adjust the estimation guide
- Track patterns: Are test fixes underestimated? Are refactors overestimated?
- Add notes to backlog-prioritization.md when patterns emerge

### Metrics Collection Process

1. **Before starting task**: Note the current session's token count (if visible)
2. **After completing task**: Calculate tokens used = end count - start count
3. **Count turns**: Number of user messages sent during task execution
4. **Update backlog item** with actuals
5. **Update INDEX.md** summary

## Integration with Sprint Workflow

### Pre-Sprint
Before sprint planning, run maintenance to ensure:
- Completed items are marked done
- New items are captured
- Priorities are current

### Post-Sprint
After sprint completes:
- Mark all sprint items as complete
- Capture any new items discovered during sprint
- Update priorities based on learnings

### On PR Merge
When reviewing merged PRs:
- Check commit messages for "Fixes BACKLOG-XXX" or "Resolves BACKLOG-XXX"
- Automatically mark referenced items as complete

## Red Flags

Stop and escalate if:
- >50% of backlog items are stale
- Critical items have been pending >2 weeks
- Duplicate items are being worked in parallel
- Backlog has >100 pending items (needs grooming session)

## Automation Opportunities

Future enhancements:
- GitHub Action to scan for BACKLOG-XXX in PR descriptions
- Pre-commit hook to validate TODO format
- Weekly automated TODO extraction report
- Backlog item count dashboard
