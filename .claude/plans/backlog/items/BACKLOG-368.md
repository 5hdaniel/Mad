# BACKLOG-368: Create transactionStageHistoryDbService

**Created**: 2026-01-21
**Priority**: Moderate
**Category**: Technical Debt / Feature Enablement
**Status**: Pending
**Source**: SR Engineer Database Audit (ISSUE-005)

---

## Problem Statement

The `transaction_stage_history` table exists in the schema but has no corresponding database service:

- Table is defined (schema.sql lines 478-496)
- Indexes exist for the table (lines 633-634)
- **No service to read/write data**

This table is designed for timeline reconstruction and stage tracking, but is currently unused.

## Schema Definition

```sql
CREATE TABLE IF NOT EXISTS transaction_stage_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,

  stage TEXT NOT NULL,
  source TEXT CHECK (source IN ('pattern', 'llm', 'user')),
  confidence REAL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Optional: what triggered this change
  trigger_message_id TEXT,

  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (trigger_message_id) REFERENCES messages(id) ON DELETE SET NULL
);
```

## Purpose

The table supports:
1. **Timeline reconstruction** - Show how a transaction progressed through stages
2. **Audit trail** - Track which message triggered stage changes
3. **AI/Agent analysis** - Future agents can analyze stage progression patterns
4. **Stage regression detection** - Identify if a transaction moved backward unexpectedly

## Required Implementation

### 1. Create transactionStageHistoryDbService.ts

```typescript
// Suggested API:
interface StageHistoryEntry {
  id: string;
  transactionId: string;
  stage: string;
  source: 'pattern' | 'llm' | 'user';
  confidence: number | null;
  changedAt: string;
  triggerMessageId: string | null;
}

// Methods:
recordStageChange(transactionId: string, stage: string, source: string, options?: {
  confidence?: number;
  triggerMessageId?: string;
}): Promise<StageHistoryEntry>

getHistoryForTransaction(transactionId: string): Promise<StageHistoryEntry[]>

getLatestStage(transactionId: string): Promise<StageHistoryEntry | null>
```

### 2. IPC Handler Integration
- Add handler to electron/handlers/
- Expose via window.api.stageHistory

### 3. Integration Points
- Call when transaction.stage is updated
- Could be triggered from transactionService.updateTransaction()
- Or from a dedicated stage update function

## Acceptance Criteria

- [ ] transactionStageHistoryDbService.ts created with CRUD operations
- [ ] IPC handler exposes service to renderer
- [ ] Stage changes recorded when transaction stage updates
- [ ] History retrievable for transaction timeline display
- [ ] Unit tests for new service

## Estimation

- **Category:** feature/service
- **Estimated Tokens:** ~6K
- **Risk:** Low (new code, no breaking changes)

## Future Considerations

- UI component to display stage history timeline
- Stage progression visualization in transaction details
- Anomaly detection for unusual stage patterns

## Related

- transactions.stage: Current stage storage
- transactionService.ts: May need integration for auto-recording
- Timeline/history UI components (future)
