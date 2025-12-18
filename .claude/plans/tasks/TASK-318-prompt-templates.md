# Task TASK-318: Prompt Templates

## Goal

Extract and organize prompt templates from the AI tools (TASK-315-317) into dedicated template files with structured versioning, enabling independent prompt iteration and snapshot testing.

## Non-Goals

- Do NOT implement the hybrid extraction pipeline (TASK-320)
- Do NOT implement full prompt versioning service (TASK-319)
- Do NOT modify the core LLM services (baseLLMService, etc.)
- Do NOT add IPC handlers or UI components
- Do NOT change the tool interfaces (input/output types)

## Deliverables

1. New file: `electron/services/llm/prompts/messageAnalysis.ts`
2. New file: `electron/services/llm/prompts/contactRoles.ts`
3. New file: `electron/services/llm/prompts/transactionClustering.ts`
4. New file: `electron/services/llm/prompts/types.ts`
5. New file: `electron/services/llm/prompts/index.ts`
6. Update: `electron/services/llm/tools/analyzeMessageTool.ts` (use external prompts)
7. Update: `electron/services/llm/tools/extractContactRolesTool.ts` (use external prompts)
8. Update: `electron/services/llm/tools/clusterTransactionsTool.ts` (use external prompts)

## Acceptance Criteria

- [ ] Each tool has a dedicated prompt template file
- [ ] Prompt templates export system and user prompt builders
- [ ] Each template includes a version identifier (semantic version)
- [ ] Each template includes a content hash for change detection
- [ ] Prompts use consistent formatting and structure
- [ ] Tools import prompts from template files instead of inline
- [ ] Snapshot tests can detect unintended prompt changes
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/services/llm/prompts/types.ts
export interface PromptTemplate {
  name: string;
  version: string; // semver: "1.0.0"
  hash: string; // SHA-256 of combined prompt content
  buildSystemPrompt: (context?: Record<string, unknown>) => string;
  buildUserPrompt: (input: Record<string, unknown>) => string;
}

export interface PromptMetadata {
  name: string;
  version: string;
  hash: string;
  createdAt: string;
  description: string;
}

