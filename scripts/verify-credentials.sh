#!/bin/bash

# Script to verify Apple Developer credentials
echo "======================================"
echo "Verifying Apple Developer Credentials"
echo "======================================"
echo ""

# Load .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✓ Loaded .env.local"
else
    echo "✗ .env.local not found!"
    exit 1
fi

echo ""
echo "Your current credentials:"
echo "-------------------------"
echo "APPLE_ID: $APPLE_ID"
echo "APPLE_TEAM_ID: $APPLE_TEAM_ID"
echo "APPLE_APP_SPECIFIC_PASSWORD: ${APPLE_APP_SPECIFIC_PASSWORD:0:4}****"
echo ""

# Check Developer ID certificates
echo "======================================"
echo "Checking Developer ID Certificates"
echo "======================================"
echo ""

CERTS=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application")

if [ -n "$CERTS" ]; then
    echo "$CERTS"
    echo ""

    # Check if Team ID appears in certificate
    if echo "$CERTS" | grep -q "$APPLE_TEAM_ID"; then
        echo "✓ Found certificate with Team ID: $APPLE_TEAM_ID"
    else
        echo "⚠ WARNING: No certificate found with Team ID: $APPLE_TEAM_ID"
        echo ""
        echo "Your certificates may belong to a different Team ID."
        echo "Check the Organization Unit (OU) in the certificate name above."
    fi
else
    echo "✗ No Developer ID Application certificates found!"
    echo ""
    echo "You need to:"
    echo "1. Go to https://developer.apple.com/account/resources/certificates/list"
    echo "2. Create or download 'Developer ID Application' certificate"
    echo "3. Double-click the .cer file to install it in Keychain"
fi

echo ""
echo "======================================"
echo "Verifying Apple ID & Team ID Match"
echo "======================================"
echo ""

echo "Please verify the following:"
echo ""
echo "1. Go to: https://developer.apple.com/account"
echo "2. Sign in with: $APPLE_ID"
echo "3. Click 'Membership' in the sidebar"
echo "4. Verify that the Team ID shown is: $APPLE_TEAM_ID"
echo ""
echo "If the Team ID doesn't match, you may be signed in to the wrong"
echo "Apple Developer account, or you might belong to multiple teams."
echo ""

echo "======================================"
echo "Common Issues & Solutions"
echo "======================================"
echo ""
echo "Issue: 'HTTP 403 - Invalid team ID'"
echo "Solutions:"
echo "  1. Your Apple ID may belong to multiple teams"
echo "     - Check which team this specific certificate belongs to"
echo "     - Use the Team ID from that specific team"
echo ""
echo "  2. Wrong Apple ID"
echo "     - The certificate was created under a different Apple ID"
echo "     - Use the Apple ID that created the certificate"
echo ""
echo "  3. Role/Permission issue"
echo "     - Your Apple ID needs 'Admin' or 'Account Holder' role"
echo "     - Check at: https://developer.apple.com/account/#!/membership/"
echo ""
echo "  4. App-specific password expired or wrong"
echo "     - Generate new one at: https://appleid.apple.com"
echo "     - Update APPLE_APP_SPECIFIC_PASSWORD in .env.local"
echo ""
