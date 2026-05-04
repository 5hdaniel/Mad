---
name: fix-deeplink
description: Fix the keepr:// deep link protocol registration so OAuth login works in dev mode. Run this when login fails with "Deep link auth error" or "Deep link callback timeout".
user_invocable: true
---

# Fix Deep Link Protocol Registration

Fixes the `keepr://` OAuth callback not routing to the dev Electron app. This is a common issue caused by:
1. Installed Keepr.app at /Applications intercepting the protocol
2. Git worktrees with node_modules/electron registering competing handlers
3. Stale Launch Services cache remembering old bindings

## Steps

1. Kill any running Keepr/Electron instances
2. Check for and handle /Applications/Keepr*.app (rename or delete per user preference)
3. Clean up finished git worktrees that may have competing Electron registrations
4. Reset the macOS Launch Services cache
5. Wait 3 seconds for cache to rebuild
6. Restart the dev server

## Commands

```bash
# Step 1: Kill running instances
pkill -f "electron" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Step 2: Check for installed app
KEEPR_APPS=$(ls /Applications/ 2>/dev/null | grep -i keepr)
if [ -n "$KEEPR_APPS" ]; then
  echo "Found installed Keepr apps in /Applications:"
  echo "$KEEPR_APPS"
  echo "Renaming to prevent protocol conflict..."
  for app in /Applications/Keepr*.app; do
    [ -e "$app" ] && mv "$app" "${app%.app}-disabled.app" 2>/dev/null && echo "  Renamed: $app"
  done
fi

# Step 3: Clean up stale worktrees
echo "Checking worktrees..."
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd /Users/daniel/Documents/Mad
STALE_WORKTREES=$(git worktree list | grep -v "$(pwd)" | grep -v "\[develop\]" | awk '{print $1}')
if [ -n "$STALE_WORKTREES" ]; then
  echo "Found worktrees that may conflict:"
  echo "$STALE_WORKTREES"
  echo "Run 'git worktree remove <path> --force' for completed ones"
fi
git worktree prune

# Step 4: Reset Launch Services
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user

# Step 5: Wait
echo "Waiting 3 seconds for cache rebuild..."
sleep 3

# Step 6: Restart dev
echo "Ready — run 'npm run dev' to start the app"
```

## Verification

After running, verify the dev app owns the protocol:
```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -dump | grep -i keepr | grep -i bindings
```
