#!/usr/bin/env node
/**
 * Task Workflow Reminder Hook
 *
 * This hook runs on UserPromptSubmit and checks if the user is about to
 * work on a TASK file. If so, it blocks the action and reminds them to
 * use the proper agent workflow.
 *
 * IMPORTANT: Tasks from .claude/plans/tasks/ must be implemented via:
 * 1. Engineer agent (subagent_type="engineer")
 * 2. SR Engineer agent for PR review (subagent_type="senior-engineer-pr-lead")
 */

const fs = require('fs');

// Read stdin
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').toLowerCase();

    // Patterns that indicate working on a TASK file
    const taskPatterns = [
      '.claude/plans/tasks',
      'task-5',  // TASK-5XX pattern
      'task-4',  // TASK-4XX pattern
      'task-3',  // TASK-3XX pattern
      'implement task',
      'work on task',
      'continue with task',
      'complete task',
      'finish task',
    ];

    // Check if any pattern matches
    const matchedPattern = taskPatterns.find(pattern => prompt.includes(pattern));

    if (matchedPattern) {
      // Check if they're already using the correct workflow
      const correctWorkflowPatterns = [
        'engineer agent',
        'subagent_type',
        'senior-engineer',
        'sr engineer',
        'invoke.*engineer',
        'task tool.*engineer',
      ];

      const usingCorrectWorkflow = correctWorkflowPatterns.some(pattern =>
        new RegExp(pattern, 'i').test(prompt)
      );

      if (!usingCorrectWorkflow) {
        // Block and remind
        const response = {
          decision: "block",
          reason: `WORKFLOW REMINDER

You're about to work on a TASK file directly. This is not allowed.

REQUIRED WORKFLOW:
1. Use the 'engineer' agent to implement tasks:
   - Invoke Task tool with subagent_type="engineer"
   - Pass the task file path

2. Use the 'senior-engineer-pr-lead' agent for PR review:
   - Invoke Task tool with subagent_type="senior-engineer-pr-lead"
   - Get approval before merging

See CLAUDE.md "MANDATORY: Agent Workflow for Sprint Tasks" section.

Matched pattern: "${matchedPattern}"`
        };

        console.log(JSON.stringify(response));
        process.exit(0);
      }
    }

    // Allow the action
    process.exit(0);

  } catch (error) {
    // On error, allow the action (fail open)
    console.error('Hook error:', error.message);
    process.exit(0);
  }
});
