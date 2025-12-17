# Task TASK-303: Add llm_analysis Field to Messages

## Goal

Add a single column to the `messages` table to store full LLM analysis responses as JSON, enabling AI-powered message classification and entity extraction.

## Non-Goals

- Do NOT add classification_method or classification_confidence (already exist)
- Do NOT implement the LLM analysis logic
- Do NOT add UI components
- Do NOT modify existing message handling code

## Deliverables

1. Update: `electron/services/databaseService.ts` - Add llm_analysis column in Migration 008
2. Update: `electron/types/models.ts` - Add llm_analysis field to Message interface

## Acceptance Criteria

- [ ] Column added to messages table (nullable TEXT for JSON)
- [ ] Existing messages unaffected
- [ ] TypeScript Message interface updated
- [ ] npm run type-check passes
- [ ] npm run lint passes

## Implementation Notes

### Migration SQL

Add to Migration 008 in databaseService.ts:

```typescript
// Migration 008: AI Detection Fields (Part 3 - Messages)
if (currentVersion < 8) {
  // Check if column already exists
  const tableInfo = db.pragma('table_info(messages)');
  const existingColumns = tableInfo.map((col: any) => col.name);

  if (!existingColumns.includes('llm_analysis')) {
    db.exec(`ALTER TABLE messages ADD COLUMN llm_analysis TEXT;`);
  }
}
```

### TypeScript Interface Update

In `electron/types/models.ts`, find the Message interface and add:

```typescript
export interface Message {
  // ... existing fields ...

  // Existing classification fields (already in schema)
  classification_method?: 'pattern' | 'llm' | 'hybrid' | 'manual';
  classification_confidence?: number;

  // New LLM analysis field (Migration 008)
  llm_analysis?: string;  // JSON string containing full LLM response
}

// Optional: Add typed interface for the JSON content
export interface MessageLLMAnalysis {
  isRealEstateRelated: boolean;
  confidence: number;
  transactionIndicators: {
    type: 'purchase' | 'sale' | 'lease' | null;
    stage: 'prospecting' | 'active' | 'pending' | 'closing' | 'closed' | null;
  };
  extractedEntities: {
    addresses: Array<{ value: string; confidence: number }>;
    amounts: Array<{ value: number; context: string }>;
    dates: Array<{ value: string; type: string }>;
    contacts: Array<{ name: string; email?: string; suggestedRole?: string }>;
  };
  reasoning: string;
  model: string;
  promptVersion: string;
}
```

### Important Details

- Column is nullable (no default) since most messages won't have LLM analysis
- JSON stored as TEXT (SQLite doesn't have native JSON type)
- The `MessageLLMAnalysis` interface is for documentation/typing but parsing happens in service layer
- Existing `classification_method` and `classification_confidence` fields already exist per SR Engineer review

## Integration Notes

- Imports from: None
- Exports to: None (schema only)
- Used by: Future AI analysis tools (BACKLOG-075)
- Depends on: None (can start immediately)

## Do / Don't

### Do:
- Check if column exists before adding (idempotent migration)
- Keep column nullable (not all messages will be analyzed)
- Add the typed interface for documentation purposes

### Don't:
- Don't add default value (empty JSON would be misleading)
- Don't add indexes (JSON queries would need partial indexes)
- Don't implement parsing logic (service layer responsibility)

## When to Stop and Ask

- If messages table structure differs from expected
- If llm_analysis or similar column already exists
- If classification_method/classification_confidence don't exist (may need to add them)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (migration testing in TASK-305)
- New tests to write: None
- Existing tests to update: None

### Coverage

- Coverage impact: No change

### Integration / Feature Tests

- Required scenarios: Covered by TASK-305

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-303-messages-llm-analysis`
- **Title**: `feat(db): add llm_analysis column to messages table`
- **Labels**: `database`, `ai-mvp`, `sprint-004`
- **Depends on**: None

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files modified:
- [ ] electron/services/databaseService.ts
- [ ] electron/types/models.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any deviations, explain what and why>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything reviewer should pay attention to>
