#!/bin/bash
#
# Keepr Cleanup Script for macOS
# Removes all app data, caches, and keychain entries
# Also removes legacy MagicAudit paths for users upgrading from older versions
#
# Usage: Double-click this file or run: ./cleanup-macos.sh
#

echo "=========================================="
echo "  Keepr Cleanup Tool"
echo "=========================================="
echo ""

# Kill any running app FIRST
echo "Stopping Keepr if running..."
pkill -f "Keepr" 2>/dev/null || true
pkill -f "MagicAudit" 2>/dev/null || true
sleep 1

# Delete all app data folders (current + legacy paths)
echo "Removing application data..."
rm -rf ~/Library/Application\ Support/keepr
rm -rf ~/Library/Application\ Support/magic-audit
rm -rf ~/Library/Application\ Support/Magic\ Audit
rm -rf ~/Library/Application\ Support/MagicAudit
rm -rf ~/Library/Caches/Keepr
rm -rf ~/Library/Caches/keepr
rm -rf ~/Library/Caches/Magic\ Audit
rm -rf ~/Library/Caches/magic-audit

# Remove the application (current + legacy)
echo "Removing application..."
rm -rf /Applications/Keepr.app
rm -rf /Applications/MagicAudit.app

# Delete keychain entries (current + legacy)
echo "Removing keychain entries..."
security delete-generic-password -s "Keepr Safe Storage" 2>/dev/null || true
security delete-generic-password -s "magic-audit Safe Storage" 2>/dev/null || true

# Verify cleanup
echo ""
echo "=========================================="
echo "  Verification"
echo "=========================================="
remaining=$(ls ~/Library/Application\ Support/ 2>/dev/null | grep -iE "magic|keepr")
if [ -z "$remaining" ]; then
    echo "Status: All Keepr data removed"
else
    echo "Warning: Some files may remain:"
    echo "$remaining"
fi

echo ""
echo "Cleanup complete. You can now reinstall Keepr."
echo ""
