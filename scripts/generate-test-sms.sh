#!/bin/bash
# Generate 3 months of realistic real estate SMS test data
# Output: scripts/test-sms-backup.xml (SMS Backup & Restore format)

OUTPUT="/Users/daniel/Documents/Mad/scripts/test-sms-backup.xml"

# Base timestamp: 3 months ago from now
NOW=$(date +%s)
THREE_MONTHS_AGO=$(( NOW - (90 * 24 * 60 * 60) ))

# Helper: timestamp N days ago, at a specific hour:minute
ts() {
    local days_ago=$1
    local hour=$2
    local min=$3
    echo $(( (NOW - (days_ago * 86400) + (hour * 3600) + (min * 60)) * 1000 ))
}

cat > "$OUTPUT" << 'HEADER'
<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<!--File Created By SMS Backup & Restore v10.20.002-->
<smses count="156" backup_set="keepr-test" backup_date="1711636800000" type="full">
HEADER

# ============================================================
# CONTACT 1: Sarah Johnson - Buyer Client (+15551234567)
# Full transaction arc: initial contact → showing → offer → closing
# ============================================================

# Week 1 (90 days ago) - Initial contact
cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15551234567" date="$(ts 90 9 15)" type="1" body="Hi this is Sarah Johnson I was referred to you by Mike at First National Bank" read="1" status="-1" date_sent="$(ts 90 9 15)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 90 9 22)" type="2" body="Hi Sarah welcome! Mike mentioned you are looking to buy in the Riverside area. When would you like to start looking" read="1" status="-1" date_sent="$(ts 90 9 22)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 90 9 30)" type="1" body="Yes we are looking for 3bed 2bath under 450K. This weekend works if you are available" read="1" status="-1" date_sent="$(ts 90 9 30)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 90 9 45)" type="2" body="Saturday 10am works great. I will pull some listings and send them over tonight" read="1" status="-1" date_sent="$(ts 90 9 45)" contact_name="Sarah Johnson" />
EOF

# Week 2 (83 days ago) - Showings
cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15551234567" date="$(ts 83 10 0)" type="2" body="Good morning Sarah! Ready for today? First stop is 123 Oak Lane at 10:30" read="1" status="-1" date_sent="$(ts 83 10 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 83 10 5)" type="1" body="On our way! Can my husband come" read="1" status="-1" date_sent="$(ts 83 10 5)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 83 10 8)" type="2" body="Of course! See you both there" read="1" status="-1" date_sent="$(ts 83 10 8)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 83 14 30)" type="1" body="We loved 123 Oak Lane! The kitchen was exactly what we wanted. What do you think about the price" read="1" status="-1" date_sent="$(ts 83 14 30)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 83 14 45)" type="2" body="Its priced well for the area. Comps show 415-435K range. The listing is at 425K which is fair. Want to make an offer" read="1" status="-1" date_sent="$(ts 83 14 45)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 83 15 0)" type="1" body="Yes lets do it! What do you suggest for the offer price" read="1" status="-1" date_sent="$(ts 83 15 0)" contact_name="Sarah Johnson" />
EOF

# Week 3 (76 days ago) - Offer and negotiation
cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15551234567" date="$(ts 76 11 0)" type="2" body="Great news Sarah! Seller accepted our offer at 418K with closing in 45 days" read="1" status="-1" date_sent="$(ts 76 11 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 76 11 5)" type="1" body="OMG thats amazing!! Thank you so much! What happens next" read="1" status="-1" date_sent="$(ts 76 11 5)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 76 11 15)" type="2" body="Next steps: 1) earnest money deposit due by Friday 2) home inspection next week 3) appraisal will be ordered. I will coordinate everything" read="1" status="-1" date_sent="$(ts 76 11 15)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 75 9 0)" type="1" body="Earnest money wire sent this morning. Can you confirm it was received" read="1" status="-1" date_sent="$(ts 75 9 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 75 10 30)" type="2" body="Confirmed! Escrow has the earnest money. Inspection scheduled for Tuesday at 2pm" read="1" status="-1" date_sent="$(ts 75 10 30)" contact_name="Sarah Johnson" />
EOF

