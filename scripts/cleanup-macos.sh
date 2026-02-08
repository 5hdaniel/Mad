#!/bin/bash
#
# MagicAudit Cleanup Script for macOS
# Removes all app data, caches, and keychain entries
#
# Usage: Double-click this file or run: ./cleanup-macos.sh
#

echo "=========================================="
echo "  MagicAudit Cleanup Tool"
echo "=========================================="
echo ""

# Kill any running app FIRST
echo "Stopping MagicAudit if running..."
pkill -f "MagicAudit" 2>/dev/null || true
sleep 1

# Delete all app data folders
echo "Removing application data..."
rm -rf ~/Library/Application\ Support/magic-audit
rm -rf ~/Library/Application\ Support/Magic\ Audit
rm -rf ~/Library/Application\ Support/MagicAudit
rm -rf ~/Library/Caches/Magic\ Audit
rm -rf ~/Library/Caches/magic-audit

# Remove the application
echo "Removing application..."
rm -rf /Applications/MagicAudit.app

# Delete keychain entry
echo "Removing keychain entries..."
security delete-generic-password -s "magic-audit Safe Storage" 2>/dev/null || true

# Verify cleanup
echo ""
echo "=========================================="
echo "  Verification"
echo "=========================================="
remaining=$(ls ~/Library/Application\ Support/ 2>/dev/null | grep -i magic)
if [ -z "$remaining" ]; then
    echo "Status: All MagicAudit data removed"
else
    echo "Warning: Some files may remain:"
    echo "$remaining"
fi

echo ""
echo "Cleanup complete. You can now reinstall MagicAudit."
echo ""
