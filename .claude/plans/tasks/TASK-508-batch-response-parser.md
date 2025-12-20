# TASK-508: Batch Response Parser

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Parse LLM batch responses and map results back to individual emails.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 3 (Batching)
- **Dependencies**: TASK-507
- **Estimated Turns**: 20

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-508-batch-response-parser
```

## Technical Specification

### Add to Batch Service

**File:** `electron/services/llm/batchLLMService.ts` (MODIFY)

```typescript
export interface BatchAnalysisResult {
  emailId: string;
  isTransaction: boolean;
  confidence: number;
  transactionType?: string;
  propertyAddress?: string;
  parties?: Array<{ name: string; role: string }>;
  rawResponse?: any;
}

export interface BatchParseResult {
  results: BatchAnalysisResult[];
  errors: Array<{ emailId: string; error: string }>;
  stats: {
    total: number;
    successful: number;
    failed: number;
    transactionsFound: number;
  };
}

/**
 * Type for raw LLM response item (handles snake_case vs camelCase)
 * Per SR Engineer review - explicit type safety
 */
interface LLMBatchResponseItem {
  isTransaction?: boolean;
  is_transaction?: boolean;  // Handle snake_case from some models
  confidence?: number;
  transactionType?: string;
  transaction_type?: string;
  propertyAddress?: string;
  property_address?: string;
  parties?: Array<{ name: string; role: string }>;
}

/**
 * Extract JSON array from LLM response, handling markdown code blocks
 * (Per SR Engineer review - improved robustness)
 */
