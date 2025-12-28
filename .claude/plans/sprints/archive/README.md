# Sprint Archive

This directory contains completed sprint archives with phase retrospectives, metrics, and summaries.

## Structure

```
archive/
  SPRINT-XXX/
    phase-retros/
      PHASE-1-<name>.md       # Phase 1 retrospective report
      PHASE-2-<name>.md       # Phase 2 retrospective report
      ...
    metrics/
      task-metrics.md         # Per-task metrics summary
      aggregate-metrics.md    # Sprint-level aggregated metrics
    summary.md                # Final sprint summary (pulls from above)
```

## Lifecycle

1. **During Sprint** - PM creates phase retro reports after each phase completes
2. **After Each Phase** - SR Engineer contributes quality observations to phase retro
3. **Sprint Complete** - PM generates final `summary.md` from phase retros
4. **Archive** - Move completed sprint folder to archive

## File Naming

| File | Pattern | Purpose |
|------|---------|---------|
| Phase Retro | `PHASE-N-<name>.md` | Phase N retrospective |
| Task Metrics | `task-metrics.md` | Individual task metrics |
| Aggregate Metrics | `aggregate-metrics.md` | Sprint-level metrics |
| Summary | `summary.md` | Final sprint summary |

## Creating a Sprint Archive

When a sprint completes:

```bash
# 1. Create the sprint archive folder
mkdir -p .claude/plans/sprints/archive/SPRINT-XXX/{phase-retros,metrics}

# 2. Move/generate phase retros (if not already in archive)
# PM should have created these during sprint execution

# 3. Generate final summary
# Use sprint-summary module to aggregate phase retros

# 4. Commit archive
git add .claude/plans/sprints/archive/SPRINT-XXX/
git commit -m "docs: archive SPRINT-XXX completion"
```

## Templates

| Template | Location | Purpose |
|----------|----------|---------|
| Phase Retro | `.claude/skills/agentic-pm/skills/phase-retro-guardrail-tuner/templates/phase-retro-report.template.md` | Phase retrospective |
| Sprint Summary | `.claude/skills/agentic-pm/templates/sprint-summary.template.md` | Sprint summary |

## Metrics Reference

See `.claude/docs/shared/metrics-tracking.md` for complete metrics definitions.