# Week 5 (69 days ago) - Inspection results
cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15551234567" date="$(ts 69 16 0)" type="2" body="Inspection report is in. Overall the house is in great shape. Minor items: roof flashing needs repair and one GFCI outlet not working" read="1" status="-1" date_sent="$(ts 69 16 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 69 16 15)" type="1" body="Is the roof thing a big deal" read="1" status="-1" date_sent="$(ts 69 16 15)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 69 16 25)" type="2" body="Not major. Maybe 2-3K to fix. I recommend we ask the seller to credit us at closing. Ill draft the repair request" read="1" status="-1" date_sent="$(ts 69 16 25)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 67 14 0)" type="2" body="Seller agreed to a 2500 credit for repairs. Appraisal is scheduled for Thursday" read="1" status="-1" date_sent="$(ts 67 14 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 67 14 10)" type="1" body="Perfect thank you for handling all of this" read="1" status="-1" date_sent="$(ts 67 14 10)" contact_name="Sarah Johnson" />
EOF

# Week 8 (48 days ago) - Appraisal and closing prep
cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15551234567" date="$(ts 48 10 0)" type="2" body="Appraisal came in at 420K which is above our purchase price of 418K. We are good to go!" read="1" status="-1" date_sent="$(ts 48 10 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 48 10 8)" type="1" body="Wonderful! When is closing" read="1" status="-1" date_sent="$(ts 48 10 8)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 48 10 20)" type="2" body="Closing is set for March 15th at 10am at Pacific Title. I will send the settlement statement a few days before" read="1" status="-1" date_sent="$(ts 48 10 20)" contact_name="Sarah Johnson" />
EOF

# Week 11 (25 days ago) - Final walkthrough and closing
cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15551234567" date="$(ts 25 9 0)" type="2" body="Final walkthrough tomorrow at 9am. Then closing at 10am. Dont forget to bring your ID and certified check" read="1" status="-1" date_sent="$(ts 25 9 0)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 25 9 10)" type="1" body="We will be there! So excited" read="1" status="-1" date_sent="$(ts 25 9 10)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 24 11 30)" type="2" body="Congratulations Sarah and family! You are officially homeowners! Here are your keys" read="1" status="-1" date_sent="$(ts 24 11 30)" contact_name="Sarah Johnson" />
  <sms protocol="0" address="+15551234567" date="$(ts 24 11 45)" type="1" body="Thank you for everything! You made this so easy. We will definitely refer you to our friends" read="1" status="-1" date_sent="$(ts 24 11 45)" contact_name="Sarah Johnson" />
EOF

# ============================================================
# CONTACT 2: Mike Lender - Loan Officer (+15559876543)
# Pre-approval, rate locks, underwriting updates
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15559876543" date="$(ts 88 10 0)" type="2" body="Hi Mike its me. I have a new client Sarah Johnson looking to buy around 450K. Can you get her pre-approved" read="1" status="-1" date_sent="$(ts 88 10 0)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 88 10 30)" type="1" body="Sure thing! Have her call me at the office or I can send her the online application link" read="1" status="-1" date_sent="$(ts 88 10 30)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 88 10 35)" type="2" body="Send her the link please. Her number is 555-123-4567" read="1" status="-1" date_sent="$(ts 88 10 35)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 85 14 0)" type="1" body="Pre-approval letter for Sarah Johnson is ready. Approved up to 460K. Ill email it over" read="1" status="-1" date_sent="$(ts 85 14 0)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 85 14 10)" type="2" body="Great thanks Mike. Can you also send the rate lock details" read="1" status="-1" date_sent="$(ts 85 14 10)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 85 14 20)" type="1" body="Rate locked at 6.25 percent for 60 days. Conventional 30yr fixed with 10 percent down" read="1" status="-1" date_sent="$(ts 85 14 20)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 72 9 0)" type="2" body="Mike we got an accepted offer at 418K. Can you start the full underwriting" read="1" status="-1" date_sent="$(ts 72 9 0)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 72 9 15)" type="1" body="Congrats! Starting underwriting today. Will need the purchase agreement and earnest money receipt" read="1" status="-1" date_sent="$(ts 72 9 15)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 55 11 0)" type="1" body="Underwriting is clear to close! Final loan docs being sent to title today" read="1" status="-1" date_sent="$(ts 55 11 0)" contact_name="Mike Lender" />
  <sms protocol="0" address="+15559876543" date="$(ts 55 11 10)" type="2" body="Awesome thanks Mike. Closing is March 15th at Pacific Title" read="1" status="-1" date_sent="$(ts 55 11 10)" contact_name="Mike Lender" />
