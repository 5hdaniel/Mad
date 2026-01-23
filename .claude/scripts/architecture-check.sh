#!/bin/bash
# Architecture check script for Fix Agent
# Run before committing fixes to ensure architecture boundaries are respected

set -e

echo "Running architecture checks..."

# Entry file protection
ENTRY_FILES="src/App.tsx electron/main.ts electron/preload.ts"
BLOCKED=false

for file in $ENTRY_FILES; do
  if git diff --cached --name-only 2>/dev/null | grep -q "$file"; then
    echo "BLOCKED: Entry file modified: $file"
    echo "   Entry file changes require SR Engineer review"
    BLOCKED=true
  fi
done

if [ "$BLOCKED" = true ]; then
  exit 1
fi

# Line budget check for modified files
check_line_budget() {
  local file=$1
  local budget=$2
  if [ -f "$file" ]; then
    local lines=$(wc -l < "$file" | tr -d ' ')
    if [ "$lines" -gt "$budget" ]; then
      echo "WARNING: $file exceeds line budget ($lines > $budget)"
      return 1
    fi
  fi
  return 0
}

# Check budgeted files if they exist and are modified
WARNINGS=0

if git diff --cached --name-only 2>/dev/null | grep -q "App.tsx"; then
  check_line_budget "src/App.tsx" 100 || ((WARNINGS++))
fi

if git diff --cached --name-only 2>/dev/null | grep -q "AppShell.tsx"; then
  check_line_budget "src/renderer/components/AppShell.tsx" 200 || ((WARNINGS++))
fi

if git diff --cached --name-only 2>/dev/null | grep -q "AppRouter.tsx"; then
  check_line_budget "src/renderer/components/AppRouter.tsx" 300 || ((WARNINGS++))
fi

# IPC boundary check - no direct window.api in components
if git diff --cached 2>/dev/null | grep -E "window\.(api|electron)" | grep -v "// allowed-direct-api" | grep -q .; then
  echo "WARNING: Direct window.api usage detected"
  echo "   Consider using service abstraction"
  ((WARNINGS++))
fi

# Count files changed
FILE_COUNT=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
if [ "$FILE_COUNT" -gt 5 ]; then
  echo "WARNING: More than 5 files modified ($FILE_COUNT files)"
  echo "   Fix agent should modify max 5 files. Consider escalating."
  ((WARNINGS++))
fi

# Count lines changed
LINE_COUNT=$(git diff --cached --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertion|[0-9]+ deletion' | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || echo "0")
if [ "$LINE_COUNT" -gt 50 ]; then
  echo "WARNING: More than 50 lines changed ($LINE_COUNT lines)"
  echo "   Fix agent should change max 50 lines. Consider escalating."
  ((WARNINGS++))
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo ""
  echo "$WARNINGS warning(s) found. Review before proceeding."
else
  echo "All architecture checks passed"
fi

exit 0
