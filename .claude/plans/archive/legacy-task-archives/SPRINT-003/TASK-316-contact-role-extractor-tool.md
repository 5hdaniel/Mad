# Task TASK-316: Contact Role Extractor Tool

## Goal

Create a pure-function AI tool that identifies contact roles from communication context, extracting buyer, seller, agent, escrow, inspector, and other real estate transaction participants with confidence scores and evidence.

## Non-Goals

- Do NOT implement the hybrid extraction pipeline (TASK-320)
- Do NOT modify transactionService or transactionExtractorService
- Do NOT create prompt templates in this task (TASK-318)
- Do NOT implement prompt versioning (TASK-319)
- Do NOT add IPC handlers or UI components
- Do NOT match contacts to database records (that's the caller's responsibility)

## Deliverables

1. New file: `electron/services/llm/tools/extractContactRolesTool.ts`
2. Update file: `electron/services/llm/tools/types.ts` (add ContactRoleExtraction types)

## Acceptance Criteria

- [ ] `extractContactRoles()` accepts communication history and returns `ContactRoleExtraction` JSON
- [ ] Identifies standard real estate roles: buyer, seller, buyer_agent, seller_agent, escrow, title, lender, inspector, appraiser
- [ ] Each assignment includes confidence score (0-1)
- [ ] Each assignment includes evidence array (quotes from communications)
- [ ] Handles ambiguous cases with lower confidence scores
- [ ] Returns empty assignments array for non-RE communications
- [ ] Works with both OpenAI and Anthropic providers via BaseLLMService
- [ ] Validates LLM response against JSON schema before returning
- [ ] Handles malformed LLM responses gracefully (returns error result)
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// Add to electron/services/llm/tools/types.ts
export interface ContactRoleAssignment {
  contactId?: string; // Optional - caller may match later
  name: string;
  email?: string;
  phone?: string;
  role: ContactRole;
  confidence: number; // 0-1
  evidence: string[]; // Quotes from communications
}

export type ContactRole =
  | 'buyer'
  | 'seller'
  | 'buyer_agent'
  | 'seller_agent'
  | 'escrow'
  | 'title'
  | 'lender'
  | 'inspector'
  | 'appraiser'
  | 'attorney'
  | 'other';

export interface ContactRoleExtraction {
  assignments: ContactRoleAssignment[];
  transactionContext?: {
    propertyAddress?: string;
    transactionType?: 'purchase' | 'sale' | 'lease';
  };
}

export interface ExtractContactRolesInput {
  communications: Array<{
    subject: string;
    body: string;
    sender: string;
    recipients: string[];
    date: string;
  }>;
  knownContacts?: Array<{
    name: string;
    email?: string;
    phone?: string;
  }>;
  propertyAddress?: string;
}
```

```typescript
// electron/services/llm/tools/extractContactRolesTool.ts
import { BaseLLMService } from '../baseLLMService';
import { LLMConfig, LLMMessage } from '../types';
import {
  ContactRoleExtraction,
  ExtractContactRolesInput,
  ToolResult,
  ContactRole,
} from './types';
import { ContentSanitizer } from '../contentSanitizer';

const VALID_ROLES: ContactRole[] = [
  'buyer', 'seller', 'buyer_agent', 'seller_agent',
  'escrow', 'title', 'lender', 'inspector', 'appraiser', 'attorney', 'other'
];

export class ExtractContactRolesTool {
  private llmService: BaseLLMService;
  private sanitizer: ContentSanitizer;

  constructor(llmService: BaseLLMService) {
    this.llmService = llmService;
    this.sanitizer = new ContentSanitizer();
  }