EOF

# ============================================================
# CONTACT 3: Janet - Title Company (+15552468013)
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15552468013" date="$(ts 73 10 0)" type="2" body="Hi Janet opening escrow for 123 Oak Lane. Buyer Sarah Johnson seller Tom Williams. Purchase price 418K" read="1" status="-1" date_sent="$(ts 73 10 0)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 73 10 30)" type="1" body="Got it! Escrow number is 2026-04521. Ill send the preliminary title report by end of week" read="1" status="-1" date_sent="$(ts 73 10 30)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 70 15 0)" type="1" body="Title search complete for 123 Oak Lane. Clean title no liens or encumbrances. Report emailed" read="1" status="-1" date_sent="$(ts 70 15 0)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 70 15 10)" type="2" body="Perfect. Can we schedule closing for March 15th" read="1" status="-1" date_sent="$(ts 70 15 10)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 70 15 20)" type="1" body="March 15th at 10am works. Ill send the settlement statement by March 12th" read="1" status="-1" date_sent="$(ts 70 15 20)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 27 9 0)" type="1" body="Settlement statement for 123 Oak Lane is ready. Emailing to all parties now. Buyer needs certified check for 45,230" read="1" status="-1" date_sent="$(ts 27 9 0)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 27 9 15)" type="2" body="Thanks Janet. Forwarding to my client now" read="1" status="-1" date_sent="$(ts 27 9 15)" contact_name="Janet Title Co" />
  <sms protocol="0" address="+15552468013" date="$(ts 24 12 0)" type="1" body="Closing complete! Documents recorded. Keys released to buyer. Great working with you" read="1" status="-1" date_sent="$(ts 24 12 0)" contact_name="Janet Title Co" />
EOF

# ============================================================
# CONTACT 4: Tom Inspector (+15553691215)
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15553691215" date="$(ts 71 8 0)" type="2" body="Hi Tom can you do an inspection at 123 Oak Lane next Tuesday at 2pm" read="1" status="-1" date_sent="$(ts 71 8 0)" contact_name="Tom Inspector" />
  <sms protocol="0" address="+15553691215" date="$(ts 71 8 30)" type="1" body="Tuesday 2pm works. Is this a standard home inspection" read="1" status="-1" date_sent="$(ts 71 8 30)" contact_name="Tom Inspector" />
  <sms protocol="0" address="+15553691215" date="$(ts 71 8 35)" type="2" body="Yes standard plus termite. Buyer will be there" read="1" status="-1" date_sent="$(ts 71 8 35)" contact_name="Tom Inspector" />
  <sms protocol="0" address="+15553691215" date="$(ts 69 16 0)" type="1" body="Inspection for 123 Oak Lane done. Found minor issues - roof flashing needs repair and one GFCI outlet. Full report coming tonight" read="1" status="-1" date_sent="$(ts 69 16 0)" contact_name="Tom Inspector" />
  <sms protocol="0" address="+15553691215" date="$(ts 69 16 10)" type="2" body="How urgent is the roof issue. Deal breaker or negotiation point" read="1" status="-1" date_sent="$(ts 69 16 10)" contact_name="Tom Inspector" />
  <sms protocol="0" address="+15553691215" date="$(ts 69 16 20)" type="1" body="Negotiation point. Estimate around 2-3K to fix. Everything else looks good. Termite clear" read="1" status="-1" date_sent="$(ts 69 16 20)" contact_name="Tom Inspector" />
