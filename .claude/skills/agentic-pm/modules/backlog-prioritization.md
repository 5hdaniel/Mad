# Module: Backlog Reprioritization (Merge-First)

## Objective

Reorder backlog items to maximize:
- Mergeability
- Risk reduction / enablement
- Incremental value

## Procedure

1) **Normalize backlog items** (ensure each has: ID, title, description).

2) **Tag each item** with:
   - `surface_area`: {low, medium, high}
   - `coupling_risk`: {low, medium, high}
   - `contract_touch`: {none, api, schema, shared-types, config}
   - `merge_conflict_likelihood`: {low, medium, high}
   - `dependency_hints`: {depends_on, conflicts_with}
   - `llm_complexity`: {trivial, simple, moderate, complex, very_complex}
   - `estimated_turns`: <number> (estimated LLM conversation turns to complete)
   - `estimated_tokens`: <number>K (estimated total tokens to complete task)

3) **Cluster items**:
   - "contract-first" items (schema/API/types)
   - "consumers" (UI/features relying on contracts)
   - "isolated" items (low coupling)

4) **Reprioritize** using rules:
   - Enablement first (unblocks others)
   - Contract-producers before consumers
   - High-coupling items only when phase-integrated

5) **Output**:
   - Reprioritized list (with rationale per item)
   - Identified conflicts and suggested clustering

## Output format

Markdown table:

| ID | Title | Priority | LLM Complexity | Est. Turns | Est. Tokens | Rationale | Dependencies | Conflicts |
|----|-------|----------|----------------|------------|-------------|-----------|--------------|-----------|
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

## LLM Complexity Guide

| Complexity | Description | Typical Turns | Typical Tokens |
|------------|-------------|---------------|----------------|
| trivial | Single file change, clear pattern | 1-3 | 5-15K |
| simple | Few files, well-defined scope | 3-8 | 15-40K |
| moderate | Multiple files, some exploration needed | 8-15 | 40-100K |
| complex | Cross-cutting changes, research required | 15-30 | 100-250K |
| very_complex | Architectural changes, multi-phase | 30+ | 250K+ |

**Definitions**:
- **Turns** = Full LLM request-response cycles (user message → assistant response)
- **Tokens** = Total input + output tokens consumed across all turns

## Token Estimation Factors

When estimating tokens, consider:

| Factor | Low Token Impact | High Token Impact |
|--------|------------------|-------------------|
| Code reading | 1-2 files, <200 lines | 10+ files, 1000+ lines |
| Code writing | Small edits | New files, extensive changes |
| Exploration | Known codebase | Unfamiliar codebase |
| Test writing | Updating existing | Writing from scratch |
| Debugging | Obvious fix | Investigation required |

**Token cost breakdown (typical)**:
- Reading a file: 500-2000 tokens per file (depends on size)
- Tool calls: ~100-300 tokens overhead each
- Code generation: ~1.5x the output length in tokens
- Planning/reasoning: 500-2000 tokens per turn

## Red flags

Stop and clarify if you observe:
- Two high-coupling tasks touching the same contract in parallel
- Tasks requiring refactors without explicit scope approval
- Circular dependencies
- Tasks without clear acceptance criteria
