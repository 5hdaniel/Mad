# SPRINT-007 LLM Cost Optimization - Testing Checklist

## Prerequisites

- [ ] App builds and starts: `npm run dev`
- [ ] At least one email account connected (Gmail or Outlook)
- [ ] LLM API key configured (Anthropic or OpenAI)

---

## 1. Spam Filtering

### Gmail Account
- [ ] Emails in Gmail's Spam folder are excluded from LLM analysis
- [ ] Emails with `SPAM` label are excluded
- [ ] Promotional emails (if labeled) are handled appropriately

### Outlook Account
- [ ] Emails in Junk Email folder are excluded
- [ ] Emails marked as junk are excluded

### Verification
- [ ] Check logs for "Filtered X spam emails" messages
- [ ] Spam emails don't appear in transaction results

---

## 2. Thread Grouping

- [ ] Emails are grouped by thread/conversation
- [ ] Only the first email per thread is sent to LLM
- [ ] Transaction status propagates to all emails in thread

### Verification
- [ ] Check logs for "Grouped X emails into Y threads"
- [ ] Thread count < total email count (grouping is working)

---

## 3. Batch Processing

- [ ] Multiple emails are batched into single LLM requests
- [ ] Batch size respects token limits (~30 emails per batch)
- [ ] Batch responses are parsed correctly

### Verification
- [ ] Check logs for "Processing batch X of Y"
- [ ] API call count << email count

---

## 4. Cost Reduction Targets

Run extraction on a test batch and verify:

| Metric | Target | Actual |
|--------|--------|--------|
| API calls for 100 emails | < 10 | _____ |
| API calls for 600 emails | < 20 | _____ |
| Cost per 600 emails (Haiku) | < $0.20 | _____ |

### How to Measure
1. Enable verbose logging
2. Count API calls in logs
3. Check LLM provider dashboard for token usage

---

## 5. Accuracy Check

- [ ] Known transaction emails are still detected
- [ ] Transaction type (purchase/sale/lease) is correct
- [ ] No false negatives on obvious transaction emails
- [ ] Contact extraction still works

### Test Cases
- [ ] Email with property address in subject
- [ ] Email thread about offer negotiation
- [ ] Email with closing documents
- [ ] Email from title company
- [ ] Email from lender/mortgage company

---

## 6. Edge Cases

- [ ] Empty inbox - no errors
- [ ] Single email - processes correctly
- [ ] Very long thread (20+ emails) - handles gracefully
- [ ] Mixed spam and transaction emails - correct filtering

---

## 7. Performance

- [ ] 100 emails process in < 30 seconds
- [ ] 600 emails process in < 2 minutes
- [ ] No memory issues with large batches
- [ ] UI remains responsive during processing

---

## Results

**Tested by:** ________________
**Date:** ________________

**Overall Status:** PASS / FAIL

**Notes:**
```
[Add any observations, issues, or suggestions here]
```

---

## Issues Found

| Issue | Severity | Description |
|-------|----------|-------------|
| | | |
| | | |
| | | |