EOF

# ============================================================
# CONTACT 5: David & Maria - Seller Clients (+15557771234)
# Listing to closing
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15557771234" date="$(ts 87 18 0)" type="1" body="Hi we spoke at the open house last Sunday. We are thinking about selling our home on Cedar Ave" read="1" status="-1" date_sent="$(ts 87 18 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 87 18 15)" type="2" body="Hi David! Great to hear from you. I would love to do a market analysis. When can I come see the property" read="1" status="-1" date_sent="$(ts 87 18 15)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 87 18 20)" type="1" body="How about Wednesday evening around 6" read="1" status="-1" date_sent="$(ts 87 18 20)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 87 18 25)" type="2" body="Wednesday at 6 works. I will bring the comps for your neighborhood. See you then" read="1" status="-1" date_sent="$(ts 87 18 25)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 82 10 0)" type="2" body="David based on the CMA I recommend listing at 385K. The market is strong right now for your area" read="1" status="-1" date_sent="$(ts 82 10 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 82 10 30)" type="1" body="That sounds good. When can we go live" read="1" status="-1" date_sent="$(ts 82 10 30)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 82 10 45)" type="2" body="Photographer is coming Thursday. We can go live on MLS Friday morning" read="1" status="-1" date_sent="$(ts 82 10 45)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 75 17 0)" type="2" body="We got 3 showing requests for this weekend! The listing is getting great traffic" read="1" status="-1" date_sent="$(ts 75 17 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 75 17 10)" type="1" body="Awesome! Do we need to leave the house for showings" read="1" status="-1" date_sent="$(ts 75 17 10)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 75 17 15)" type="2" body="Yes best to leave for 30 min each showing. Saturday at 11am 1pm and 3pm" read="1" status="-1" date_sent="$(ts 75 17 15)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 72 19 0)" type="2" body="We received two offers on Cedar Ave! One at 380K and one at 390K. Want to review them tonight" read="1" status="-1" date_sent="$(ts 72 19 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 72 19 10)" type="1" body="Yes please. Can you come over at 7" read="1" status="-1" date_sent="$(ts 72 19 10)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 71 10 0)" type="2" body="David the 390K buyer accepted our counter at 385K with 30 day close. Congratulations!" read="1" status="-1" date_sent="$(ts 71 10 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 71 10 10)" type="1" body="Great news! Thank you for negotiating that. What are next steps" read="1" status="-1" date_sent="$(ts 71 10 10)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 50 14 0)" type="2" body="Buyer inspection went well. Only minor items. Appraisal came in at 388K which is above sale price. We are on track" read="1" status="-1" date_sent="$(ts 50 14 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 35 9 0)" type="2" body="Closing for Cedar Ave is next Wednesday at 2pm at Pacific Title. Bring your ID" read="1" status="-1" date_sent="$(ts 35 9 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 33 15 0)" type="2" body="Closing complete! Proceeds will wire to your account within 24-48 hours. Congrats David" read="1" status="-1" date_sent="$(ts 33 15 0)" contact_name="David Client" />
  <sms protocol="0" address="+15557771234" date="$(ts 33 15 15)" type="1" body="Thank you! Maria and I really appreciate everything you did. Will leave you a great review" read="1" status="-1" date_sent="$(ts 33 15 15)" contact_name="David Client" />
EOF

