# BACKLOG-075: AI MVP Phase 2 - AI Analysis Tools

**Priority:** High
**Type:** Backend / LLM / AI
**Sprint:** SPRINT-005
**Estimated Effort:** 28 turns (~2h)
**Dependencies:** BACKLOG-074 (LLM Infrastructure)

---

## Description

Create pure-function AI tools for transaction analysis. These tools analyze messages, extract contact roles, and cluster communications into transaction groups.

---

## Tasks

### A01: Create Message Analyzer Tool
**Estimated:** 4 turns
**File:** `electron/services/llm/tools/analyzeMessageTool.ts`

Analyzes single message for real estate relevance.

**Input:** Message content, sender, recipients, date

**Output:**
```typescript
interface MessageAnalysis {
  isRealEstateRelated: boolean;
  confidence: number;
  transactionIndicators: {
    type: 'purchase' | 'sale' | 'lease' | null;
    stage: 'prospecting' | 'active' | 'pending' | 'closing' | 'closed' | null;
  };
  extractedEntities: {
    addresses: Array<{ value: string; confidence: number }>;
    amounts: Array<{ value: number; context: string }>;
    dates: Array<{ value: string; type: 'closing' | 'inspection' | 'other' }>;
    contacts: Array<{ name: string; email?: string; phone?: string; suggestedRole?: string }>;
  };
  reasoning: string;
}
```

**Acceptance Criteria:**
- [ ] Returns valid MessageAnalysis JSON
- [ ] Identifies real estate keywords/phrases
- [ ] Extracts addresses with confidence scores
- [ ] Works with sanitized email content

### A02: Create Contact Role Extractor Tool
**Estimated:** 3 turns
**File:** `electron/services/llm/tools/extractContactRolesTool.ts`

Identifies contact roles from communication context.

**Input:** Communication history, known contacts, property address

**Output:**
```typescript
interface ContactRoleExtraction {
  assignments: Array<{
    contactId?: string;
    name: string;
    email?: string;
    role: string;  // 'buyer', 'seller', 'buyer_agent', 'seller_agent', 'escrow', 'inspector', etc.
    confidence: number;
    evidence: string[];  // Quotes from communications
  }>;
}
```

**Acceptance Criteria:**
- [ ] Identifies common real estate roles
- [ ] Provides evidence for each assignment
- [ ] Handles ambiguous cases with lower confidence
- [ ] Matches to existing contacts when possible

### A03: Create Transaction Clusterer Tool
**Estimated:** 3 turns
**File:** `electron/services/llm/tools/clusterTransactionsTool.ts`

Groups communications into transaction clusters.

**Input:** Array of analyzed messages

**Output:**
```typescript
interface TransactionCluster {
  clusterId: string;
  propertyAddress: string;
  confidence: number;
  transactionType: 'purchase' | 'sale' | 'lease' | null;
  communicationIds: string[];
  suggestedContacts: ContactRoleExtraction;
  dateRange: { start: string; end: string };
  summary: string;
}
```

**Acceptance Criteria:**
- [ ] Groups related messages by property address
- [ ] Identifies transaction type from context
- [ ] Provides date range for each cluster
- [ ] Generates human-readable summary

### A04: Create Prompt Templates
**Estimated:** 3 turns
**File:** `electron/services/llm/prompts/`

Structured prompts for each tool:
- `messageAnalysis.ts` - System + user prompts for message analysis
- `contactRoles.ts` - Prompts for role extraction
- `transactionClustering.ts` - Prompts for clustering

**Acceptance Criteria:**
- [ ] Prompts use JSON mode for reliable parsing
- [ ] System prompts define output schema
- [ ] User prompts include sanitized content
- [ ] Edge cases handled (empty body, foreign language)

### A05: Prompt Versioning System
**Estimated:** 2 turns
**File:** `electron/services/llm/promptVersionService.ts`

Track which prompt version produced each result:

```typescript
interface PromptVersion {
  id: string;
  name: string;  // 'message-analysis-v1', 'contact-roles-v2'
  version: string;
  hash: string;  // SHA of prompt content
  createdAt: Date;
}

interface PromptVersionService {
  getCurrentVersion(promptName: string): PromptVersion;
  recordUsage(promptName: string, resultId: string): void;
  getAccuracyByVersion(promptName: string): Map<string, number>;
}
```

**Acceptance Criteria:**
- [ ] Version ID stored with each LLM result
- [ ] Can retrieve accuracy metrics by version
- [ ] Enables A/B testing of prompt variations

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/llm/tools/analyzeMessageTool.ts` | Message analysis |
| `electron/services/llm/tools/extractContactRolesTool.ts` | Role extraction |
| `electron/services/llm/tools/clusterTransactionsTool.ts` | Transaction clustering |
| `electron/services/llm/prompts/messageAnalysis.ts` | Message analysis prompts |
| `electron/services/llm/prompts/contactRoles.ts` | Role extraction prompts |
| `electron/services/llm/prompts/transactionClustering.ts` | Clustering prompts |
| `electron/services/llm/promptVersionService.ts` | Prompt version tracking |

---

## Quality Gate: AI Tools Ready

Before marking complete, verify:
- [ ] Message analysis returns valid JSON
- [ ] Role extraction identifies common roles (buyer, seller, agent, escrow, etc.)
- [ ] Clustering groups messages by property address
- [ ] Prompt snapshot tests pass
- [ ] Tools work with both OpenAI and Anthropic providers

---

## Testing Strategy

### Unit Tests
- Mock LLM responses for deterministic testing
- Test JSON parsing and validation
- Test edge cases (empty input, malformed response)

### Prompt Regression Tests
- Snapshot tests for prompt templates
- Detect unintended prompt changes
- Test multi-language content handling

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