function extractJsonArray(response: string): string | null {
  // Remove markdown code blocks first (handles ```json and ``` wrappers)
  let cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // Find JSON array
  const match = cleaned.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

/**
 * Parse batch LLM response and map to individual emails
 */
export function parseBatchResponse(
  batch: EmailBatch,
  llmResponse: string
): BatchParseResult {
  const results: BatchAnalysisResult[] = [];
  const errors: Array<{ emailId: string; error: string }> = [];

  try {
    // Extract JSON array from response (handles markdown code blocks)
    const jsonString = extractJsonArray(llmResponse);
    if (!jsonString) {
      throw new Error('No JSON array found in response');
    }

    const parsedResults = JSON.parse(jsonString);

    // Validate array length matches (per SR Engineer review)
    if (parsedResults.length !== batch.emails.length) {
      logService.warn('Response count mismatch', 'BatchParser', {
        expected: batch.emails.length,
        received: parsedResults.length
      });
    }

    if (!Array.isArray(parsedResults)) {
      throw new Error('Response is not an array');
    }

    // Map results to emails by index
    for (let i = 0; i < batch.emails.length; i++) {
      const email = batch.emails[i];
      const result = parsedResults[i];

      if (!result) {
        errors.push({
          emailId: email.id,
          error: `No result at index ${i}`
        });
        continue;
      }

      results.push({
        emailId: email.id,
        isTransaction: Boolean(result.isTransaction || result.is_transaction),
        confidence: result.confidence || 0,
        transactionType: result.transactionType || result.transaction_type,
        propertyAddress: result.propertyAddress || result.property_address,
        parties: result.parties || [],
        rawResponse: result
      });
    }

  } catch (error) {
    // If batch parsing fails, mark all as errors
    for (const email of batch.emails) {
      errors.push({
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown parse error'
      });
    }
  }

  return {
    results,
    errors,
    stats: {
      total: batch.emails.length,
      successful: results.length,
      failed: errors.length,
      transactionsFound: results.filter(r => r.isTransaction).length
    }
  };
}

/**
 * Fallback: Process failed batch emails individually
 */
export async function processBatchErrors(
  errors: Array<{ emailId: string; error: string }>,
  emailMap: Map<string, Message>,
  analyzeFn: (email: Message) => Promise<BatchAnalysisResult>
): Promise<BatchAnalysisResult[]> {
  const fallbackResults: BatchAnalysisResult[] = [];

  for (const error of errors) {
    const email = emailMap.get(error.emailId);
    if (!email) continue;

    try {
      const result = await analyzeFn(email);
      fallbackResults.push(result);
    } catch {
      // Skip if individual analysis also fails
    }
  }

  return fallbackResults;
}
```

### Unit Tests

**File:** `electron/services/llm/__tests__/batchLLMService.test.ts` (ADD)

```typescript
describe('parseBatchResponse', () => {
  const mockBatch: EmailBatch = {
    batchId: 'test',
    emails: [
      { id: 'email_1' },
      { id: 'email_2' },
      { id: 'email_3' }
    ],
    estimatedTokens: 1000
  };

  it('should parse valid JSON array response', () => {
    const response = `[
      { "isTransaction": true, "confidence": 0.9 },
      { "isTransaction": false, "confidence": 0.1 },
      { "isTransaction": true, "confidence": 0.85 }
    ]`;

    const result = parseBatchResponse(mockBatch, response);

    expect(result.results.length).toBe(3);
    expect(result.errors.length).toBe(0);
    expect(result.stats.transactionsFound).toBe(2);
  });

  it('should handle response with markdown code blocks', () => {
    const response = '```json\n[{"isTransaction": true}]\n```';
    const result = parseBatchResponse(
      { ...mockBatch, emails: [{ id: 'email_1' }] },
      response
    );

    expect(result.results.length).toBe(1);
  });

  it('should handle parse errors gracefully', () => {
    const response = 'invalid json';
    const result = parseBatchResponse(mockBatch, response);

    expect(result.errors.length).toBe(3);
    expect(result.results.length).toBe(0);
  });
});
```

## Acceptance Criteria

- [ ] `parseBatchResponse()` extracts results from LLM response
- [ ] Maps results back to correct email IDs
- [ ] Handles JSON in markdown code blocks
- [ ] Graceful error handling for parse failures
- [ ] Fallback function for individual reprocessing
- [ ] Unit tests pass

## Files to Modify

| File | Action |
|------|--------|
| `electron/services/llm/batchLLMService.ts` | MODIFY |
| `electron/services/llm/__tests__/batchLLMService.test.ts` | MODIFY |

**Note:** Test file location matches service location per SR Engineer review.

## Guardrails

- DO NOT make actual LLM calls
- DO NOT integrate with pipeline yet (TASK-509)
- Pure parsing logic only

## Definition of Done

- [ ] Parser implemented
- [ ] Unit tests passing
- [ ] PR created targeting `int/cost-optimization`

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [ ] Approved as-is
- [x] Approved with minor changes
- [ ] Needs revision

### Branch Information
- **Branch From:** `int/cost-optimization` (after TASK-507 merged)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-508-batch-response-parser`

### Execution Classification
- **Parallel Safe:** No - modifies same file as TASK-507
- **Depends On:** TASK-507
- **Blocks:** TASK-509

### Technical Notes

1. **JSON extraction regex is fragile:** The regex `/\[[\s\S]*\]/` will match the FIRST `[` to the LAST `]` in the response, which could include unrelated brackets. Consider a more robust approach.

2. **Markdown code block handling:** The test shows handling ``` json blocks but the `parseBatchResponse` implementation doesn't explicitly strip them. The regex happens to work because it finds the JSON array inside, but edge cases could fail.

3. **Index-based mapping is risky:** Mapping by array index assumes LLM returns results in exact order. If LLM omits an entry or reorders, mapping will be wrong. Consider:
   - Requiring email ID in response
   - Validating array length matches

4. **Error handling is good:** Graceful degradation by marking all as errors when parse fails is correct.

5. **processBatchErrors fallback design is good:** Individual reprocessing for failed items is the right pattern.

6. **BatchAnalysisResult type alignment:** The interface matches what existing LLM tools return (from `llm/tools/types.ts`).

### Risk Notes

- **Medium risk:** Response parsing is error-prone. Extensive testing needed.
- **LLM response variability:** Different models may format JSON differently. Test with both OpenAI and Anthropic.

### Dependencies

Confirmed: TASK-507 must be merged first. Sequential within Phase 3.

### Shared File Analysis
- Files modified: `batchLLMService.ts` - same as TASK-507
- **CRITICAL:** Must merge after TASK-507, before TASK-509

### Recommended Changes

1. **Critical:** Improve JSON extraction to handle markdown code blocks explicitly:

   ```typescript
   function extractJsonArray(response: string): string | null {
     // Remove markdown code blocks first
     let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');

     // Find JSON array
     const match = cleaned.match(/\[[\s\S]*\]/);
     return match ? match[0] : null;
   }
   ```

2. **Robustness:** Validate response array length:
   ```typescript
   if (parsedResults.length !== batch.emails.length) {
     logService.warn('Response count mismatch', 'BatchParser', {
       expected: batch.emails.length,
       received: parsedResults.length
     });
   }
   ```

3. **Type safety:** Add explicit type for the parsed LLM response:
   ```typescript
   interface LLMBatchResponseItem {
     isTransaction?: boolean;
     is_transaction?: boolean;  // Handle snake_case
     confidence?: number;
     // ... other fields
   }
   ```

4. **Test enhancement:** Add tests for:
   - Response with wrong array length
   - Response with extra text before/after JSON
   - Response with nested JSON objects containing brackets
   - Empty response handling