export function computePromptHash(systemPrompt: string, userPromptTemplate: string): string {
  // Use simple hash for prompt versioning
  const content = systemPrompt + userPromptTemplate;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
```

```typescript
// electron/services/llm/prompts/messageAnalysis.ts
import { PromptTemplate, PromptMetadata, computePromptHash } from './types';
import { AnalyzeMessageInput } from '../tools/types';

const SYSTEM_PROMPT = `You are a real estate transaction analyst. Analyze the provided email and extract structured information.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "isRealEstateRelated": boolean,
  "confidence": number (0-1),
  "transactionIndicators": {
    "type": "purchase" | "sale" | "lease" | null,
    "stage": "prospecting" | "active" | "pending" | "closing" | "closed" | null
  },
  "extractedEntities": {
    "addresses": [{ "value": string, "confidence": number }],
    "amounts": [{ "value": number, "context": string }],
    "dates": [{ "value": string (ISO format), "type": "closing" | "inspection" | "other" }],
    "contacts": [{ "name": string, "email": string?, "phone": string?, "suggestedRole": string? }]
  },
  "reasoning": string (brief explanation of analysis)
}

Real estate indicators include: property addresses, MLS numbers, closing/escrow terms, buyer/seller mentions, offer amounts, inspection dates, title/deed references.`;

const USER_PROMPT_TEMPLATE = `Analyze this email:

From: {{sender}}
To: {{recipients}}
Date: {{date}}
Subject: {{subject}}

Body:
{{body}}`;

export const messageAnalysisPrompt: PromptTemplate = {
  name: 'message-analysis',
  version: '1.0.0',
  hash: computePromptHash(SYSTEM_PROMPT, USER_PROMPT_TEMPLATE),

  buildSystemPrompt: () => SYSTEM_PROMPT,

  buildUserPrompt: (input: Record<string, unknown>) => {
    const data = input as AnalyzeMessageInput;
    return USER_PROMPT_TEMPLATE
      .replace('{{sender}}', data.sender)
      .replace('{{recipients}}', data.recipients.join(', '))
      .replace('{{date}}', data.date)
      .replace('{{subject}}', data.subject)
      .replace('{{body}}', data.body);
  },
};

export const messageAnalysisMetadata: PromptMetadata = {
  name: messageAnalysisPrompt.name,
  version: messageAnalysisPrompt.version,
  hash: messageAnalysisPrompt.hash,
  createdAt: '2024-12-18',
  description: 'Analyzes email content for real estate relevance and extracts entities',
};
```

```typescript
// electron/services/llm/prompts/contactRoles.ts
import { PromptTemplate, PromptMetadata, computePromptHash } from './types';
import { ExtractContactRolesInput } from '../tools/types';

const SYSTEM_PROMPT = `You are a real estate transaction analyst. Analyze the provided email communications and identify the role of each participant.

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

export const contactRolesPrompt: PromptTemplate = {
  name: 'contact-roles',
  version: '1.0.0',
  hash: computePromptHash(SYSTEM_PROMPT, ''),

  buildSystemPrompt: () => SYSTEM_PROMPT,

  buildUserPrompt: (input: Record<string, unknown>) => {
    const data = input as ExtractContactRolesInput;
    let prompt = `Analyze these email communications and identify participant roles:\n\n`;

    if (data.propertyAddress) {
      prompt += `Property: ${data.propertyAddress}\n\n`;
    }

    if (data.knownContacts && data.knownContacts.length > 0) {
      prompt += `Known contacts (match if possible):\n`;
      data.knownContacts.forEach(c => {
        prompt += `- ${c.name}${c.email ? ` (${c.email})` : ''}${c.phone ? ` ${c.phone}` : ''}\n`;
      });
      prompt += '\n';
    }

    prompt += `Communications:\n\n`;
    data.communications.forEach((comm, i) => {
      prompt += `--- Email ${i + 1} ---\n`;
      prompt += `From: ${comm.sender}\n`;
      prompt += `To: ${comm.recipients.join(', ')}\n`;
      prompt += `Date: ${comm.date}\n`;
      prompt += `Subject: ${comm.subject}\n\n`;
      prompt += `${comm.body}\n\n`;
    });

    return prompt;
  },
};

export const contactRolesMetadata: PromptMetadata = {
  name: contactRolesPrompt.name,
  version: contactRolesPrompt.version,
  hash: contactRolesPrompt.hash,
  createdAt: '2024-12-18',
  description: 'Extracts contact roles from communication history',
};
```

```typescript
// electron/services/llm/prompts/transactionClustering.ts
import { PromptTemplate, PromptMetadata, computePromptHash } from './types';
import { ClusterTransactionsInput } from '../tools/types';

const SYSTEM_PROMPT = `You are a real estate transaction analyst. Group the provided email analyses into distinct transaction clusters.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "clusters": [
    {
      "propertyAddress": string,
      "messageIds": [string],
      "transactionType": "purchase" | "sale" | "lease" | null,
      "stage": "prospecting" | "active" | "pending" | "closing" | "closed" | null,
      "confidence": number (0-1),
      "summary": string (1-2 sentence description)
    }
  ],
  "unclustered": [string] (message IDs that don't clearly belong to any transaction)
}

Clustering rules:
1. Primary grouping key is property address
2. Messages about the same property belong together
3. If address is unclear, use participant overlap as secondary signal
4. Separate overlapping timeframes with different properties
5. Mark ambiguous assignments with lower confidence`;

export const transactionClusteringPrompt: PromptTemplate = {
  name: 'transaction-clustering',
  version: '1.0.0',
  hash: computePromptHash(SYSTEM_PROMPT, ''),

  buildSystemPrompt: () => SYSTEM_PROMPT,

  buildUserPrompt: (input: Record<string, unknown>) => {
    const data = input as ClusterTransactionsInput;
    let prompt = `Group these analyzed emails into transaction clusters:\n\n`;

    if (data.existingTransactions && data.existingTransactions.length > 0) {
      prompt += `Existing transactions (for reference):\n`;
      data.existingTransactions.forEach(t => {
        prompt += `- ${t.propertyAddress} (${t.transactionType || 'unknown type'})\n`;
      });
      prompt += '\n';
    }

    prompt += `Analyzed messages:\n\n`;
    data.analyzedMessages.forEach((msg, i) => {
      prompt += `Message ${i + 1} (ID: ${msg.id}):\n`;
      prompt += `- Subject: ${msg.subject}\n`;
      prompt += `- From: ${msg.sender}\n`;
      prompt += `- Date: ${msg.date}\n`;
      prompt += `- Is RE: ${msg.analysis.isRealEstateRelated}, Confidence: ${msg.analysis.confidence}\n`;
      if (msg.analysis.extractedEntities.addresses.length > 0) {
        prompt += `- Addresses: ${msg.analysis.extractedEntities.addresses.map(a => a.value).join(', ')}\n`;
      }
      if (msg.analysis.transactionIndicators.type) {
        prompt += `- Type: ${msg.analysis.transactionIndicators.type}, Stage: ${msg.analysis.transactionIndicators.stage || 'unknown'}\n`;
      }
      prompt += '\n';
    });

    return prompt;
  },
};

export const transactionClusteringMetadata: PromptMetadata = {
  name: transactionClusteringPrompt.name,
  version: transactionClusteringPrompt.version,
  hash: transactionClusteringPrompt.hash,
  createdAt: '2024-12-18',
  description: 'Groups analyzed messages into transaction clusters',
};
```

```typescript
// electron/services/llm/prompts/index.ts
export * from './types';
export * from './messageAnalysis';
export * from './contactRoles';
export * from './transactionClustering';

import { messageAnalysisMetadata } from './messageAnalysis';
import { contactRolesMetadata } from './contactRoles';
import { transactionClusteringMetadata } from './transactionClustering';

export const ALL_PROMPTS = [
  messageAnalysisMetadata,
  contactRolesMetadata,
  transactionClusteringMetadata,
];
```

### Tool Update Example

```typescript
// electron/services/llm/tools/analyzeMessageTool.ts (updated)
import { messageAnalysisPrompt } from '../prompts';

// In buildPrompt method:
private buildPrompt(input: AnalyzeMessageInput): LLMMessage[] {
  return [
    { role: 'system', content: messageAnalysisPrompt.buildSystemPrompt() },
    { role: 'user', content: messageAnalysisPrompt.buildUserPrompt(input) },
  ];
}

// Store version with result
return {
  success: true,
  data: {
    ...analysis,
    promptVersion: messageAnalysisPrompt.hash,
  },
  // ...
};
```

### Important Details

- Use simple hash function for version tracking (no external crypto needed)
- Keep prompts as template literals for readability
- Use {{placeholder}} syntax for user prompt templates
- Export both prompt template and metadata objects
- Tools should store promptVersion with results for tracking

## Integration Notes

- Imports from: `electron/services/llm/tools/types.ts`
- Exports to: `electron/services/llm/tools/*.ts`
- Used by: All AI tools (TASK-315-317), Prompt Versioning Service (TASK-319)
- Depends on: TASK-315-317 (tools must exist to extract prompts)

## Do / Don't

### Do:
- Keep prompts as readable template strings
- Include JSON schema in system prompts
- Use consistent placeholder syntax ({{name}})
- Export metadata for each prompt
- Compute hash at module load time

### Don't:
- Use complex templating libraries
- Include dynamic content in hash computation
- Change prompt content without bumping version
- Remove hash/version properties from templates
- Put business logic in prompt templates

## When to Stop and Ask

- If any of TASK-315-317 are not complete
- If prompt structure differs significantly from expected
- If hash computation needs cryptographic security
- If tools have different prompt structures than documented

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `prompts/__tests__/prompts.test.ts`:
    - Snapshot test for each system prompt
    - Snapshot test for sample user prompts
    - Hash stability test (same content = same hash)
    - Version format validation
    - Template substitution correctness

### Coverage

- Coverage impact:
  - Target 90%+ for prompt template files (mostly constants)

### Integration / Feature Tests

- Required scenarios:
  - Tools produce same output with external prompts
  - Prompt version appears in tool results

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(llm): extract prompt templates [TASK-318]`
- **Labels**: `llm`, `ai-mvp`, `phase-1`
- **Depends on**: TASK-315, TASK-316, TASK-317 (must be merged first)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Estimated Totals:**
- **Turns:** 5-6
- **Tokens:** ~20K-25K
- **Time:** ~25-35m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 5 new files (3 prompts + types + index) | +2 |
| Files to modify | 3 files (update tools) | +1.5 |
| Code volume | ~300 lines (mostly template strings) | +1 |
| Functions/handlers | 6 builder functions | +0.5 |
| Core files touched | No (electron main/preload unchanged) | +0 |
| New patterns | Simple template extraction | +0 |
| Test complexity | Low (snapshot tests) | +1 |
| Dependencies | 0 new dependencies | +0 |

**Confidence:** High

**Risk factors:**
- Prompt extraction may reveal inconsistencies
- Hash stability across environments

**Similar past tasks:** Configuration file extraction tasks (~4-5 turns)

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
Files created:
- [ ] electron/services/llm/prompts/types.ts
- [ ] electron/services/llm/prompts/messageAnalysis.ts
- [ ] electron/services/llm/prompts/contactRoles.ts
- [ ] electron/services/llm/prompts/transactionClustering.ts
- [ ] electron/services/llm/prompts/index.ts

Files modified:
- [ ] electron/services/llm/tools/analyzeMessageTool.ts
- [ ] electron/services/llm/tools/extractContactRolesTool.ts
- [ ] electron/services/llm/tools/clusterTransactionsTool.ts

Features implemented:
- [ ] Prompt templates extracted
- [ ] Hash computation working
- [ ] Tools use external prompts
- [ ] Snapshot tests created

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 5 | X | +/- X | <reason> |
| Files to modify | 3 | X | +/- X | <reason> |
| Code volume | ~300 lines | ~X lines | +/- X | <reason> |
| Functions/handlers | 6 | X | +/- X | <reason> |
| Core files touched | No | Yes/No | - | <reason if changed> |
| New patterns | No | Yes/No | - | <reason if changed> |
| Test complexity | Low | Low/Med/High | - | <reason if changed> |

**Total Variance:** Est 5-6 turns -> Actual Z turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/ai-tools (after TASK-315, 316, 317 merged)
- **Branch Into:** int/ai-tools
- **Suggested Branch Name:** feature/TASK-318-prompt-templates

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-315, TASK-316, TASK-317 (must be merged first)
- **Blocks:** TASK-319 (prompt versioning), TASK-320 (hybrid extractor)

### Shared File Analysis
- Files created:
  - `electron/services/llm/prompts/types.ts` (new)
  - `electron/services/llm/prompts/messageAnalysis.ts` (new)
  - `electron/services/llm/prompts/contactRoles.ts` (new)
  - `electron/services/llm/prompts/transactionClustering.ts` (new)
  - `electron/services/llm/prompts/index.ts` (new)
- Files modified:
  - `electron/services/llm/tools/analyzeMessageTool.ts` (import prompts)
  - `electron/services/llm/tools/extractContactRolesTool.ts` (import prompts)
  - `electron/services/llm/tools/clusterTransactionsTool.ts` (import prompts)
- Conflicts with: None (depends on 315-317 being complete)
- **Resolution:** Sequential after Phase 1 parallel tasks merge

### Technical Considerations
- Simple hash function is adequate for versioning (no crypto dependency)
- Template substitution uses {{placeholder}} syntax - simple and clear
- Each prompt includes version and hash for tracking
- Snapshot tests will catch unintended prompt changes
- Refactoring existing tools to use external prompts is low-risk
- No core file modifications

### Additional Notes
- This is a refactoring task - extracts existing prompts to separate files
- Low risk of breaking functionality since prompts already work
- Snapshot tests are critical for prompt stability

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
