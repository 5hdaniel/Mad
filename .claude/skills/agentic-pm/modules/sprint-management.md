# Module: Sprint Management

## Objective

Manage sprint lifecycle including:
- Creating new sprints with proper numbering
- Moving tasks between sprints
- Closing sprints and archiving
- Tracking sprint history

## Sprint Naming Convention

Sprints follow this naming pattern:

```
SPRINT-<NNN>-<slug>
```

Where:
- `<NNN>` = 3-digit sprint number (001, 002, 003...)
- `<slug>` = kebab-case short name

**Examples:**
- `SPRINT-001-onboarding-refactor`
- `SPRINT-002-tech-debt`
- `SPRINT-003-llm-integration`

## File Locations

| Artifact | Location | Pattern |
|----------|----------|---------|
| Sprint plan | `.claude/plans/sprints/` | `SPRINT-<NNN>-<slug>.md` |
| Task files | `.claude/plans/tasks/` | `TASK-<NNN>-<slug>.md` |
| Backlog items | `.claude/plans/backlog/` | `BACKLOG-<NNN>.md` |
| Backlog index | `.claude/plans/backlog/` | `INDEX.md` |
| Completed sprints | `.claude/plans/sprints/` | Keep in place, mark status |

## Procedures

### 1. Creating a New Sprint

1. **Get next sprint number:**
   ```bash
   ls .claude/plans/sprints/ | grep "^SPRINT-" | sort -r | head -1
   ```
   Increment the number.

2. **Create sprint file:**
   - Use template: `templates/sprint-plan.template.md`
   - Name: `SPRINT-<NNN>-<slug>.md`
   - Set status: `🔄 Active`

3. **Update backlog index:**
   - Assign backlog items to sprint
   - Update "Sprint" column in INDEX.md

4. **Create task files:**
   - One file per task in `.claude/plans/tasks/`
   - Reference backlog item and sprint

### 2. Moving Tasks Between Sprints

When a task needs to move to a different sprint:

1. **Update task file:**
   ```markdown
   **Sprint:** SPRINT-002 → SPRINT-003
   **Moved Reason:** [Brief explanation]
   **Moved Date:** YYYY-MM-DD
   ```

2. **Update source sprint:**
   - Remove task from task list
   - Add to "Deferred to Next Sprint" section

3. **Update target sprint:**
   - Add task to task list
   - Note it was moved from previous sprint

4. **Update backlog INDEX.md:**
   - Change Sprint column value

### 3. Closing a Sprint

When all tasks are complete or sprint ends:

1. **Update sprint status:**
   ```markdown
   **Status:** ✅ Completed
   **End Date:** YYYY-MM-DD
   ```

2. **Update each completed task:**
   - Mark status as completed
   - Add completion date

3. **Update backlog items:**
   - Mark resolved items as ✅ Completed
   - Update INDEX.md with completion dates

4. **Create retrospective section:**
   ```markdown
   ## Retrospective

   ### What Went Well
   - ...

   ### What Could Improve
   - ...

   ### Action Items for Next Sprint
   - ...
   ```

5. **Update INDEX.md sprint history:**
   - Add to Sprint History table
   - Update counts

### 4. Sprint Rollover

When tasks don't complete in a sprint:

1. **In closing sprint:**
   ```markdown
   ## Incomplete Tasks (Rolled to SPRINT-XXX)

   | Task ID | Title | Reason | New Sprint |
   |---------|-------|--------|------------|
   | TASK-XXX | ... | Blocked by... | SPRINT-YYY |
   ```

2. **In new sprint:**
   - Include rolled tasks in task list
   - Mark as "Rolled from SPRINT-XXX"

3. **Update backlog:**
   - Change sprint assignment
   - Keep original dates

## Sprint Status Values

| Status | Meaning |
|--------|---------|
| 📋 Planning | Sprint being planned, not started |
| 🔄 Active | Sprint in progress |
| ✅ Completed | All tasks done, sprint closed |
| ⏸️ Paused | Sprint suspended (unusual) |
| ❌ Cancelled | Sprint abandoned (unusual) |

## Integration with Backlog

When assigning backlog items to a sprint:

1. Update backlog item file:
   ```markdown
   | **Sprint** | SPRINT-002 |
   ```

2. Update INDEX.md:
   - Set Sprint column
   - Status becomes "Assigned" or stays "Pending"

3. Create task files:
   - Reference backlog ID
   - May split one backlog item into multiple tasks

## Template: Sprint Summary for INDEX.md

```markdown
| Sprint ID | Name | Status | Items Completed |
|-----------|------|--------|-----------------|
| SPRINT-001 | Onboarding Refactor | ✅ Completed | 16 tasks |
| SPRINT-002 | Tech Debt | 🔄 Active | 12 tasks planned |
```

## Red Flags

Stop and ask if:
- Sprint has >20 tasks (too large)
- Task appears in multiple sprints
- Sprint has no defined end criteria
- Moving >50% of tasks to next sprint (scope was wrong)
