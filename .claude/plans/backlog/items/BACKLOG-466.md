# BACKLOG-466: Optimize Email Fetch Operation Efficiency

## Summary

Review and optimize the "Sync Emails" fetch operation to ensure it's as efficient as possible when pulling emails from Gmail/Outlook providers.

## Category

Performance / Optimization

## Priority

P2 - Medium (Feature works, optimization for scale)

## Description

### Current State

The Sync Emails feature (BACKLOG-457) fetches emails from the provider and links them to transactions. Need to audit the implementation for efficiency.

### Areas to Investigate

1. **API Call Efficiency**
   - Are we batching requests appropriately?
   - Are we using pagination correctly?
   - Are we fetching only necessary fields (not full email bodies upfront)?

2. **Date Range Filtering**
   - Is filtering happening server-side (provider API) or client-side?
   - Server-side filtering reduces data transfer

3. **Caching Strategy**
   - Are we caching email metadata to avoid re-fetching?
   - Can we use delta sync (only fetch new emails since last sync)?

4. **Parallel Processing**
   - Can multiple contact emails be fetched in parallel?
   - Rate limiting considerations for provider APIs

5. **Database Operations**
   - Are we using batch inserts vs individual inserts?
   - Is deduplication check efficient (indexed queries)?

### Expected Outcome

- Faster sync times for transactions with many contacts
- Reduced API calls to email providers
- Lower memory usage during sync
- Better user feedback during long syncs (progress indicator)

## Acceptance Criteria

- [ ] Audit current implementation for bottlenecks
- [ ] Document current performance baseline (time to sync N emails)
- [ ] Implement optimizations with measurable improvements
- [ ] Add progress indicator for long sync operations

## Estimated Effort

~20K tokens (investigation + optimization)

## Related Items

- BACKLOG-457: Sync Emails from Provider (original feature)
- PR #571: Initial implementation
