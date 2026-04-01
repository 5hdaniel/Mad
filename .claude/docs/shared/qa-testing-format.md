# QA Testing Format

## Auto-Setup (MANDATORY)

Before presenting test cases, QA agent MUST handle environment setup:

1. Check current branch: `git branch --show-current`
2. If not on the correct branch: checkout + pull
3. Deploy or start dev server as appropriate
4. Only then present the first test

Do NOT ask the user to run setup commands manually.

## Interactive Question Format (MANDATORY)

Present each test case using the `AskUserQuestion` tool with Pass/Fail/Partial options.

**Format:**
```
AskUserQuestion:
  question: "TEST-XXX: [Navigate to URL] — [What to check]?"
  header: "Short Label"  (max 12 chars)
  options:
    - Pass: "Feature works as expected"
    - Fail: "Feature is broken or missing"
    - Partial: "Feature exists but has issues"
```

**Rules:**
- One test at a time — wait for user response before next test
- Include the URL to navigate to in the question
- Be specific about what to check
- Record results as you go
- If user selects "Fail" or "Partial", ask for details before moving on

## After All Tests

Summarize results:
- Total pass/fail/partial counts
- List any failures with user comments
- Create backlog items for failures if needed
