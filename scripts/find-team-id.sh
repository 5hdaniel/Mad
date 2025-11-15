#!/bin/bash

# Script to help find your Apple Team ID
echo "======================================"
echo "Finding Your Apple Developer Team ID"
echo "======================================"
echo ""

# Check if we can find it in the keychain certificates
echo "Looking for Developer ID certificates in Keychain..."
echo ""

CERT_INFO=$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application")

if [ -n "$CERT_INFO" ]; then
    echo "Found Developer ID certificates:"
    echo "$CERT_INFO"
    echo ""

    # Try to extract Team ID from certificate
    CERT_HASH=$(echo "$CERT_INFO" | head -1 | awk '{print $2}')
    if [ -n "$CERT_HASH" ]; then
        echo "Extracting Team ID from certificate..."
        TEAM_ID=$(security find-certificate -c "$CERT_HASH" -p | openssl x509 -text | grep "OU=" | sed 's/.*OU=\([^,]*\).*/\1/' | head -1)

        if [ -n "$TEAM_ID" ]; then
            echo ""
            echo "✅ Found Team ID: $TEAM_ID"
            echo ""
            echo "Add this to your .env.local file:"
            echo "APPLE_TEAM_ID=$TEAM_ID"
            echo ""
        fi
    fi
else
    echo "❌ No Developer ID Application certificates found in Keychain."
    echo ""
    echo "You need to:"
    echo "1. Go to https://developer.apple.com/account/resources/certificates/list"
    echo "2. Create a 'Developer ID Application' certificate if you don't have one"
    echo "3. Download and install it by double-clicking the .cer file"
    echo ""
fi

echo "======================================"
echo "Alternative Method: Find Team ID Online"
echo "======================================"
echo ""
echo "1. Go to: https://developer.apple.com/account"
echo "2. Sign in with your Apple ID: dhaim@bluespaces.com"
echo "3. Click on 'Membership' in the left sidebar"
echo "4. Your Team ID will be displayed there (10 characters, like: ABC123DEFG)"
echo ""
echo "Then update your .env.local file with:"
echo "APPLE_TEAM_ID=YOUR_ACTUAL_TEAM_ID"
echo ""
