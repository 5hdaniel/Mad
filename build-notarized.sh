#!/bin/bash

# Build script with notarization
# This script sets the required environment variables for notarization
# and then runs the package command

# IMPORTANT: Replace with your Apple Developer email
export APPLE_ID="REPLACE_WITH_YOUR_EMAIL@example.com"
export APPLE_TEAM_ID="SDX736QH45"
export APPLE_APP_SPECIFIC_PASSWORD="@keychain:AC_PASSWORD"

echo "Building with notarization..."
echo "Apple ID: $APPLE_ID"
echo "Team ID: $APPLE_TEAM_ID"
echo ""

npm run package
