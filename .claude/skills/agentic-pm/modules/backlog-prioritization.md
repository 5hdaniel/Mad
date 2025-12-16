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

| ID | Title | Priority | LLM Complexity | Est. Turns | Rationale | Dependencies | Conflicts |
|----|-------|----------|----------------|------------|-----------|--------------|-----------|
| ... | ... | ... | ... | ... | ... | ... | ... |

## LLM Complexity Guide

| Complexity | Description | Typical Turns |
|------------|-------------|---------------|
| trivial | Single file change, clear pattern | 1-3 |
| simple | Few files, well-defined scope | 3-8 |
| moderate | Multiple files, some exploration needed | 8-15 |
| complex | Cross-cutting changes, research required | 15-30 |
| very_complex | Architectural changes, multi-phase | 30+ |

**Note**: "Turns" = full LLM request-response cycles, not token count.

## Red flags

Stop and clarify if you observe:
- Two high-coupling tasks touching the same contract in parallel
- Tasks requiring refactors without explicit scope approval
- Circular dependencies
- Tasks without clear acceptance criteria
