# BACKLOG-559: Replace Verbose Message Import Logging with Progress Bar

**Created**: 2026-01-28
**Priority**: P3 (Low)
**Type**: Enhancement / DX (Developer Experience)
**Area**: Message Import Service

---

## Problem Statement

Currently the message import service logs each message individually with full JSON output, which floods the terminal and makes it difficult to monitor import progress or see other important logs:

```
[1] {
[1]   "messageGuid": "FFF24461-F5D8-07A2-6117-88C26833664F",
[1]   "handleId": "26266",
[1]   "sentAt": "2026-01-16T01:50:51.224Z"
[1] }
[1] {
[1]   "messageGuid": "A1B2C3D4-E5F6-0789-ABCD-EF0123456789",
[1]   "handleId": "26266",
[1]   "sentAt": "2026-01-16T01:51:12.456Z"
[1] }
... (hundreds more)
```

## Desired Behavior

Replace verbose per-message logging with a progress indicator:

```
Importing messages: [=========>          ] 45% (450/1000) - ETA: 12s
```

Or simpler inline progress:

```
Importing messages: 450/1000 (45%)
```

## Acceptance Criteria

- [ ] Per-message JSON logging removed or moved to debug/trace level
- [ ] Progress indicator shows: current count, total count, percentage
- [ ] Progress updates in-place (single line) rather than flooding terminal
- [ ] Final summary logged on completion: "Imported X messages in Y seconds"
- [ ] Error messages still logged normally (not suppressed)
- [ ] Works in both dev mode (`npm run dev`) and production builds

## Technical Options

### Option A: cli-progress (npm package)

```typescript
import cliProgress from 'cli-progress';

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
bar.start(totalMessages, 0);
// In loop:
bar.increment();
// On complete:
bar.stop();
```

Pros: Full-featured, handles terminal width, ETA calculation
Cons: Additional dependency

### Option B: Simple inline progress (no dependency)

```typescript
process.stdout.write(`\rImporting messages: ${current}/${total} (${percent}%)`);
// On complete:
console.log(); // Move to next line
```

Pros: No dependencies, simple
Cons: No ETA, less visual feedback

### Option C: Periodic logging (simplest)

```typescript
if (current % 100 === 0 || current === total) {
  console.log(`Importing messages: ${current}/${total}`);
}
```

Pros: Simplest, works with any logger
Cons: Multiple lines, not as clean

## Recommendation

**Option B (Simple inline)** for main process, since:
- No additional dependencies
- Works well in Electron main process
- Sufficient for developer feedback

Consider **Option A** if more features needed later.

## Files Likely Involved

- Message import service in main process
- Possibly: logging configuration/utility

## Notes

- This is a DX improvement, not user-facing
- Low priority - implement when working on related message functionality
- Consider making verbose logging available via `DEBUG=messages` environment variable for troubleshooting
