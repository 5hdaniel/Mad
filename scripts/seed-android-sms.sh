#!/bin/bash
# Seed fake SMS messages on a connected Android device via ADB
# Usage: ./scripts/seed-android-sms.sh

set -e

if ! command -v adb &> /dev/null; then
    echo "ADB not found. Install with: brew install android-platform-tools"
    exit 1
fi

DEVICE=$(adb devices | grep -v "List" | grep "device" | head -1)
if [ -z "$DEVICE" ]; then
    echo "No Android device found."
    exit 1
fi

echo "Device found. Inserting test SMS messages..."

insert_sms() {
    local address="$1"
    local body="$2"
    local type="$3"
    local minutes_ago="$4"
    local timestamp=$(( ($(date +%s) - ($minutes_ago * 60)) * 1000 ))

    # Use adb shell with single-quoted command to avoid space issues
    adb shell "content insert --uri content://sms --bind address:s:'$address' --bind body:s:'$body' --bind date:l:$timestamp --bind read:i:1 --bind type:i:$type --bind seen:i:1" 2>/dev/null

    local direction="received"
    [ "$type" = "2" ] && direction="sent"
    echo "  [$direction] $address: ${body:0:50}"
}

echo ""
echo "=== Real Estate Transaction Messages ==="

# Agent-client showing conversation
insert_sms "+15551234567" "Hi I have a showing request for 123 Oak Lane Thursday 2pm" 2 120
insert_sms "+15551234567" "Thursday at 2 works for me" 1 115
insert_sms "+15551234567" "3bed 2bath listed at 425K updated kitchen" 2 110
insert_sms "+15551234567" "Can my husband come too" 1 105
insert_sms "+15551234567" "Of course see you both Thursday 2pm at 123 Oak Lane" 2 100

# Lender
insert_sms "+15559876543" "Pre-approval letter for the Martinez family is ready" 1 90
insert_sms "+15559876543" "Thanks Mike can you send rate lock details" 2 85
insert_sms "+15559876543" "Rate locked at 6.25 percent for 60 days" 1 80

# Title company
insert_sms "+15552468013" "Title search complete for 456 Pine St clean title no liens" 1 70
insert_sms "+15552468013" "Can we schedule closing for next Friday" 2 65
insert_sms "+15552468013" "Friday the 15th works 10am at our office" 1 60

# Inspector
insert_sms "+15553691215" "Inspection for 789 Maple Dr done minor roof flashing repair needed" 1 50
insert_sms "+15553691215" "How urgent is the roof issue" 2 45
insert_sms "+15553691215" "Negotiation point about 2-3K to fix everything else looks good" 1 40

# Client offer
insert_sms "+15557771234" "Did we hear back on our offer for the Cedar house" 1 30
insert_sms "+15557771234" "Seller agent said reviewing all offers tonight will let you know" 2 25
insert_sms "+15557771234" "Ok fingers crossed we really loved that house" 1 20
insert_sms "+15557771234" "They accepted our offer at 385K lets talk tomorrow" 2 10
insert_sms "+15557771234" "Thank you so much what time works tomorrow" 1 5

# Another agent
insert_sms "+15558884321" "My clients want to see your listing at 222 Elm St" 1 95
insert_sms "+15558884321" "Wednesday or Thursday afternoon works" 2 92
insert_sms "+15558884321" "Wednesday 3pm" 1 88
insert_sms "+15558884321" "Confirmed lockbox code is 4589" 2 86

# Escrow
insert_sms "+15556543210" "Earnest money received for 123 Oak Lane escrow opened" 1 55
insert_sms "+15556543210" "Timeline for appraisal" 2 52
insert_sms "+15556543210" "Appraiser scheduled for Monday results by Wednesday" 1 48

echo ""
echo "=== Done! Inserted 27 test messages ==="
echo ""
echo "To verify: adb shell content query --uri content://sms --projection address:body --sort 'date DESC'"
