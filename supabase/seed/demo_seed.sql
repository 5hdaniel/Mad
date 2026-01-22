-- ============================================
-- B2B BROKER PORTAL - DEMO SEED DATA
-- ============================================
-- This script creates demo data for testing the B2B broker portal.
-- Run after schema migration (20260122_b2b_broker_portal.sql)
--
-- Prerequisites:
-- 1. Schema migration must be applied first
-- 2. Demo users must be created in Supabase Auth first (see README.md)
-- 3. Run this with service role key (bypasses RLS)
--
-- This script is idempotent - safe to run multiple times.
-- ============================================

-- ============================================
-- CONFIGURATION
-- ============================================
-- Demo user UUIDs - replace with actual UUIDs from auth.users after creating users
-- These are placeholder UUIDs that will be replaced when users sign up

DO $$
DECLARE
  v_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
  v_alice_id UUID;
  v_bob_id UUID;
  v_carol_id UUID;
  v_dana_id UUID;
  v_submission_1_id UUID;
  v_submission_2_id UUID;
  v_submission_3_id UUID;
  v_submission_4_id UUID;
BEGIN
  -- ============================================
  -- DEMO ORGANIZATION
  -- ============================================
  INSERT INTO organizations (id, name, slug, plan, max_seats, retention_years, settings)
  VALUES (
    v_org_id,
    'Acme Realty Group',
    'acme-realty',
    'pro',
    10,
    7,
    '{"demo": true, "created_for": "sprint-050"}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    plan = EXCLUDED.plan,
    max_seats = EXCLUDED.max_seats,
    settings = EXCLUDED.settings,
    updated_at = NOW();

  RAISE NOTICE 'Created/updated organization: Acme Realty Group (%)' , v_org_id;

  -- ============================================
  -- DEMO USERS - Check if they exist in auth.users
  -- ============================================
  -- Look up demo users by email in auth.users
  -- If they don't exist yet, we'll create placeholder invitations

  SELECT id INTO v_alice_id FROM auth.users WHERE email = 'alice@acme-demo.test' LIMIT 1;
  SELECT id INTO v_bob_id FROM auth.users WHERE email = 'bob@acme-demo.test' LIMIT 1;
  SELECT id INTO v_carol_id FROM auth.users WHERE email = 'carol@acme-demo.test' LIMIT 1;
  SELECT id INTO v_dana_id FROM auth.users WHERE email = 'dana@acme-demo.test' LIMIT 1;

  -- ============================================
  -- ORGANIZATION MEMBERS / INVITATIONS
  -- ============================================
  -- If users exist, link them; otherwise create pending invitations

  -- Alice (Agent - Primary)
  IF v_alice_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role, license_status, joined_at, invited_email)
    VALUES (v_org_id, v_alice_id, 'agent', 'active', NOW(), 'alice@acme-demo.test')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      license_status = EXCLUDED.license_status,
      updated_at = NOW();
    RAISE NOTICE 'Linked user Alice (%) to organization', v_alice_id;
  ELSE
    -- Create invitation for Alice
    INSERT INTO organization_members (organization_id, user_id, role, license_status, invited_email, invitation_token, invitation_expires_at)
    VALUES (v_org_id, NULL, 'agent', 'pending', 'alice@acme-demo.test', 'demo-invite-alice-' || gen_random_uuid()::text, NOW() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created invitation for alice@acme-demo.test';
  END IF;

  -- Bob (Agent - Secondary)
  IF v_bob_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role, license_status, joined_at, invited_email)
    VALUES (v_org_id, v_bob_id, 'agent', 'active', NOW(), 'bob@acme-demo.test')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      license_status = EXCLUDED.license_status,
      updated_at = NOW();
    RAISE NOTICE 'Linked user Bob (%) to organization', v_bob_id;
  ELSE
    INSERT INTO organization_members (organization_id, user_id, role, license_status, invited_email, invitation_token, invitation_expires_at)
    VALUES (v_org_id, NULL, 'agent', 'pending', 'bob@acme-demo.test', 'demo-invite-bob-' || gen_random_uuid()::text, NOW() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created invitation for bob@acme-demo.test';
  END IF;

  -- Carol (Broker)
  IF v_carol_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role, license_status, joined_at, invited_email)
    VALUES (v_org_id, v_carol_id, 'broker', 'active', NOW(), 'carol@acme-demo.test')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      license_status = EXCLUDED.license_status,
      updated_at = NOW();
    RAISE NOTICE 'Linked user Carol (%) to organization', v_carol_id;
  ELSE
    INSERT INTO organization_members (organization_id, user_id, role, license_status, invited_email, invitation_token, invitation_expires_at)
    VALUES (v_org_id, NULL, 'broker', 'pending', 'carol@acme-demo.test', 'demo-invite-carol-' || gen_random_uuid()::text, NOW() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created invitation for carol@acme-demo.test';
  END IF;

  -- Dana (Admin)
  IF v_dana_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role, license_status, joined_at, invited_email)
    VALUES (v_org_id, v_dana_id, 'admin', 'active', NOW(), 'dana@acme-demo.test')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      license_status = EXCLUDED.license_status,
      updated_at = NOW();
    RAISE NOTICE 'Linked user Dana (%) to organization', v_dana_id;
  ELSE
    INSERT INTO organization_members (organization_id, user_id, role, license_status, invited_email, invitation_token, invitation_expires_at)
    VALUES (v_org_id, NULL, 'admin', 'pending', 'dana@acme-demo.test', 'demo-invite-dana-' || gen_random_uuid()::text, NOW() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created invitation for dana@acme-demo.test';
  END IF;

  -- ============================================
  -- DEMO SUBMISSIONS (only if users exist)
  -- ============================================
  -- Skip submissions if demo users haven't signed up yet

  IF v_alice_id IS NULL OR v_bob_id IS NULL OR v_carol_id IS NULL THEN
    RAISE NOTICE 'Skipping submissions - demo users not yet created in auth.users';
    RAISE NOTICE 'Create users via Supabase Dashboard, then re-run this seed script';
    RETURN;
  END IF;

  -- Generate submission IDs
  v_submission_1_id := gen_random_uuid();
  v_submission_2_id := gen_random_uuid();
  v_submission_3_id := gen_random_uuid();
  v_submission_4_id := gen_random_uuid();

  -- Submission 1: Approved (happy path)
  INSERT INTO transaction_submissions (
    id, organization_id, submitted_by,
    local_transaction_id, property_address, property_city, property_state, property_zip,
    transaction_type, listing_price, sale_price,
    started_at, closed_at,
    status, reviewed_by, reviewed_at, review_notes,
    message_count, attachment_count,
    submission_metadata
  ) VALUES (
    v_submission_1_id, v_org_id, v_alice_id,
    'txn-local-001', '123 Oak Street', 'Los Angeles', 'CA', '90210',
    'sale', 850000, 825000,
    NOW() - INTERVAL '45 days', NOW() - INTERVAL '5 days',
    'approved', v_carol_id, NOW() - INTERVAL '2 days',
    'All documents in order. Commission calculations verified. Approved for archive.',
    15, 8,
    '{"detection_source": "email", "confidence": 0.95, "demo": true}'::jsonb
  )
  ON CONFLICT (organization_id, local_transaction_id, version) DO UPDATE SET
    status = EXCLUDED.status,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    review_notes = EXCLUDED.review_notes,
    updated_at = NOW();

  RAISE NOTICE 'Created submission 1: 123 Oak Street (approved)';

  -- Submission 2: Needs Changes
  INSERT INTO transaction_submissions (
    id, organization_id, submitted_by,
    local_transaction_id, property_address, property_city, property_state, property_zip,
    transaction_type, listing_price,
    started_at,
    status, reviewed_by, reviewed_at, review_notes,
    message_count, attachment_count,
    submission_metadata
  ) VALUES (
    v_submission_2_id, v_org_id, v_alice_id,
    'txn-local-002', '456 Maple Avenue', 'Santa Monica', 'CA', '90401',
    'purchase', 1200000,
    NOW() - INTERVAL '30 days',
    'needs_changes', v_carol_id, NOW() - INTERVAL '1 day',
    'Missing inspection report from 12/15. Please upload the full inspection report including the addendum. Also need clarification on contingency removal date.',
    12, 5,
    '{"detection_source": "email", "confidence": 0.88, "demo": true}'::jsonb
  )
  ON CONFLICT (organization_id, local_transaction_id, version) DO UPDATE SET
    status = EXCLUDED.status,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    review_notes = EXCLUDED.review_notes,
    updated_at = NOW();

  RAISE NOTICE 'Created submission 2: 456 Maple Avenue (needs_changes)';

  -- Submission 3: Newly Submitted (for demo action)
  INSERT INTO transaction_submissions (
    id, organization_id, submitted_by,
    local_transaction_id, property_address, property_city, property_state, property_zip,
    transaction_type, listing_price,
    started_at,
    status, review_deadline,
    message_count, attachment_count,
    submission_metadata
  ) VALUES (
    v_submission_3_id, v_org_id, v_bob_id,
    'txn-local-003', '789 Pine Road', 'Beverly Hills', 'CA', '90212',
    'sale', 2500000,
    NOW() - INTERVAL '20 days',
    'submitted', NOW() + INTERVAL '3 days',
    20, 12,
    '{"detection_source": "calendar", "confidence": 0.92, "demo": true}'::jsonb
  )
  ON CONFLICT (organization_id, local_transaction_id, version) DO UPDATE SET
    status = EXCLUDED.status,
    review_deadline = EXCLUDED.review_deadline,
    updated_at = NOW();

  RAISE NOTICE 'Created submission 3: 789 Pine Road (submitted)';

  -- Submission 4: Under Review
  INSERT INTO transaction_submissions (
    id, organization_id, submitted_by,
    local_transaction_id, property_address, property_city, property_state, property_zip,
    transaction_type, listing_price, sale_price,
    started_at, closed_at,
    status, reviewed_by,
    message_count, attachment_count,
    submission_metadata
  ) VALUES (
    v_submission_4_id, v_org_id, v_alice_id,
    'txn-local-004', '321 Elm Court', 'Malibu', 'CA', '90265',
    'sale', 4200000, 4100000,
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '10 days',
    'under_review', v_carol_id,
    25, 15,
    '{"detection_source": "email", "confidence": 0.97, "demo": true}'::jsonb
  )
  ON CONFLICT (organization_id, local_transaction_id, version) DO UPDATE SET
    status = EXCLUDED.status,
    reviewed_by = EXCLUDED.reviewed_by,
    updated_at = NOW();

  RAISE NOTICE 'Created submission 4: 321 Elm Court (under_review)';

  -- ============================================
  -- SAMPLE MESSAGES (for submission 1)
  -- ============================================
  -- Delete existing demo messages first
  DELETE FROM submission_messages
  WHERE submission_id = v_submission_1_id
  AND local_message_id LIKE 'demo-msg-%';

  -- Insert sample messages
  INSERT INTO submission_messages (submission_id, local_message_id, channel, direction, subject, body_text, sent_at, has_attachments, attachment_count)
  VALUES
    (v_submission_1_id, 'demo-msg-001', 'email', 'outbound', 'Listing Agreement - 123 Oak Street',
     'Hi Mr. Johnson,\n\nPlease find attached the listing agreement for your property at 123 Oak Street. Please review and sign at your earliest convenience.\n\nBest regards,\nAlice Agent',
     NOW() - INTERVAL '40 days', true, 1),

    (v_submission_1_id, 'demo-msg-002', 'email', 'inbound', 'RE: Listing Agreement - 123 Oak Street',
     'Alice,\n\nThank you for sending the listing agreement. I have reviewed and signed it. Attached is the signed copy.\n\nLooking forward to working with you!\n\nBest,\nRobert Johnson',
     NOW() - INTERVAL '39 days', true, 1),

    (v_submission_1_id, 'demo-msg-003', 'sms', 'outbound', NULL,
     'Hi Robert! Your listing is now live on MLS. We already have 3 showing requests for this weekend!',
     NOW() - INTERVAL '38 days', false, 0),

    (v_submission_1_id, 'demo-msg-004', 'sms', 'inbound', NULL,
     'Thats great news! Looking forward to the updates.',
     NOW() - INTERVAL '38 days', false, 0),

    (v_submission_1_id, 'demo-msg-005', 'email', 'inbound', 'Offer on 123 Oak Street',
     'Dear Alice,\n\nI represent a buyer interested in 123 Oak Street. Attached is our offer of $825,000.\n\nPlease review and let me know.\n\nThanks,\nJohn Buyers Agent',
     NOW() - INTERVAL '30 days', true, 1),

    (v_submission_1_id, 'demo-msg-006', 'email', 'outbound', 'RE: Offer on 123 Oak Street',
     'John,\n\nThank you for the offer. I have presented it to my client and they would like to counter at $835,000. Please see the attached counter offer.\n\nBest,\nAlice Agent',
     NOW() - INTERVAL '29 days', true, 1),

    (v_submission_1_id, 'demo-msg-007', 'email', 'inbound', 'RE: RE: Offer on 123 Oak Street',
     'Alice,\n\nMy clients have agreed to $830,000. Can we meet in the middle?\n\nJohn',
     NOW() - INTERVAL '28 days', false, 0),

    (v_submission_1_id, 'demo-msg-008', 'sms', 'outbound', NULL,
     'Robert - received a counter at $830k. Recommend accepting. Its a solid offer with conventional financing.',
     NOW() - INTERVAL '28 days', false, 0),

    (v_submission_1_id, 'demo-msg-009', 'sms', 'inbound', NULL,
     'Lets do $825k and close in 30 days. Final offer.',
     NOW() - INTERVAL '28 days', false, 0),

    (v_submission_1_id, 'demo-msg-010', 'email', 'outbound', 'Accepted Offer - 123 Oak Street',
     'John,\n\nGreat news! My client has accepted the offer at $825,000 with a 30-day close. Attached is the signed acceptance.\n\nLets coordinate on next steps.\n\nBest,\nAlice Agent',
     NOW() - INTERVAL '27 days', true, 1),

    (v_submission_1_id, 'demo-msg-011', 'email', 'inbound', 'Inspection Report - 123 Oak Street',
     'Alice,\n\nInspection completed. Attached is the full report. A few minor items but overall the property is in good condition. My clients are satisfied and waiving the inspection contingency.\n\nJohn',
     NOW() - INTERVAL '20 days', true, 2),

    (v_submission_1_id, 'demo-msg-012', 'email', 'outbound', 'RE: Inspection Report - 123 Oak Street',
     'John,\n\nThank you for the update. Great to hear the inspection went well. Ill forward to my client.\n\nAlice',
     NOW() - INTERVAL '20 days', false, 0),

    (v_submission_1_id, 'demo-msg-013', 'email', 'inbound', 'Appraisal Complete - 123 Oak Street',
     'Alice,\n\nAppraisal came in at $830,000 - above purchase price. We are cleared to close.\n\nJohn',
     NOW() - INTERVAL '12 days', true, 1),

    (v_submission_1_id, 'demo-msg-014', 'email', 'outbound', 'Closing Scheduled - 123 Oak Street',
     'All,\n\nClosing is scheduled for January 17th at 2pm at First American Title, 500 Wilshire Blvd.\n\nPlease bring valid ID and certified funds.\n\nBest,\nAlice Agent',
     NOW() - INTERVAL '8 days', false, 0),

    (v_submission_1_id, 'demo-msg-015', 'email', 'outbound', 'Congratulations! Closing Complete - 123 Oak Street',
     'Dear Robert,\n\nCongratulations on the successful sale of your property! The transaction has officially closed.\n\nIt was a pleasure working with you. Please dont hesitate to reach out if you need anything in the future or have referrals.\n\nBest regards,\nAlice Agent\nAcme Realty Group',
     NOW() - INTERVAL '5 days', true, 1);

  RAISE NOTICE 'Created 15 demo messages for submission 1';

  -- ============================================
  -- SAMPLE ATTACHMENTS (for submission 1)
  -- ============================================
  DELETE FROM submission_attachments
  WHERE submission_id = v_submission_1_id;

  INSERT INTO submission_attachments (submission_id, filename, mime_type, file_size_bytes, storage_path, document_type)
  VALUES
    (v_submission_1_id, 'listing_agreement_123_oak.pdf', 'application/pdf', 245000,
     v_org_id || '/' || v_submission_1_id || '/listing_agreement_123_oak.pdf', 'contract'),

    (v_submission_1_id, 'listing_agreement_signed.pdf', 'application/pdf', 312000,
     v_org_id || '/' || v_submission_1_id || '/listing_agreement_signed.pdf', 'contract'),

    (v_submission_1_id, 'offer_825k.pdf', 'application/pdf', 189000,
     v_org_id || '/' || v_submission_1_id || '/offer_825k.pdf', 'offer'),

    (v_submission_1_id, 'counter_offer_835k.pdf', 'application/pdf', 156000,
     v_org_id || '/' || v_submission_1_id || '/counter_offer_835k.pdf', 'offer'),

    (v_submission_1_id, 'accepted_offer_final.pdf', 'application/pdf', 298000,
     v_org_id || '/' || v_submission_1_id || '/accepted_offer_final.pdf', 'contract'),

    (v_submission_1_id, 'inspection_report.pdf', 'application/pdf', 2450000,
     v_org_id || '/' || v_submission_1_id || '/inspection_report.pdf', 'inspection'),

    (v_submission_1_id, 'appraisal_report.pdf', 'application/pdf', 1890000,
     v_org_id || '/' || v_submission_1_id || '/appraisal_report.pdf', 'appraisal'),

    (v_submission_1_id, 'closing_statement.pdf', 'application/pdf', 178000,
     v_org_id || '/' || v_submission_1_id || '/closing_statement.pdf', 'closing');

  RAISE NOTICE 'Created 8 demo attachments for submission 1';

  -- ============================================
  -- SAMPLE COMMENTS (broker feedback)
  -- ============================================
  -- Delete existing demo comments first
  DELETE FROM submission_comments
  WHERE submission_id IN (v_submission_1_id, v_submission_2_id, v_submission_4_id);

  -- Comments on submission 2 (needs_changes)
  INSERT INTO submission_comments (submission_id, user_id, content, is_internal)
  VALUES
    (v_submission_2_id, v_carol_id,
     'Please upload the missing inspection report. I can see it was referenced in the email thread but the actual document was not included.',
     false),
    (v_submission_2_id, v_carol_id,
     'Also need clarification on the contingency removal date - the email mentions 12/20 but the amendment shows 12/22.',
     false),
    (v_submission_2_id, v_carol_id,
     'Internal note: Watch this transaction - timeline is tight for month-end close.',
     true);

  RAISE NOTICE 'Created demo comments for submission 2';

  -- Comments on submission 4 (under_review)
  INSERT INTO submission_comments (submission_id, user_id, content, is_internal)
  VALUES
    (v_submission_4_id, v_carol_id,
     'High-value transaction - reviewing all documents carefully. Will complete review by EOD tomorrow.',
     true);

  RAISE NOTICE 'Created demo comments for submission 4';

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'DEMO SEED DATA COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Organization: Acme Realty Group (%)' , v_org_id;
  RAISE NOTICE 'Submissions created: 4';
  RAISE NOTICE 'Messages created: 15';
  RAISE NOTICE 'Attachments created: 8';
  RAISE NOTICE '';

END $$;
