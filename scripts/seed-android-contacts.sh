#!/bin/bash
# Add test contacts to connected Android device via ADB
# Matches phone numbers in test-sms-backup.xml

set -e

if ! command -v adb &> /dev/null; then
    echo "ADB not found."
    exit 1
fi

add_contact() {
    local name="$1"
    local phone="$2"

    adb shell "content insert --uri content://com.android.contacts/raw_contacts --bind account_type:s:local --bind account_name:s:local" 2>/dev/null

    local raw_id=$(adb shell "content query --uri content://com.android.contacts/raw_contacts --projection _id --sort '_id DESC'" 2>/dev/null | head -1 | grep -o '_id=[0-9]*' | head -1 | cut -d= -f2)

    adb shell "content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:$raw_id --bind mimetype:s:vnd.android.cursor.item/name --bind data1:s:'$name'" 2>/dev/null

    adb shell "content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:$raw_id --bind mimetype:s:vnd.android.cursor.item/phone_v2 --bind data1:s:'$phone' --bind data2:i:2" 2>/dev/null

    echo "  Added: $name ($phone)"
}

echo "Adding test contacts..."
echo ""

add_contact "Sarah Johnson" "+15551234567"
add_contact "Mike Lender" "+15559876543"
add_contact "Janet Title Co" "+15552468013"
add_contact "Tom Inspector" "+15553691215"
add_contact "David Client" "+15557771234"
add_contact "Agent Karen" "+15558884321"
add_contact "Lisa Escrow" "+15556543210"
add_contact "Broker Jim" "+15554443333"
add_contact "Amy Prospect" "+15553217890"

echo ""
echo "Done! 9 contacts added."
