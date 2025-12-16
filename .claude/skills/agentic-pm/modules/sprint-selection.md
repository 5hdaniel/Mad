# Module: Sprint Selection + Phase Planning

## Objective

Select a subset of backlog items that form a coherent increment and can be integrated safely.

## Rules

- Do not schedule conflicting tasks in parallel unless you introduce:
  - Explicit integration branch(es)
  - Explicit merge order
  - Contract ownership assignment

## Phase design

Each phase must include:
- Tasks runnable in parallel
- Tasks that must be sequenced
- Integration checkpoint definition

## Phase structure template

```
Phase N: <Name>
├── Parallel tasks: [TASK-X, TASK-Y]
├── Sequential tasks: TASK-Z (after TASK-X completes)
├── Integration checkpoint: <what merges where>
└── CI gate: <what must pass>
```

## Required outputs

1) **Sprint narrative** - What we're trying to accomplish
2) **Included/excluded items** - What's in scope and what's deferred
3) **Phase plan** - How work is organized across phases
4) **Merge plan outline** - Branch strategy and integration order
5) **Risks + mitigations** - What could go wrong and how we handle it

## Integration checkpoint requirements

Each phase must end with:
- All phase tasks merged to integration branch
- CI passing on integration branch
- No unresolved conflicts
- Contract compatibility verified

## LLM Capacity Guidelines

When planning phases for agentic engineers (LLM instances):

### Parallelism limits
- **Per-phase**: 3-5 parallel tasks max per LLM instance
- **Complexity budget**: ~50-80 turns total per phase (sum of all tasks)
- **Context management**: Tasks sharing contracts should be sequential to avoid drift

### Capacity planning
| Phase Complexity | Max Parallel Tasks | Typical Turn Budget |
|------------------|-------------------|---------------------|
| Light | 5 | 30-50 turns |
| Moderate | 3-4 | 50-80 turns |
| Heavy | 2-3 | 80-120 turns |

### Buffer allocation
- Include 20% buffer for unforeseen complexity
- Add explicit "integration verification" turn budget per phase
- Complex tasks may need human review checkpoints

### Red flags (capacity)
- Phase with total estimated turns > 100 without checkpoint
- Single task estimated at > 40 turns without breakdown
- All "complex" or "very_complex" tasks in same phase

## Red flags (general)

- Phase with >5 parallel tasks touching shared code
- Phase without explicit integration checkpoint
- Tasks spanning multiple phases without clear handoff
