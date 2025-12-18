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

- [x] Each tool has a dedicated prompt template file
- [x] Prompt templates export system and user prompt builders
- [x] Each template includes a version identifier (semantic version)
- [x] Each template includes a content hash for change detection
- [x] Prompts use consistent formatting and structure
- [x] Tools import prompts from template files instead of inline
- [x] Snapshot tests can detect unintended prompt changes
- [x] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/services/llm/prompts/types.ts
export interface PromptTemplate<TInput = unknown, TContext = unknown> {
  name: string;
  version: string; // semver: "1.0.0"
  hash: string; // Simple hash of combined prompt content
  buildSystemPrompt: (context?: TContext) => string;
  buildUserPrompt: (input: TInput) => string;
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
- [x] Unit tests
- [x] Integration tests (if applicable)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

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

*Completed: 2025-12-18*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (inline - task file detailed spec)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 0 | 0K | 0 min |
| Revision(s) | 0 | 0K | 0 min |
| **Plan Total** | 0 | 0K | 0 min |

Note: Task file contained detailed implementation spec with complete code examples,
eliminating need for separate Plan agent invocation.
```

### Checklist

```
Files created:
- [x] electron/services/llm/prompts/types.ts
- [x] electron/services/llm/prompts/messageAnalysis.ts
- [x] electron/services/llm/prompts/contactRoles.ts
- [x] electron/services/llm/prompts/transactionClustering.ts
- [x] electron/services/llm/prompts/index.ts
- [x] electron/services/llm/prompts/__tests__/prompts.test.ts

Files modified:
- [x] electron/services/llm/tools/analyzeMessageTool.ts
- [x] electron/services/llm/tools/extractContactRolesTool.ts
- [x] electron/services/llm/tools/clusterTransactionsTool.ts

Features implemented:
- [x] Prompt templates extracted
- [x] Hash computation working
- [x] Tools use external prompts
- [x] Snapshot tests created (9 snapshots)
- [x] Generic PromptTemplate<TInput> interface for type safety

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (only pre-existing warnings)
- [x] npm test passes (53 prompt tests + 46 tool tests)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | 0K | 0 min |
| Implementation (Impl) | 4 | ~16K | ~20 min |
| Debugging (Debug) | 1 | ~4K | ~5 min |
| **Engineer Total** | 5 | ~20K | ~25 min |
```

### Notes

**Planning notes:**
Task file contained extremely detailed implementation spec with complete code templates
for all files, eliminating need for separate Plan agent invocation. Implementation
followed task file spec directly.

**Deviations from plan:**
DEVIATION: Modified PromptTemplate interface to use generics (PromptTemplate<TInput, TContext>)
instead of Record<string, unknown>. This was necessary because TypeScript strict mode
did not accept the type casting from specific input types to Record<string, unknown>.
The generic approach provides better type safety and cleaner code.

**Design decisions:**
1. Used generic PromptTemplate<TInput> for type-safe buildUserPrompt
2. Added 53 comprehensive tests including snapshot tests for prompts
3. Added promptVersion (hash) to analyzeMessageTool results for tracking

**Issues encountered:**
TypeScript strict mode errors when using Record<string, unknown> for input types.
Resolved by making PromptTemplate generic with type parameters.

**Reviewer notes:**
- Snapshot tests capture exact prompt content for change detection
- Hash is stable and 8-character hex format
- Tools now import prompts from external files, reducing inline code

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 5 | 6 | +1 | Added test file |
| Files to modify | 3 | 3 | 0 | Match |
| Code volume | ~300 lines | ~500 lines | +200 | Comprehensive tests added |
| Functions/handlers | 6 | 6 | 0 | Match |
| Core files touched | No | No | - | Match |
| New patterns | No | Yes (generic types) | - | Type safety improvement |
| Test complexity | Low | Low | - | Match |

**Total Variance:** Est 5-6 turns -> Actual 5 turns (within estimate)

**Root cause of variance:**
Estimate was accurate. Task file detailed spec eliminated planning overhead.
Minor debugging for TypeScript strict mode was within expected time.

**Suggestion for similar tasks:**
For tasks with detailed task file specs, 0 turns for planning is appropriate.
Consider adding +0.5 turns for TypeScript strict mode type fixes.

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
  - `electron/services/llm/prompts/__tests__/prompts.test.ts` (new)
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

*Review Date: 2025-12-18*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | 1 | ~2K | 2 min |
| Feedback/Revisions | 0 | 0 | 0 min |
| **SR Total** | 1 | ~2K | 2 min |
```

### Review Summary

**Architecture Compliance:** PASS
**Security Review:** N/A
**Test Coverage:** Adequate

**Review Notes:**
- Clean extraction of prompts to external template files
- Generic PromptTemplate<TInput, TContext> provides good type safety
- Hash computation is simple and adequate for versioning
- Snapshot tests capture prompt content for change detection
- Tools properly import and use external prompts
- promptVersion (hash) added to results for tracking
- CI transient failure (macOS network timeout) resolved on retry

### Merge Information

**PR Number:** #162
**Merge Commit:** ecc11bd
**Merged To:** int/ai-tools
