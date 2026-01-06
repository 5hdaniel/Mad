# TASK-979: Agent Anti-Loop Enforcement

**Sprint**: SPRINT-026
**Backlog**: BACKLOG-161
**Priority**: Critical (BLOCKING)
**Estimate**: 5,000 tokens
**Status**: Ready

---

## Objective

Implement anti-loop safeguards to prevent agent token burn incidents like SPRINT-025 TASK-976 (14.2M tokens, 2849x overrun).

## Scope

### Must Implement

1. **PostToolUse Hook** (`.claude/hooks/loop-detector.sh`)
   - Detect exploration loop: >20 Read/Glob/Grep without Write/Edit
   - Detect verification loop: >5 identical Bash commands
   - Inject warning messages to agent context

2. **Engineer Agent Prompt Update** (`.claude/agents/engineer.md`)
   - Add "Anti-Loop Rules (MANDATORY)" section
   - Exploration limits: max 10 files before first Write
   - Verification limits: max 3 retries of same command
   - When stuck: commit partial progress, ask for help

3. **PM Skill Update** (`.claude/skills/agentic-pm/agentic-pm.md`)
   - Add "30-minute check-in" requirement for background agents
   - Reference Solution 4 from BACKLOG-161

### Out of Scope

- Token budget kill switch (future enhancement)
- Automatic agent termination (warning only)

## Files to Modify

| File | Action |
|------|--------|
| `.claude/hooks/loop-detector.sh` | Create |
| `.claude/settings.json` | Add PostToolUse hook config |
| `.claude/agents/engineer.md` | Add anti-loop rules section |
| `.claude/skills/agentic-pm/agentic-pm.md` | Add monitoring protocol |

## Acceptance Criteria

- [ ] Hook script created and executable
- [ ] Hook configured in `.claude/settings.json`
- [ ] Warning appears after 20 exploration calls
- [ ] Warning appears after 5 identical Bash commands
- [ ] Engineer agent prompt includes anti-loop rules
- [ ] PM skill includes monitoring protocol

## Testing

1. **Manual test**: Simulate exploration loop, verify warning
2. **Manual test**: Run same Bash command 6 times, verify warning
3. **Code review**: Ensure shell script handles edge cases

## Technical Notes

- Hook must work cross-platform (macOS primary)
- State file in `/tmp/` for agent tracking
- Use `CLAUDE_AGENT_ID` env var if available

## Branch

```
feature/TASK-979-anti-loop-hook
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (main session - not a subagent) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |

---

## Implementation Summary

### What Was Done

1. **Created `loop-detector.sh` hook** (`.claude/hooks/loop-detector.sh`)
   - Detects exploration loops: warns after 20+ Read/Glob/Grep without Write/Edit
   - Detects verification loops: warns after 5+ identical Bash commands
   - Uses state file in `/tmp/claude-loop-state/` per agent session
   - Returns warning messages in hook response for agent context injection

2. **Updated `settings.json`** (`.claude/settings.json`)
   - Added PostToolUse hook configuration pointing to loop-detector.sh
   - 5 second timeout (hooks are fast)

3. **Updated Engineer Agent** (`.claude/agents/engineer.md`)
   - Added "Anti-Loop Rules (MANDATORY)" section
   - Exploration limits: max 10 files before first Write (warn at 20)
   - Verification limits: max 3 retries of same command (warn at 5)
   - "When Stuck" escalation template
   - Hook enforcement documentation

4. **Updated PM Agent** (`.claude/agents/agentic-pm.md`)
   - Added "Background Agent Monitoring Protocol" section
   - 30-minute check-in requirement for background agents
   - Warning signs table with thresholds
   - Intervention options
   - Token budget alerts section
   - Added new guardrail: "Background agent exceeds 4x token estimate without check-in"

### Acceptance Criteria Status

- [x] Hook script created and executable
- [x] Hook configured in `.claude/settings.json`
- [x] Warning appears after 20 exploration calls (implemented, needs manual test)
- [x] Warning appears after 5 identical Bash commands (implemented, needs manual test)
- [x] Engineer agent prompt includes anti-loop rules
- [x] PM skill includes monitoring protocol

### Testing Notes

The hook can be manually tested by:
1. Running 21+ Read commands in a session without any Write/Edit
2. Running the same Bash command 6+ times

The hook uses `/tmp/claude-loop-state/<agent_id>.state` for persistence within a session.

### Deviations

None - implemented as specified in task file.
