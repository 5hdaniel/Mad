# Task TASK-XXX: <Title>

## Goal

<Clear, concise statement of what this task accomplishes. 1-2 sentences.>

## Non-Goals

<Explicitly list what this task does NOT do. Prevents scope creep.>

- Do NOT <thing 1>
- Do NOT <thing 2>
- Do NOT <thing 3>

## Deliverables

<List of files to create or modify>

1. New file: `<path/to/file.ts>`
2. Update: `<path/to/existing.ts>`

## Acceptance Criteria

<Checkboxes that must ALL be true for the task to be complete>

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] All CI checks pass

## Implementation Notes

<Detailed guidance on HOW to implement. Include code examples.>

### Key Patterns

```typescript
// Example code showing expected patterns
```

### Important Details

- Detail 1
- Detail 2

## Integration Notes

<How this task connects to other tasks/systems>

- Imports from: `<files>`
- Exports to: `<files>`
- Used by: `<tasks>`

## Do / Don't

### Do:
- <Positive guidance>
- <Positive guidance>

### Don't:
- <Negative guidance>
- <Negative guidance>

## When to Stop and Ask

<Conditions where the engineer should stop and ask the PM>

- If <condition 1>
- If <condition 2>
- If <condition 3>

## Testing Expectations

<What tests should be written or verified>

- Unit test: <description>
- Integration test: <description>

## PR Preparation

- **Title:** `feat(scope): <description>`
- **Labels:** `<label1>`, `<label2>`
- **Depends on:** TASK-XXX (if applicable)

---

## Implementation Summary (Engineer-Owned)

**⚠️ REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Checklist

```
Files created:
- [ ] <file 1>
- [ ] <file 2>

Features implemented:
- [ ] <feature 1>
- [ ] <feature 2>

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
```

### Notes

<REQUIRED: Document the following>

**Deviations from plan:**
<If you deviated from the plan, explain what and why. Use "⚠️ DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>
