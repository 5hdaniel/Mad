#!/bin/bash
# Pre-Merge Review Script (Headless Mode)
# Runs Claude non-interactively to review all changes between develop and HEAD.
# Usage: ./scripts/pre-merge-review.sh [base-branch]
# Output: review-YYYYMMDD-HHMMSS.md in project root

set -e

BASE_BRANCH="${1:-develop}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="review-${TIMESTAMP}.md"
BRANCH=$(git branch --show-current)

echo "Pre-merge review: ${BRANCH} → ${BASE_BRANCH}"
echo "Output: ${OUTPUT_FILE}"

# Verify we're not on the base branch
if [ "$BRANCH" = "$BASE_BRANCH" ]; then
  echo "ERROR: Already on ${BASE_BRANCH}. Switch to your feature branch first."
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "WARNING: You have uncommitted changes. They won't be included in the review."
fi

# Get the diff stats for context
DIFF_STATS=$(git diff "${BASE_BRANCH}...HEAD" --stat)
COMMIT_LOG=$(git log "${BASE_BRANCH}..HEAD" --oneline)
FILE_COUNT=$(git diff "${BASE_BRANCH}...HEAD" --name-only | wc -l | tr -d ' ')

echo "Files changed: ${FILE_COUNT}"
echo "Commits: $(echo "$COMMIT_LOG" | wc -l | tr -d ' ')"
echo ""
echo "Running Claude review..."

claude -p "Review all changes between ${BASE_BRANCH} and HEAD on branch ${BRANCH}.

Context:
- Files changed: ${FILE_COUNT}
- Diff stats:
${DIFF_STATS}

- Commits:
${COMMIT_LOG}

Check for:
1. TypeScript type safety — any \`any\` types, missing return types, unsafe casts
2. Missing error handling — unhandled promises, empty catch blocks
3. Console.log statements that should use logger instead
4. Security concerns — hardcoded secrets, SQL injection, XSS
5. Architecture violations — business logic in entry files, direct window.api calls
6. Correct branch targeting — PRs should target develop (not main)
7. React anti-patterns — missing deps in useEffect, missing ref guards on callbacks
8. Dead code — unused imports, unreachable code, commented-out blocks

For each issue found, provide:
- File path and line number
- Severity (blocker, warning, suggestion)
- What's wrong and how to fix it

Output a markdown summary with sections for each category. End with a PASS/FAIL verdict." \
  --allowedTools "Read,Grep,Glob,Bash" \
  --output-format text > "${OUTPUT_FILE}" 2>&1

echo ""
echo "Review complete: ${OUTPUT_FILE}"
echo "---"
head -20 "${OUTPUT_FILE}"
