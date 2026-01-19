# BACKLOG-085: Test Thread-Based Transaction Detection Accuracy

## Status
- **Priority:** High
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-19
- **Type:** Testing / Validation
- **Depends On:** BACKLOG-084

## Summary

Before rolling out thread-based transaction detection (BACKLOG-084), validate that the optimization doesn't reduce transaction detection accuracy. Test with real email data to confirm:
1. Spam filtering correctly identifies non-transaction emails
2. Thread propagation doesn't miss mid-thread transactions
3. First-email-only analysis catches the same transactions as full analysis

## Test Strategy

### Phase 1: Baseline Measurement

Run current per-email analysis on test dataset:
1. Collect 100-200 real emails (with user consent)
2. Run full LLM analysis on every email
3. Record:
   - Transactions detected
   - Confidence scores
   - LLM calls made
   - Total cost

### Phase 2: Spam Filter Validation

1. Identify spam/junk emails in test set
2. Manual review: confirm none contain real estate transactions
3. Calculate false positive rate (real transactions incorrectly marked as spam)
4. **Target:** 0% false positives (never skip a real transaction)

### Phase 3: Thread Propagation Validation

1. Group test emails by thread_id
2. For each thread with detected transaction:
   - Analyze first email only
   - Compare result to full-thread analysis
3. Calculate:
   - Match rate (first-email catches transaction)
   - Miss rate (transaction only in later emails)
4. **Target:** 95%+ match rate

### Phase 4: Edge Case Testing

Test specific scenarios:
- [ ] Thread where transaction discussed mid-thread (not first email)
- [ ] Thread where first email is newsletter, later email is transaction
- [ ] Single-email threads
- [ ] Threads with 50+ emails
- [ ] Emails with null thread_id

### Phase 5: A/B Comparison

Run both approaches in parallel:
1. **Control:** Per-email analysis (current)
2. **Test:** Thread-based + spam filter + batching

Compare:
- Transactions detected (should be equal or within 5%)
- LLM calls made (should be 90%+ reduction)
- Cost (should be 90%+ reduction)
- Processing time (should be faster)

## Acceptance Criteria

- [ ] Baseline metrics collected from current approach
- [ ] Spam filter has 0% false positive rate
- [ ] Thread propagation has 95%+ match rate
- [ ] Edge cases documented with results
- [ ] A/B comparison shows no significant accuracy loss
- [ ] Cost reduction of 90%+ confirmed
- [ ] Rollback plan documented if issues found

## Test Data Requirements

**Minimum dataset:**
- 100+ emails
- 20+ threads with multiple emails
- 10+ confirmed transaction threads
- 5+ spam/newsletter emails
- Mix of Gmail and Outlook sources

**Ideal dataset:**
- 500+ emails
- 100+ threads
- 50+ transaction threads
- 50+ spam/junk emails
- Real user data (with consent)

## Risk Mitigation

If thread-first approach misses transactions:

1. **Fallback option:** Analyze first email + any email with transaction keywords
2. **Hybrid approach:** Thread propagation for confirmed transactions, keyword scan for uncertain threads
3. **Confidence threshold:** Only propagate if first-email confidence > 80%

## Metrics to Track

| Metric | Baseline | Thread-Based | Target |
|--------|----------|--------------|--------|
| Transactions found | X | Y | Y >= X * 0.95 |
| False negatives | X | Y | Y <= X + 2% |
| LLM calls | 600 | ~30 | 95% reduction |
| Cost | $6.00 | $0.15 | 97% reduction |
| Processing time | X min | Y min | Y < X |

## Dependencies

- BACKLOG-084 must be implemented first
- Access to real email test data
- User consent for testing with real emails

## Related Items

- BACKLOG-084: Thread-Based Transaction Detection with Batching
- LLM tools: `electron/services/llm/tools/`
- Hybrid extraction: `electron/services/llm/hybridExtractionService.ts`

## Notes

- Testing should happen in staging/dev environment
- Consider creating synthetic test dataset if real data not available
- Document any edge cases discovered during testing for future reference
