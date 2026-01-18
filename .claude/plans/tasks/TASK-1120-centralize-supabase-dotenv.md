# TASK-1120: Centralize dotenv.config() in supabaseService.ts

**Backlog ID:** BACKLOG-303
**Sprint:** Standalone (mini-sprint)
**Branch:** `fix/task-1120-supabase-dotenv`
**Estimated Tokens:** ~3K
**Estimated Turns:** 3-5

---

## Objective

Remove the redundant `dotenv` import and `dotenv.config()` call from `supabaseService.ts`, relying on the centralized environment loading in `main.ts`.

---

## Context

### Current State

In `electron/services/supabaseService.ts` (lines 12-14):
```typescript
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.development" });
```

This is redundant because `main.ts` already loads environment variables centrally at startup.

### Why This Matters

- **Consistency**: Other services (after TASK-1118) rely on centralized dotenv loading
- **Maintainability**: Single source of truth for env loading
- **Predictability**: No race conditions or ordering issues with multiple dotenv calls

### Related Task

This is identical in pattern to TASK-1118 (googleAuthService.ts) which centralized dotenv loading. Follow the same approach.

---

## Requirements

### Must Do:
1. Remove `import * as dotenv from "dotenv";` from supabaseService.ts
2. Remove `dotenv.config({ path: ".env.development" });` from supabaseService.ts
3. Verify `main.ts` already loads `.env.development` (should be done from TASK-1118)
4. Verify Supabase connection still works after changes

### Must NOT Do:
- Break Supabase connectivity
- Modify any Supabase logic
- Add new dependencies
- Create complex abstractions

---

## Acceptance Criteria

- [ ] `import * as dotenv from "dotenv";` removed from supabaseService.ts
- [ ] `dotenv.config({ path: ".env.development" });` removed from supabaseService.ts
- [ ] `main.ts` loads `.env.development` centrally (verify, should already be true)
- [ ] Supabase service initializes correctly (process.env.SUPABASE_URL available)
- [ ] All CI tests pass

---

## Files to Modify

- `electron/services/supabaseService.ts` - Remove dotenv import and config call (lines 12-14)

## Files to Read (for context)

- `electron/main.ts` - Verify dotenv is loaded centrally (should have `dotenv.config` calls)

---

## Testing Expectations

### Unit Tests
- **Required:** Existing supabaseService tests should pass unchanged
- **New tests to write:** None - this is a simple refactor

### Manual Testing Required
1. **App Startup:**
   - Start app with `npm run dev`
   - Verify no Supabase initialization errors in console
   - Verify user sync works (if logged in)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(supabase): centralize dotenv loading in main.ts`
- **Branch:** `fix/task-1120-supabase-dotenv`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: [DATE]*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: [agent_id from Task tool output]
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

PHASE 1: PLANNING (Track: ___ turns)
- [ ] Read and understood task requirements
- [ ] Explored relevant codebase files
- [ ] Invoked Plan agent with task context
- [ ] Plan approved (or revised and re-approved)
- [ ] [PHASE: PLANNING END - X turns]

PHASE 2: IMPLEMENTATION (Track: ___ turns)
- [ ] Code complete (following approved plan)
- [ ] All changes align with plan
- [ ] [PHASE: IMPLEMENTATION END - Y turns]

PHASE 3: TESTING (Track: ___ turns)
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Any fixes applied
- [ ] [PHASE: TESTING END - Z turns]

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Three-Phase Metrics

Track each phase separately to identify where tokens are spent:

| Phase | Turns | Key Activities | Notes |
|-------|-------|----------------|-------|
| **Planning** | | Read task, verify main.ts, create plan | |
| **Implementation** | | Remove 2 lines from supabaseService.ts | |
| **Testing** | | Run tests, type-check, lint | |
| **TOTAL** | | | |

### Total Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | |
| Duration | seconds |
| API Calls | |

**Variance:** PM Est ~3K vs Actual ~XK (X% over/under)

### Phase Analysis

| Phase | % of Total | Expected % | Analysis |
|-------|------------|------------|----------|
| Planning | % | 20-30% | |
| Implementation | % | 40-50% | |
| Testing | % | 20-30% | |

### Notes

**Deviations from plan:** [explain any changes from approved plan]

**Issues encountered:** [document challenges, blockers, unexpected complexity]

---

## Guardrails

**STOP and ask PM if:**
- Supabase service fails to initialize after changes
- `main.ts` doesn't already have centralized dotenv loading
- You discover other services with the same pattern
- Any unexpected issues arise

---

## Technical Notes

### Implementation Steps

1. Open `electron/services/supabaseService.ts`
2. Remove line 12: `import * as dotenv from "dotenv";`
3. Remove line 14: `dotenv.config({ path: ".env.development" });`
4. Verify `electron/main.ts` has dotenv loading (should be at top of file)
5. Run tests to verify nothing broke

### Expected Code Change

**Before:**
```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { User, SubscriptionTier, Subscription } from "../types/models";
import type { AuditLogEntry } from "./auditService";
import logService from "./logService";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.development" });
```

**After:**
```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { User, SubscriptionTier, Subscription } from "../types/models";
import type { AuditLogEntry } from "./auditService";
import logService from "./logService";
```

This is a minimal, safe change. The service will continue to work because `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_KEY` are loaded by `main.ts` before any service is imported.
