# Message Parsing Test Data

## Test Environment

**User ID:** `22db6971-3d7e-49d0-9171-a67b235e85f6`
**Date Captured:** 2025-01-13

## Database Health Snapshot

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Messages | 674,822 | 100% |
| Healthy | 590,468 | 87.5% |
| With NULL thread_id | 48,514 | 7.2% |
| With Garbage Text | 35,834 | 5.3% |
| With Empty Text | 0 | 0% |

## Sample Messages with NULL thread_id

These messages are at risk for the "Eric bug" (incorrect chat merging):

| ID | Body Text Sample | Participants | Sent At |
|----|------------------|--------------|---------|
| `0deecf46-3988-4829-bff3-c86c3e223eb1` | "Also" | `{"from":"me","to":["unknown"]}` | 2026-01-12 |
| `dd348263-1e8e-41a4-95fb-f178f4dc6602` | "Your United verification code..." | `{"from":"26266","to":["me"]}` | 2026-01-10 |
| `278c364f-2e44-4d74-b994-e0c5dc2dd84b` | "617465 is your Qantas verification..." | `{"from":"+18556291207","to":["me"]}` | 2026-01-07 |
| `eeb4788c-d503-4aa0-81d2-54b9074a3525` | "Delete yours as well..." | `{"from":"+14153706109","to":["me"]}` | 2025-12-27 |

## Sample Messages with Garbage Text

These messages have binary data stored as UTF-16 LE garbage:

| ID | Thread ID | Sent At | Garbage Pattern |
|----|-----------|---------|-----------------|
| `137fcf4a-493b-4048-a84d-87fba1b22403` | `macos-chat-2004` | 2026-01-14 | `଄瑳敲浡祴数...` |
| `df350199-6efd-42ee-9f5a-775bdbf22578` | `macos-chat-2742` | 2026-01-03 | `଄瑳敲浡祴数...` |
| `06be30d6-f1c0-4123-ac78-b1e2c83d0954` | `macos-chat-2344` | 2026-01-01 | `଄瑳敲浡祴数...` |
| `92c544c8-e6f1-43ac-93a2-d22a5a990fa0` | `macos-chat-2341` | 2025-12-30 | `଄瑳敲浡祴数...` |
| `0a8c7ccf-3e96-4bfa-a740-d25660b56844` | `macos-chat-2302` | 2025-12-25 | `଄瑳敲浡祴数...` |
| `c2ae6606-4f33-4648-a1d1-b48d6a424cf0` | `macos-chat-567` | 2025-12-01 | `଄瑳敲浡祴数...` |

## Affected Chat IDs (for testing after fix)

These chats contain garbage messages and should be verified after reimport:

- `macos-chat-2004`
- `macos-chat-2742`
- `macos-chat-2344`
- `macos-chat-2341`
- `macos-chat-2302`
- `macos-chat-567`

## Diagnostic Commands

Run in DevTools console:

```javascript
const userId = "22db6971-3d7e-49d0-9171-a67b235e85f6";

// Full health report
await window.api.system.diagnosticMessageHealth(userId);

// NULL thread_id samples
await window.api.system.diagnosticNullThreadId(userId);

// Garbage text samples
await window.api.system.diagnosticGarbageText(userId);

// Check specific contact's threads
await window.api.system.diagnosticThreadsForContact(userId, "PHONE_DIGITS");
```

## Expected Results After Fix

After deterministic parsing refactor and reimport:

| Metric | Expected |
|--------|----------|
| With Garbage Text | 0 (all parsed or placeholder) |
| Health Percentage | >95% |
| NULL thread_id | Same (48,514) - this is data issue, not parsing |

## Verification Checklist

- [ ] Run `diagnosticMessageHealth()` - garbage count should be 0
- [ ] Check `macos-chat-2004` - messages should be readable or placeholder
- [ ] Check `macos-chat-2742` - messages should be readable or placeholder
- [ ] Verify no Chinese characters in English conversations
- [ ] Verify legitimate Chinese/Japanese messages still work (if any)
