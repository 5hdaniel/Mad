#!/bin/bash
# Type-Check After Edit Hook
# Runs tsc --noEmit after Write/Edit on .ts/.tsx files to catch type errors early.
# Only triggers on TypeScript files to avoid unnecessary checks on .md, .json, etc.

# Read hook input from stdin
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')

# Only check after Edit or Write
if [ "$TOOL_NAME" != "Edit" ] && [ "$TOOL_NAME" != "Write" ]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# Get the file path from tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')

# Only check TypeScript files
case "$FILE_PATH" in
  *.ts|*.tsx)
    ;;
  *)
    echo '{"decision": "allow"}'
    exit 0
    ;;
esac

# Run type check (capture first 15 lines of errors)
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(dirname "$0")/../.." 2>/dev/null
TSC_OUTPUT=$(npx tsc --noEmit --pretty 2>&1 | head -15)
TSC_EXIT=$?

if [ $TSC_EXIT -ne 0 ]; then
  # Escape the output for JSON
  ESCAPED=$(echo "$TSC_OUTPUT" | jq -Rs '.')
  echo "{\"decision\": \"allow\", \"message\": \"TYPE ERROR after editing $FILE_PATH:\\n$TSC_OUTPUT\"}"
  exit 0
fi

# No errors — allow silently
echo '{"decision": "allow"}'
exit 0