  async extract(
    input: ExtractContactRolesInput,
    config: LLMConfig
  ): Promise<ToolResult<ContactRoleExtraction>> {
    const startTime = Date.now();

    try {
      // Sanitize all communication content
      const sanitizedComms = input.communications.map(comm => ({
        ...comm,
        body: this.sanitizer.sanitize(comm.body),
        subject: this.sanitizer.sanitize(comm.subject),
      }));

      const messages = this.buildPrompt({
        ...input,
        communications: sanitizedComms,
      });

      const response = await this.llmService.completeWithRetry(messages, {
        ...config,
        maxTokens: 2000, // May need more for multiple contacts
      });

      const extraction = this.parseResponse(response.content);

      return {
        success: true,
        data: extraction,
        tokensUsed: response.tokensUsed,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private buildPrompt(input: ExtractContactRolesInput): LLMMessage[] {
    const systemPrompt = `You are a real estate transaction analyst. Analyze the provided email communications and identify the role of each participant.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "assignments": [
    {
      "name": string,
      "email": string | null,
      "phone": string | null,
      "role": "buyer" | "seller" | "buyer_agent" | "seller_agent" | "escrow" | "title" | "lender" | "inspector" | "appraiser" | "attorney" | "other",
      "confidence": number (0-1),
      "evidence": [string] (direct quotes from emails supporting this role assignment)
    }
  ],
  "transactionContext": {
    "propertyAddress": string | null,
    "transactionType": "purchase" | "sale" | "lease" | null
  }
}

Role definitions:
- buyer: The person/entity purchasing the property
- seller: The person/entity selling the property
- buyer_agent: Real estate agent representing the buyer
- seller_agent: Real estate agent representing the seller (listing agent)
- escrow: Escrow officer or company
- title: Title company representative
- lender: Mortgage lender or loan officer
- inspector: Home inspector
- appraiser: Property appraiser
- attorney: Real estate attorney
- other: Any other transaction participant

Provide evidence by quoting relevant text that indicates each person's role.`;

    let userPrompt = `Analyze these email communications and identify participant roles:\n\n`;

    if (input.propertyAddress) {
      userPrompt += `Property: ${input.propertyAddress}\n\n`;
    }

    if (input.knownContacts && input.knownContacts.length > 0) {
      userPrompt += `Known contacts (match if possible):\n`;
      input.knownContacts.forEach(c => {
        userPrompt += `- ${c.name}${c.email ? ` (${c.email})` : ''}${c.phone ? ` ${c.phone}` : ''}\n`;
      });
      userPrompt += '\n';
    }

    userPrompt += `Communications:\n\n`;
    input.communications.forEach((comm, i) => {
      userPrompt += `--- Email ${i + 1} ---\n`;
      userPrompt += `From: ${comm.sender}\n`;
      userPrompt += `To: ${comm.recipients.join(', ')}\n`;
      userPrompt += `Date: ${comm.date}\n`;
      userPrompt += `Subject: ${comm.subject}\n\n`;
      userPrompt += `${comm.body}\n\n`;
    });

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private parseResponse(content: string): ContactRoleExtraction {
    // Extract JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize assignments
    const assignments = (parsed.assignments || []).map((a: any) => {
      // Validate role
      const role = VALID_ROLES.includes(a.role) ? a.role : 'other';

      // Ensure confidence is valid
      let confidence = parseFloat(a.confidence);
      if (isNaN(confidence) || confidence < 0) confidence = 0;
      if (confidence > 1) confidence = 1;

      return {
        name: String(a.name || ''),
        email: a.email || undefined,
        phone: a.phone || undefined,
        role,
        confidence,
        evidence: Array.isArray(a.evidence) ? a.evidence.map(String) : [],
      };
    }).filter((a: any) => a.name); // Filter out empty names

    return {
      assignments,
      transactionContext: {
        propertyAddress: parsed.transactionContext?.propertyAddress || undefined,
        transactionType: parsed.transactionContext?.transactionType || undefined,
      },
    };
  }
}
```

### Important Details

- Use `ContentSanitizer` to remove PII before LLM call
- Evidence quotes should be short, relevant excerpts
- Handle case where no contacts can be identified (return empty assignments)
- Multiple communications provide better context for role detection
- Known contacts help the LLM match names to existing records

## Integration Notes

- Imports from: `electron/services/llm/baseLLMService.ts`, `electron/services/llm/contentSanitizer.ts`
- Exports to: `electron/services/extraction/hybridExtractorService.ts` (TASK-320)
- Used by: TASK-320 (Hybrid Extractor Service)
- Depends on: SPRINT-004 LLM infrastructure (complete)
- Parallel with: TASK-315 (Message Analyzer), TASK-317 (Clusterer)

## Do / Don't

### Do:
- Validate roles against known role types
- Normalize confidence scores to 0-1 range
- Include evidence quotes for each assignment
- Handle communications with no identifiable roles gracefully
- Log performance metrics (latency, token usage)

### Don't:
- Send unsanitized content to LLM
- Assume all participants have email addresses
- Create database records (just return extracted data)
- Include full email bodies in evidence (use short quotes)
- Hardcode model names (use config)

## When to Stop and Ask

- If ContentSanitizer is missing or has different API than expected
- If BaseLLMService.completeWithRetry has different signature
- If you need to modify existing LLM services
- If the prompt exceeds context window limits with multiple communications

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `extractContactRolesTool.test.ts`:
    - Test role extraction from buyer-side communication
    - Test role extraction from seller-side communication
    - Test multi-party extraction (agent, escrow, lender)
    - Test handling of ambiguous roles (low confidence)
    - Test evidence extraction
    - Test JSON parsing with code block wrapper
    - Test malformed JSON handling
    - Test empty communications array
    - Test content sanitization is called

### Coverage

- Coverage impact:
  - Target 80%+ for this new file

### Integration / Feature Tests

- Required scenarios:
  - Email from agent produces buyer_agent or seller_agent role
  - Email signature with "Escrow Officer" produces escrow role
  - Multiple emails from same person consistent role assignment

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(llm): add contact role extractor tool [TASK-316]`
- **Labels**: `llm`, `ai-mvp`, `phase-1`
- **Depends on**: None (Phase 1 parallel task)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Estimated Totals:**
- **Turns:** 5-7
- **Tokens:** ~20K-30K
- **Time:** ~25-40m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 1 new file (tool) | +1 |
| Files to modify | 1 file (types.ts) | +1 |
| Code volume | ~180 lines | +2 |
| Functions/handlers | 3 main functions (extract, buildPrompt, parseResponse) | +1 |
| Core files touched | No (electron main/preload unchanged) | +0 |
| New patterns | Following TASK-315 pattern | +0 |
| Test complexity | Medium (mocking LLM responses) | +1.5 |
| Dependencies | 1 service (BaseLLMService, ContentSanitizer) | +0 |

**Confidence:** Medium-High

**Risk factors:**
- Role classification edge cases
- Evidence extraction quality

**Similar past tasks:** TASK-315 (Message Analyzer, estimated 6-8 turns)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: 2025-12-18*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (inline - followed TASK-315 pattern)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 1 | ~3K | 2 min |
| Revision(s) | 0 | 0 | 0 min |
| **Plan Total** | 1 | ~3K | 2 min |
```

### Checklist

```
Files created:
- [x] electron/services/llm/tools/extractContactRolesTool.ts
- [x] electron/services/llm/tools/__tests__/extractContactRolesTool.test.ts

Files modified:
- [x] electron/services/llm/tools/types.ts (ContactRole types added)

Features implemented:
- [x] ContactRoleExtraction interface defined
- [x] extractContactRoles() function working
- [x] Role validation against VALID_ROLES array
- [x] Evidence extraction with quote arrays
- [x] Empty communications handling

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (warnings only)
- [x] npm test passes (16 tests)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 1 | ~3K | 2 min |
| Implementation (Impl) | 2 | ~10K | 8 min |
| Debugging (Debug) | 1 | ~2K | 2 min |
| **Engineer Total** | 4 | ~15K | 12 min |
```

### Notes

**Planning notes:**
Followed TASK-315 pattern closely. All roles defined in VALID_ROLES constant for validation.

**Deviations from plan:**
None - followed task spec closely.

**Design decisions:**
Added early return for empty communications array to avoid unnecessary LLM calls. Evidence arrays filter out empty strings.

**Issues encountered:**
Minor test fix needed - error messages get wrapped by BaseLLMService.

**Reviewer notes:**
Role normalization converts invalid roles to 'other'. Confidence values clamped to 0-1 range.

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 1 | 2 | +1 | Added test file |
| Files to modify | 1 | 1 | 0 | As expected |
| Code volume | ~180 lines | ~210 lines | +30 | More robust validation |
| Functions/handlers | 3 | 3 | 0 | As expected |
| Core files touched | No | No | - | - |
| New patterns | No | No | - | Following TASK-315 pattern |
| Test complexity | Medium | Medium | - | As expected |

**Total Variance:** Est 5-7 turns -> Actual 4 turns (29% under)

**Root cause of variance:**
Leveraged TASK-315 pattern directly, reducing design decisions.

**Suggestion for similar tasks:**
Parallel tasks that follow same pattern should get 25% reduction in estimate.

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** int/ai-tools
- **Suggested Branch Name:** feature/TASK-316-contact-role-extractor

### Execution Classification
- **Parallel Safe:** Yes (with TASK-315, TASK-317)
- **Depends On:** None (Phase 1 parallel)
- **Blocks:** TASK-318 (prompt extraction), TASK-320 (hybrid extractor)

### Shared File Analysis
- Files created:
  - `electron/services/llm/tools/extractContactRolesTool.ts` (new)
- Files modified:
  - `electron/services/llm/tools/types.ts` (adds ContactRole types)
- Conflicts with: TASK-315 creates `types.ts`, TASK-317 also modifies it
- **Resolution:** Merge order to int/ai-tools will determine conflict resolution. Each task adds distinct types (MessageAnalysis, ContactRole*, TransactionCluster). Recommend SR Engineer batch-review all three and merge in order: 315 -> 316 -> 317, with 316/317 rebasing on prior merges.

### Technical Considerations
- Follows same pattern as TASK-315 (AnalyzeMessageTool)
- Role enumeration is comprehensive for RE domain
- Evidence extraction provides audit trail for AI decisions
- Multiple communications input increases context window usage
- No core file modifications

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/ai-tools
