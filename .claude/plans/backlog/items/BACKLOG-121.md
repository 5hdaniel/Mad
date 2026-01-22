# BACKLOG-121: Add Generator Approach Guidance for Large Fixture Tasks

**Priority:** High
**Category:** docs
**Created:** 2025-12-31
**Source:** SPRINT-011 Retrospective

---

## Problem Statement

During SPRINT-011, TASK-801 (iOS fixtures with 200+ messages) hit the 32K output token limit when the engineer attempted to directly output a large JSON file. This caused the task to stall and required a workaround.

## Proposed Solution

Update PM documentation and task file templates to include explicit guidance for tasks that involve creating large data fixtures (>50 items):

1. **Default to generator approach** - Create a TypeScript generator script that programmatically builds the data
2. **Run the generator** - Execute with `npx ts-node` to create the JSON file
3. **Delete the generator** - Remove temporary script after generation (or keep if useful for regeneration)

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/task-file-authoring.md` - Add large fixture guidance
2. Update: `.claude/docs/shared/plan-first-protocol.md` - Add fixture task considerations
3. New: `.claude/docs/shared/large-fixture-generation.md` - Detailed guidance document

## Acceptance Criteria

- [ ] Task authoring module includes warning for fixture tasks >50 items
- [ ] Generator approach is documented with code examples
- [ ] Token limit (32K) is explicitly mentioned as constraint
- [ ] Examples from TASK-801 included as reference

## Implementation Notes

### Generator Script Pattern

```typescript
// generateFixtures.ts (temporary)
import * as fs from 'fs';

const messages = [];
for (let i = 0; i < 200; i++) {
  messages.push({
    id: i + 1,
    text: `Message ${i + 1}...`,
    // ... build programmatically
  });
}

fs.writeFileSync('messages.json', JSON.stringify({ messages }, null, 2));
console.log(`Generated ${messages.length} messages`);
```

### When to Use Generator Approach

| Fixture Size | Approach |
|--------------|----------|
| <20 items | Direct Write tool |
| 20-50 items | Consider generator |
| >50 items | **Require generator** |

## Estimated Effort

- **Turns:** 2-3
- **Tokens:** ~10K
- **Time:** 20-30m

---

## References

- TASK-801 implementation (SPRINT-011)
- Error: "Claude's response exceeded the 32000 output token maximum"
