# Large Fixture Generation

**Purpose:** Prevent 32K output token limit errors when creating large data fixtures.

---

## The Problem

Claude's Write tool has a 32,000 token output limit. A JSON file with 200+ items
easily exceeds this limit, causing the task to stall.

**Example:** TASK-801 (SPRINT-011) attempted to output 203 messages directly,
hit the limit, and required a workaround.

---

## The Solution: Generator Scripts

Instead of writing the full JSON, create a TypeScript generator script:

### Generator Pattern

```typescript
// scripts/generateFixtures.ts (temporary)
import * as fs from 'fs';

interface Message {
  id: number;
  text: string;
  timestamp: string;
}

const messages: Message[] = [];
for (let i = 0; i < 200; i++) {
  messages.push({
    id: i + 1,
    text: `Sample message ${i + 1} with content...`,
    timestamp: new Date(2024, 0, i % 28 + 1).toISOString(),
  });
}

fs.writeFileSync(
  'src/__fixtures__/messages.json',
  JSON.stringify({ messages }, null, 2)
);

console.log(`Generated ${messages.length} messages`);
```

### Execution

```bash
npx ts-node scripts/generateFixtures.ts
# OR
npx tsx scripts/generateFixtures.ts
```

### Cleanup

After generation, delete the script (unless it's useful for regeneration):

```bash
rm scripts/generateFixtures.ts
git add src/__fixtures__/messages.json
```

---

## When to Use Generator Approach

| Fixture Size | Approach | Rationale |
|--------------|----------|-----------|
| <20 items | Direct Write | Small enough for Write tool |
| 20-50 items | Consider generator | Approaching limit, use judgment |
| >50 items | **REQUIRE generator** | Will likely exceed 32K tokens |

---

## Generator Benefits

1. **No token limit issues** - Script runs outside Claude
2. **Reproducible** - Can regenerate with different params
3. **Programmatic variation** - Loops, random data, patterns
4. **Type-safe** - TypeScript catches errors before generation

---

## Warning Signs (PM/Engineer)

- Task mentions "200+ items" or similar
- Fixture needs realistic variation across many records
- Previous attempt hit token limit
- Task is for testing infrastructure (often needs large datasets)

---

## Related

- **TASK-801:** Original incident (SPRINT-011)
- **Token limit:** 32,000 output tokens max
- **Backlog:** BACKLOG-121 (source of this guidance)
