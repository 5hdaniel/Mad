# Task TASK-319: Prompt Versioning Service

## Goal

Create a service that manages prompt version tracking, providing access to current prompt versions and recording which version was used for each LLM result. This enables A/B testing and rollback capabilities.

## Non-Goals

- Do NOT modify the prompt templates themselves (TASK-318)
- Do NOT implement database storage for version history (future task)
- Do NOT add IPC handlers or UI components
- Do NOT change the tool interfaces

## Deliverables

1. New file: `electron/services/llm/promptVersionService.ts`
2. New file: `electron/services/llm/__tests__/promptVersionService.test.ts`
3. Update file: `electron/services/llm/prompts/index.ts` (export service)

## Acceptance Criteria

- [x] `getCurrentVersion(promptName)` returns PromptVersion for named prompt
- [x] `getAllVersions()` returns all registered prompt versions
- [x] `getPromptNames()` returns list of prompt names (was getPromptByName in spec)
- [x] Service is a singleton for consistent access
- [x] Service uses prompts from TASK-318 prompt templates
- [x] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/services/llm/promptVersionService.ts
import { PromptMetadata, ALL_PROMPTS } from './prompts';

export interface PromptVersion {
  name: string;
  version: string;
  hash: string;
}

export class PromptVersionService {
  private static instance: PromptVersionService;
  private promptMap: Map<string, PromptMetadata>;

  private constructor() {
    this.promptMap = new Map();
    ALL_PROMPTS.forEach(p => this.promptMap.set(p.name, p));
  }

  static getInstance(): PromptVersionService {
    if (!PromptVersionService.instance) {
      PromptVersionService.instance = new PromptVersionService();
    }
    return PromptVersionService.instance;
  }

  getCurrentVersion(promptName: string): PromptVersion | undefined {
    const meta = this.promptMap.get(promptName);
    if (!meta) return undefined;
    return {
      name: meta.name,
      version: meta.version,
      hash: meta.hash,
    };
  }

  getAllVersions(): PromptVersion[] {
    return ALL_PROMPTS.map(p => ({
      name: p.name,
      version: p.version,
      hash: p.hash,
    }));
  }

  getPromptNames(): string[] {
    return Array.from(this.promptMap.keys());
  }
}
```

### Important Details

- Service is singleton - consistent across app
- Uses ALL_PROMPTS from TASK-318 prompts index
- No persistence yet - versions come from code
- Future enhancement: database storage for usage tracking

## Integration Notes

- Imports from: `electron/services/llm/prompts/index.ts`
- Exports to: `electron/services/extraction/hybridExtractorService.ts` (TASK-320)
- Used by: TASK-320 (Hybrid Extractor Service)
- Depends on: TASK-318 (prompt templates must exist)

## Do / Don't

### Do:
- Use singleton pattern for consistent access
- Derive versions from prompt templates
- Export both class and convenience function
- Keep interface simple

### Don't:
- Store usage data in memory (use database in future task)
- Modify prompt templates from this service
- Add complex version comparison logic
- Block on missing prompts (return undefined)

## When to Stop and Ask

- If ALL_PROMPTS is not exported from prompts/index.ts
- If PromptMetadata interface differs from expected
- If you need to persist version history to database

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `promptVersionService.test.ts`:
    - Test singleton returns same instance
    - Test getCurrentVersion for existing prompt
    - Test getCurrentVersion for non-existent prompt
    - Test getAllVersions returns all prompts
    - Test getPromptNames returns all names

### Coverage

- Coverage impact:
  - Target 90%+ for this simple service

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(llm): add prompt versioning service [TASK-319]`
- **Labels**: `llm`, `ai-mvp`, `phase-1`
- **Depends on**: TASK-318 (must be merged first)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Estimated Totals:**
- **Turns:** 3-4
- **Tokens:** ~10K-15K
- **Time:** ~15-20m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 2 new files (service + test) | +1 |
| Files to modify | 1 file (prompts index) | +0.5 |
| Code volume | ~80 lines | +0.5 |
| Functions/handlers | 4 methods | +0.5 |
| Core files touched | No | +0 |
| New patterns | Singleton pattern (common) | +0 |
| Test complexity | Low | +1 |
| Dependencies | 0 new dependencies | +0 |

**Confidence:** High

**Risk factors:**
- None significant - simple service

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: 2025-12-18*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (from task file detailed notes)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 0 | ~0K | 0 min |
| Revision(s) | 0 | ~0K | 0 min |
| **Plan Total** | 0 | ~0K | 0 min |

Note: Task file provided complete implementation details including code structure,
so no separate Plan agent invocation was needed.
```

### Checklist

```
Files created:
- [x] electron/services/llm/promptVersionService.ts
- [x] electron/services/llm/__tests__/promptVersionService.test.ts

Files modified:
- [x] electron/services/llm/prompts/index.ts (export service)

Features implemented:
- [x] Singleton pattern
- [x] getCurrentVersion()
- [x] getAllVersions()
- [x] getPromptNames()
- [x] hasPrompt() (bonus utility method)
- [x] getPromptCount() (bonus utility method)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (31 tests for promptVersionService)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | ~0K | 0 min |
| Implementation (Impl) | 3 | ~12K | 10 min |
| Debugging (Debug) | 1 | ~4K | 2 min |
| **Engineer Total** | 4 | ~16K | 12 min |
```

### Notes

**Planning notes:**
Task file provided complete implementation details including code structure,
method signatures, and test requirements. No additional planning needed.

**Deviations from plan:**
- Added two bonus utility methods: `hasPrompt()` and `getPromptCount()`
- Added `resetInstance()` for test isolation
- Used `export type` syntax for PromptVersion to comply with isolatedModules

**Design decisions:**
- Added resetInstance() static method to allow test isolation
- Included convenience function getPromptVersionService() as re-exported wrapper
- Added hasPrompt() and getPromptCount() for better API usability

**Issues encountered:**
- TypeScript isolatedModules error: Required using `export type { PromptVersion }`
  instead of regular export. Fixed in prompts/index.ts.

**Reviewer notes:**
- All 31 unit tests pass with comprehensive coverage
- Service follows singleton pattern exactly as specified
- Pre-existing flaky test in appleDriverService.test.ts (unrelated to changes)

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 2 | 2 | 0 | As expected |
| Files to modify | 1 | 1 | 0 | As expected |
| Code volume | ~80 lines | ~110 service + ~280 tests | +30 lines | Added bonus methods |

**Total Variance:** Est 3-4 turns -> Actual 4 turns (0% over)

**Root cause of variance:**
On target. Task file was well-specified with complete implementation details.

**Suggestion for similar tasks:**
Detailed task files with code examples significantly reduce implementation time.

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/ai-tools (after TASK-318 merged)
- **Branch Into:** int/ai-tools
- **Suggested Branch Name:** feature/TASK-319-prompt-versioning-service

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-318 (must be merged first)
- **Blocks:** TASK-320 (hybrid extractor)

### Shared File Analysis
- Files created:
  - `electron/services/llm/promptVersionService.ts` (new)
  - `electron/services/llm/__tests__/promptVersionService.test.ts` (new)
- Files modified:
  - `electron/services/llm/prompts/index.ts` (export service)
- Conflicts with: None
- **Resolution:** Sequential after TASK-318

### Technical Considerations
- Simple singleton wrapper around existing prompt metadata
- No database persistence yet
- Prepares for future usage tracking
- Low risk - read-only access to existing data

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