# ============================================================
# CONTACT 6: Agent Karen - Buyer Agent (+15558884321)
# Showing coordination and offers on listings
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15558884321" date="$(ts 78 10 0)" type="1" body="Hi my clients want to see your listing at 222 Elm St. Any availability this week" read="1" status="-1" date_sent="$(ts 78 10 0)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 78 10 15)" type="2" body="Sure! Wednesday or Thursday afternoon works. What time" read="1" status="-1" date_sent="$(ts 78 10 15)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 78 10 20)" type="1" body="Wednesday 3pm" read="1" status="-1" date_sent="$(ts 78 10 20)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 78 10 25)" type="2" body="Confirmed. Lockbox code is 4589. Please leave feedback after showing" read="1" status="-1" date_sent="$(ts 78 10 25)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 76 9 0)" type="1" body="My clients loved the property! They want to make an offer. Sending it over this afternoon" read="1" status="-1" date_sent="$(ts 76 9 0)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 76 9 10)" type="2" body="Great! I will present it to my sellers tonight" read="1" status="-1" date_sent="$(ts 76 9 10)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 60 14 0)" type="1" body="Hey do you have any other listings coming up? My buyers are still looking for a 4bed in Riverside" read="1" status="-1" date_sent="$(ts 60 14 0)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 60 14 15)" type="2" body="Actually I might have a pocket listing next month. 4bed 3bath on Maple. Ill keep you posted" read="1" status="-1" date_sent="$(ts 60 14 15)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 20 11 0)" type="2" body="Karen the Maple property is going live next week. Want a preview showing for your clients" read="1" status="-1" date_sent="$(ts 20 11 0)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 20 11 10)" type="1" body="Absolutely! When can we see it" read="1" status="-1" date_sent="$(ts 20 11 10)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 20 11 15)" type="2" body="How about Friday at noon" read="1" status="-1" date_sent="$(ts 20 11 15)" contact_name="Agent Karen" />
  <sms protocol="0" address="+15558884321" date="$(ts 20 11 20)" type="1" body="Friday noon works. Thanks for the heads up!" read="1" status="-1" date_sent="$(ts 20 11 20)" contact_name="Agent Karen" />
EOF

# ============================================================
# CONTACT 7: Lisa Escrow (+15556543210)
# Escrow coordination
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15556543210" date="$(ts 74 11 0)" type="1" body="Earnest money received for 123 Oak Lane. Escrow officially opened. Number 2026-04521" read="1" status="-1" date_sent="$(ts 74 11 0)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 74 11 15)" type="2" body="Thanks Lisa. Timeline for the appraisal" read="1" status="-1" date_sent="$(ts 74 11 15)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 74 11 25)" type="1" body="Appraiser is scheduled for next Monday. Should have results by Wednesday" read="1" status="-1" date_sent="$(ts 74 11 25)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 60 10 0)" type="1" body="Quick update on 123 Oak Lane - all contingencies have been removed. We are in the clear for closing" read="1" status="-1" date_sent="$(ts 60 10 0)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 60 10 10)" type="2" body="Great news. Settlement statement ready yet" read="1" status="-1" date_sent="$(ts 60 10 10)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 60 10 20)" type="1" body="Will have it by end of next week" read="1" status="-1" date_sent="$(ts 60 10 20)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 40 9 0)" type="2" body="Lisa do you also have capacity to handle the Cedar Ave closing? Same buyer agent" read="1" status="-1" date_sent="$(ts 40 9 0)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 40 9 15)" type="1" body="Yes! Send me the purchase agreement and I will get it set up" read="1" status="-1" date_sent="$(ts 40 9 15)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 24 12 0)" type="1" body="Both closings recorded today! 123 Oak Lane and Cedar Ave all done. Keys released" read="1" status="-1" date_sent="$(ts 24 12 0)" contact_name="Lisa Escrow" />
  <sms protocol="0" address="+15556543210" date="$(ts 24 12 10)" type="2" body="Thank you Lisa great working with you as always" read="1" status="-1" date_sent="$(ts 24 12 10)" contact_name="Lisa Escrow" />
EOF

