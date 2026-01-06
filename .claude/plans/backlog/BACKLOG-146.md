# BACKLOG-146: Prevent Stuck Jest Worker Processes from Agent Runs

## Problem

Engineer agents running `npm test` leave behind stuck Jest worker processes that consume 100% CPU each. In SPRINT-021, 5 Jest workers were found running at 100% CPU for over an hour, causing fan noise and system slowdown.

**Incident:** 2026-01-04 during SPRINT-021 execution
**Impact:** 5 processes × 100% CPU = system slowdown, loud fans

## Root Cause

Jest workers can hang indefinitely when:
1. Tests use `setTimeout`/`setInterval` without cleanup
2. EventEmitter listeners aren't removed
3. Database connections aren't closed
4. Agent terminates before Jest fully exits

The `--forceExit` flag helps but doesn't always work, especially when workers hang during test loading phase.

## Proposed Solutions

### Option A: Process Cleanup Hook (Recommended)

Add a Claude Code hook that kills orphaned Jest processes when agents complete:

```json
// .claude/hooks.json
{
  "SubagentStop": [
    {
      "command": "pkill -f 'jest-worker.*Mad' 2>/dev/null || true",
      "description": "Kill orphaned Jest workers after agent completes"
    }
  ]
}
```

**Pros:** Automatic cleanup, no code changes
**Cons:** May kill intentional test runs (edge case)

### Option B: Jest Config Improvements

Add timeout and worker limits to `jest.config.js`:

```javascript
module.exports = {
  workerIdleMemoryLimit: '512MB',
  forceExit: true,
  maxWorkers: 2,
  testTimeout: 30000,
};
```

**Pros:** Prevents hangs at source
**Cons:** May mask real issues, doesn't help if worker hangs during load

### Option C: Engineer Agent SOP Update

Add to engineer agent instructions:
1. Always run tests with `--forceExit --maxWorkers=2`
2. Run `pkill -f jest-worker` before completing
3. Verify no stuck processes before handoff

**Pros:** Process-based solution
**Cons:** Relies on agent compliance

## Recommendation

Implement Options A + B together:
1. Add SubagentStop hook for automatic cleanup
2. Update Jest config with sensible defaults
3. Document in engineer agent SOP as backup

## Priority

**Medium** - Not blocking but causes user frustration

## Effort

~2 hours to implement all options

## Related

- BACKLOG-120: CI Test Gaps (Jest hanging in CI)
- SPRINT-021: State Machine Migration (where incident occurred)
