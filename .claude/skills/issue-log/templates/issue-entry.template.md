# Issue Entry Template

Copy this template when documenting issues.

---

## For Handoff Messages (Brief)

```markdown
**Issues/Blockers:**
1. [Brief title] - [one-line summary of resolution]
2. [Brief title] - [one-line summary of resolution]

Or if none: **Issues/Blockers:** None
```

---

## For Task File (Detailed)

Add to task file under `## Issues Log`:

```markdown
## Issues Log

### Issue #1: [Brief descriptive title]

- **When:** Step X / Phase Y
- **What happened:** [Description]
- **Root cause:** [If known]
- **Resolution:** [How fixed / workaround / "Unresolved"]
- **Time spent:** [Estimate]
- **Prevention:** [Future avoidance, if applicable]
- **Severity:** [Low | Medium | High | Critical]

### Issue #2: [Title]
...
```

---

## Severity Reference

| Severity | Use When |
|----------|----------|
| Low | Minor, no significant time lost |
| Medium | Required workaround or 30+ min delay |
| High | Blocked for 1+ hours |
| Critical | Cannot complete, needs escalation |

---

## Quick Copy Templates

### No Issues
```markdown
## Issues Log

No issues encountered during this task.
```

### Single Issue
```markdown
## Issues Log

### Issue #1: [Title]

- **When:** Step X / Phase Y
- **What happened:**
- **Root cause:**
- **Resolution:**
- **Time spent:**
- **Prevention:**
- **Severity:**
```

### Handoff - No Issues
```markdown
**Issues/Blockers:** None
```

### Handoff - With Issues
```markdown
**Issues/Blockers:**
1. **[Title]** - [Resolution summary]
   Full details in task file Issues Log.
```