# ============================================================
# CONTACT 8: Broker Jim - Office (+15554443333)
# Office communication, compliance
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15554443333" date="$(ts 85 8 30)" type="1" body="Reminder: office meeting tomorrow at 9am. New compliance requirements for transaction files" read="1" status="-1" date_sent="$(ts 85 8 30)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 85 8 35)" type="2" body="Thanks Jim I will be there" read="1" status="-1" date_sent="$(ts 85 8 35)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 60 16 0)" type="1" body="Your transaction file for 123 Oak Lane needs the updated lead paint disclosure. Please upload by Friday" read="1" status="-1" date_sent="$(ts 60 16 0)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 60 16 10)" type="2" body="Will do. I have the signed copy just need to scan it" read="1" status="-1" date_sent="$(ts 60 16 10)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 30 9 0)" type="1" body="Great job on the Oak Lane and Cedar Ave closings! Two in one month is solid" read="1" status="-1" date_sent="$(ts 30 9 0)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 30 9 10)" type="2" body="Thank you Jim! Got a few more in the pipeline" read="1" status="-1" date_sent="$(ts 30 9 10)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 10 14 0)" type="1" body="Annual license renewal reminder. Due by April 30th. CE hours complete?" read="1" status="-1" date_sent="$(ts 10 14 0)" contact_name="Broker Jim" />
  <sms protocol="0" address="+15554443333" date="$(ts 10 14 15)" type="2" body="Yes all done. I will submit the renewal this week" read="1" status="-1" date_sent="$(ts 10 14 15)" contact_name="Broker Jim" />
EOF

# ============================================================
# CONTACT 9: New Lead - Prospect (+15553217890)
# Recent inquiry, nurturing
# ============================================================

cat >> "$OUTPUT" << EOF
  <sms protocol="0" address="+15553217890" date="$(ts 7 19 0)" type="1" body="Hi I saw your sign on the Maple property. Is it still available" read="1" status="-1" date_sent="$(ts 7 19 0)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 7 19 15)" type="2" body="Hi! Yes the Maple property is available. It goes live on MLS next week. Would you like a private showing" read="1" status="-1" date_sent="$(ts 7 19 15)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 7 19 20)" type="1" body="Yes please! Is it 4 bedrooms" read="1" status="-1" date_sent="$(ts 7 19 20)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 7 19 30)" type="2" body="4bed 3bath 2200 sqft. Updated kitchen and new roof last year. Are you pre-approved for a mortgage" read="1" status="-1" date_sent="$(ts 7 19 30)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 7 19 35)" type="1" body="Not yet but we have been talking to our bank" read="1" status="-1" date_sent="$(ts 7 19 35)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 7 19 45)" type="2" body="I recommend getting pre-approved first. I can refer you to a great lender if you need one. In the meantime I can show you the property Saturday" read="1" status="-1" date_sent="$(ts 7 19 45)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 6 10 0)" type="1" body="Saturday works! 2pm?" read="1" status="-1" date_sent="$(ts 6 10 0)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 6 10 10)" type="2" body="Saturday 2pm confirmed. I will meet you at 789 Maple Dr. See you then!" read="1" status="-1" date_sent="$(ts 6 10 10)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 3 14 0)" type="1" body="We loved the house! Can you send us the lender contact? We want to get pre-approved and make an offer" read="1" status="-1" date_sent="$(ts 3 14 0)" contact_name="New Lead Amy" />
  <sms protocol="0" address="+15553217890" date="$(ts 3 14 10)" type="2" body="Thats great to hear! I will text you Mike's info. He is fantastic and can usually get pre-approval in 48 hours" read="1" status="-1" date_sent="$(ts 3 14 10)" contact_name="New Lead Amy" />
EOF

# Close the XML
cat >> "$OUTPUT" << EOF
</smses>
EOF

# Count actual messages
MSG_COUNT=$(grep -c '<sms ' "$OUTPUT")
# Update the count in the header
sed -i '' "s/count=\"156\"/count=\"$MSG_COUNT\"/" "$OUTPUT"

echo "Generated $MSG_COUNT messages across 9 contacts spanning 90 days"
echo "Output: $OUTPUT"
echo ""
echo "To push to phone:"
echo "  adb push $OUTPUT /sdcard/SMSBackupRestore/test-sms-backup.xml"
echo "  adb push $OUTPUT /sdcard/Download/test-sms-backup.xml"
