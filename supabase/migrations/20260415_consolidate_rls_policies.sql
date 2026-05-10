-- ============================================================================
-- Migration: Consolidate multiple permissive RLS policies
-- BACKLOG-1636
--
-- Problem: 25 tables have multiple permissive policies for the same
-- command+role combination. PostgreSQL evaluates ALL permissive policies
-- with OR, so having multiple policies for the same role+command creates
-- unnecessary overhead.
--
-- Solution: Merge policies that share the same table+cmd+role into a single
-- policy with OR'd USING/WITH CHECK clauses. This preserves exact semantics
-- while reducing the number of policy evaluations.
--
-- Consolidation summary:
--   15 groups across 13 tables
--   35 policies merged down to 15
--   Net reduction: 20 policies
-- ============================================================================


-- ============================================================================
-- Table: audit_logs
-- Command: SELECT, Role: public
-- Merging: users_can_read_own_audit_logs, internal_users_can_read_all_audit_logs
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "users_can_read_own_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "internal_users_can_read_all_audit_logs" ON public.audit_logs;

CREATE POLICY "audit_logs_select_public" ON public.audit_logs
    FOR SELECT
    TO public
    USING (
        (( SELECT auth.uid() AS uid) = user_id)
        OR
        has_internal_role(auth.uid())
    );

COMMIT;

-- ROLLBACK for audit_logs SELECT public:
-- DROP POLICY IF EXISTS "audit_logs_select_public" ON public.audit_logs;
-- CREATE POLICY "users_can_read_own_audit_logs" ON public.audit_logs FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
-- CREATE POLICY "internal_users_can_read_all_audit_logs" ON public.audit_logs FOR SELECT TO public USING (has_internal_role(auth.uid()));


-- ============================================================================
-- Table: devices
-- Command: SELECT, Role: public
-- Merging: Users can read own devices, internal_users_can_read_all_devices
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Users can read own devices" ON public.devices;
DROP POLICY IF EXISTS "internal_users_can_read_all_devices" ON public.devices;

CREATE POLICY "devices_select_public" ON public.devices
    FOR SELECT
    TO public
    USING (
        (auth.uid() = user_id)
        OR
        has_internal_role(auth.uid())
    );

COMMIT;

-- ROLLBACK for devices SELECT public:
-- DROP POLICY IF EXISTS "devices_select_public" ON public.devices;
-- CREATE POLICY "Users can read own devices" ON public.devices FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "internal_users_can_read_all_devices" ON public.devices FOR SELECT TO public USING (has_internal_role(auth.uid()));


-- ============================================================================
-- Table: licenses
-- Command: SELECT, Role: public
-- Merging: Users can read own license, internal_users_can_read_all_licenses
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Users can read own license" ON public.licenses;
DROP POLICY IF EXISTS "internal_users_can_read_all_licenses" ON public.licenses;

CREATE POLICY "licenses_select_public" ON public.licenses
    FOR SELECT
    TO public
    USING (
        (auth.uid() = user_id)
        OR
        has_internal_role(auth.uid())
    );

COMMIT;

-- ROLLBACK for licenses SELECT public:
-- DROP POLICY IF EXISTS "licenses_select_public" ON public.licenses;
-- CREATE POLICY "Users can read own license" ON public.licenses FOR SELECT TO public USING ((auth.uid() = user_id));
-- CREATE POLICY "internal_users_can_read_all_licenses" ON public.licenses FOR SELECT TO public USING (has_internal_role(auth.uid()));


-- ============================================================================
-- Table: organization_members
-- Command: ALL, Role: public
-- Merging: admins_can_manage_members, service_role_full_access_members
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "admins_can_manage_members" ON public.organization_members;
DROP POLICY IF EXISTS "service_role_full_access_members" ON public.organization_members;

CREATE POLICY "organization_members_all_public" ON public.organization_members
    FOR ALL
    TO public
    USING (
        is_org_admin(auth.uid(), organization_id)
        OR
        (auth.role() = 'service_role'::text)
    );

COMMIT;

-- ROLLBACK for organization_members ALL public:
-- DROP POLICY IF EXISTS "organization_members_all_public" ON public.organization_members;
-- CREATE POLICY "admins_can_manage_members" ON public.organization_members FOR ALL TO public USING (is_org_admin(auth.uid(), organization_id));
-- CREATE POLICY "service_role_full_access_members" ON public.organization_members FOR ALL TO public USING ((auth.role() = 'service_role'::text));


-- ============================================================================
-- Table: organization_members
-- Command: SELECT, Role: public
-- Merging: internal_users_can_read_all_organization_members,
--          members_can_read_org_members, users_can_view_own_membership
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "internal_users_can_read_all_organization_members" ON public.organization_members;
DROP POLICY IF EXISTS "members_can_read_org_members" ON public.organization_members;
DROP POLICY IF EXISTS "users_can_view_own_membership" ON public.organization_members;

CREATE POLICY "organization_members_select_public" ON public.organization_members
    FOR SELECT
    TO public
    USING (
        has_internal_role(auth.uid())
        OR
        (organization_id IN ( SELECT get_user_org_ids(auth.uid()) AS get_user_org_ids))
        OR
        (user_id = auth.uid())
    );

COMMIT;

-- ROLLBACK for organization_members SELECT public:
-- DROP POLICY IF EXISTS "organization_members_select_public" ON public.organization_members;
-- CREATE POLICY "internal_users_can_read_all_organization_members" ON public.organization_members FOR SELECT TO public USING (has_internal_role(auth.uid()));
-- CREATE POLICY "members_can_read_org_members" ON public.organization_members FOR SELECT TO public USING ((organization_id IN ( SELECT get_user_org_ids(auth.uid()) AS get_user_org_ids)));
-- CREATE POLICY "users_can_view_own_membership" ON public.organization_members FOR SELECT TO public USING ((user_id = auth.uid()));


-- ============================================================================
-- Table: organization_plans
-- Command: SELECT, Role: authenticated
-- Merging: org_plans_admin_read, org_plans_read
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "org_plans_admin_read" ON public.organization_plans;
DROP POLICY IF EXISTS "org_plans_read" ON public.organization_plans;

CREATE POLICY "organization_plans_select_authenticated" ON public.organization_plans
    FOR SELECT
    TO authenticated
    USING (
        has_permission(auth.uid(), 'plans.view'::text)
        OR
        (organization_id IN ( SELECT organization_members.organization_id
           FROM organization_members
          WHERE (organization_members.user_id = auth.uid())))
    );

COMMIT;

-- ROLLBACK for organization_plans SELECT authenticated:
-- DROP POLICY IF EXISTS "organization_plans_select_authenticated" ON public.organization_plans;
-- CREATE POLICY "org_plans_admin_read" ON public.organization_plans FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'plans.view'::text));
-- CREATE POLICY "org_plans_read" ON public.organization_plans FOR SELECT TO authenticated USING ((organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE (organization_members.user_id = auth.uid()))));


-- ============================================================================
-- Table: organizations
-- Command: SELECT, Role: public
-- Merging: internal_users_can_read_all_organizations, members_can_read_org
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "internal_users_can_read_all_organizations" ON public.organizations;
DROP POLICY IF EXISTS "members_can_read_org" ON public.organizations;

CREATE POLICY "organizations_select_public" ON public.organizations
    FOR SELECT
    TO public
    USING (
        has_internal_role(auth.uid())
        OR
        (id IN ( SELECT organization_members.organization_id
           FROM organization_members
          WHERE (organization_members.user_id = auth.uid())))
    );

COMMIT;

-- ROLLBACK for organizations SELECT public:
-- DROP POLICY IF EXISTS "organizations_select_public" ON public.organizations;
-- CREATE POLICY "internal_users_can_read_all_organizations" ON public.organizations FOR SELECT TO public USING (has_internal_role(auth.uid()));
-- CREATE POLICY "members_can_read_org" ON public.organizations FOR SELECT TO public USING ((id IN ( SELECT organization_members.organization_id FROM organization_members WHERE (organization_members.user_id = auth.uid()))));


-- ============================================================================
-- Table: support_ticket_attachments
-- Command: SELECT, Role: public
-- Merging: Agents can view all attachments,
--          Customers can view attachments on own tickets
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Agents can view all attachments" ON public.support_ticket_attachments;
DROP POLICY IF EXISTS "Customers can view attachments on own tickets" ON public.support_ticket_attachments;

CREATE POLICY "support_ticket_attachments_select_public" ON public.support_ticket_attachments
    FOR SELECT
    TO public
    USING (
        -- Agents (internal users) can view all attachments
        (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))
        OR
        -- Customers can view attachments on own tickets (excluding internal notes)
        ((EXISTS ( SELECT 1
           FROM support_tickets t
          WHERE ((t.id = support_ticket_attachments.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email
                   FROM auth.users
                  WHERE (users.id = auth.uid())))::text))))) AND ((message_id IS NULL) OR (EXISTS ( SELECT 1
           FROM support_ticket_messages m
          WHERE ((m.id = support_ticket_attachments.message_id) AND (m.message_type <> 'internal_note'::text))))) AND (NOT (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))))
    );

COMMIT;

-- ROLLBACK for support_ticket_attachments SELECT public:
-- DROP POLICY IF EXISTS "support_ticket_attachments_select_public" ON public.support_ticket_attachments;
-- CREATE POLICY "Agents can view all attachments" ON public.support_ticket_attachments FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))));
-- CREATE POLICY "Customers can view attachments on own tickets" ON public.support_ticket_attachments FOR SELECT TO public USING (((EXISTS ( SELECT 1 FROM support_tickets t WHERE ((t.id = support_ticket_attachments.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email FROM auth.users WHERE (users.id = auth.uid())))::text))))) AND ((message_id IS NULL) OR (EXISTS ( SELECT 1 FROM support_ticket_messages m WHERE ((m.id = support_ticket_attachments.message_id) AND (m.message_type <> 'internal_note'::text))))) AND (NOT (EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))))));


-- ============================================================================
-- Table: support_ticket_events
-- Command: SELECT, Role: public
-- Merging: Agents can view all events,
--          Customers can view events on own tickets
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Agents can view all events" ON public.support_ticket_events;
DROP POLICY IF EXISTS "Customers can view events on own tickets" ON public.support_ticket_events;

CREATE POLICY "support_ticket_events_select_public" ON public.support_ticket_events
    FOR SELECT
    TO public
    USING (
        -- Agents (internal users) can view all events
        (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))
        OR
        -- Customers can view events on own tickets
        ((EXISTS ( SELECT 1
           FROM support_tickets t
          WHERE ((t.id = support_ticket_events.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email
                   FROM auth.users
                  WHERE (users.id = auth.uid())))::text))))) AND (NOT (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))))
    );

COMMIT;

-- ROLLBACK for support_ticket_events SELECT public:
-- DROP POLICY IF EXISTS "support_ticket_events_select_public" ON public.support_ticket_events;
-- CREATE POLICY "Agents can view all events" ON public.support_ticket_events FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))));
-- CREATE POLICY "Customers can view events on own tickets" ON public.support_ticket_events FOR SELECT TO public USING (((EXISTS ( SELECT 1 FROM support_tickets t WHERE ((t.id = support_ticket_events.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email FROM auth.users WHERE (users.id = auth.uid())))::text))))) AND (NOT (EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))))));


-- ============================================================================
-- Table: support_ticket_messages
-- Command: SELECT, Role: public
-- Merging: Agents can view all messages,
--          Customers can view public messages on own tickets
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Agents can view all messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Customers can view public messages on own tickets" ON public.support_ticket_messages;

CREATE POLICY "support_ticket_messages_select_public" ON public.support_ticket_messages
    FOR SELECT
    TO public
    USING (
        -- Agents (internal users) can view all messages
        (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))
        OR
        -- Customers can view public messages on own tickets
        ((message_type <> 'internal_note'::text) AND (EXISTS ( SELECT 1
           FROM support_tickets t
          WHERE ((t.id = support_ticket_messages.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email
                   FROM auth.users
                  WHERE (users.id = auth.uid())))::text))))) AND (NOT (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))))
    );

COMMIT;

-- ROLLBACK for support_ticket_messages SELECT public:
-- DROP POLICY IF EXISTS "support_ticket_messages_select_public" ON public.support_ticket_messages;
-- CREATE POLICY "Agents can view all messages" ON public.support_ticket_messages FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))));
-- CREATE POLICY "Customers can view public messages on own tickets" ON public.support_ticket_messages FOR SELECT TO public USING (((message_type <> 'internal_note'::text) AND (EXISTS ( SELECT 1 FROM support_tickets t WHERE ((t.id = support_ticket_messages.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email FROM auth.users WHERE (users.id = auth.uid())))::text))))) AND (NOT (EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))))));


-- ============================================================================
-- Table: support_ticket_participants
-- Command: SELECT, Role: public
-- Merging: Agents can view all participants,
--          Customers can view participants on own tickets
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Agents can view all participants" ON public.support_ticket_participants;
DROP POLICY IF EXISTS "Customers can view participants on own tickets" ON public.support_ticket_participants;

CREATE POLICY "support_ticket_participants_select_public" ON public.support_ticket_participants
    FOR SELECT
    TO public
    USING (
        -- Agents (internal users) can view all participants
        (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))
        OR
        -- Customers can view participants on own tickets
        ((EXISTS ( SELECT 1
           FROM support_tickets t
          WHERE ((t.id = support_ticket_participants.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email
                   FROM auth.users
                  WHERE (users.id = auth.uid())))::text))))) AND (NOT (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))))
    );

COMMIT;

-- ROLLBACK for support_ticket_participants SELECT public:
-- DROP POLICY IF EXISTS "support_ticket_participants_select_public" ON public.support_ticket_participants;
-- CREATE POLICY "Agents can view all participants" ON public.support_ticket_participants FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))));
-- CREATE POLICY "Customers can view participants on own tickets" ON public.support_ticket_participants FOR SELECT TO public USING (((EXISTS ( SELECT 1 FROM support_tickets t WHERE ((t.id = support_ticket_participants.ticket_id) AND ((t.requester_id = auth.uid()) OR (t.requester_email = (( SELECT users.email FROM auth.users WHERE (users.id = auth.uid())))::text))))) AND (NOT (EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))))));


-- ============================================================================
-- Table: support_tickets
-- Command: SELECT, Role: public
-- Merging: Agents can view all tickets,
--          Customers can view own tickets by email,
--          Customers can view own tickets by id
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Agents can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Customers can view own tickets by email" ON public.support_tickets;
DROP POLICY IF EXISTS "Customers can view own tickets by id" ON public.support_tickets;

CREATE POLICY "support_tickets_select_public" ON public.support_tickets
    FOR SELECT
    TO public
    USING (
        -- Agents (internal users) can view all tickets
        (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))
        OR
        -- Customers can view own tickets by email
        ((requester_email = (auth.jwt() ->> 'email'::text)) AND (NOT (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))))
        OR
        -- Customers can view own tickets by id
        ((requester_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
           FROM internal_roles
          WHERE (internal_roles.user_id = auth.uid())))))
    );

COMMIT;

-- ROLLBACK for support_tickets SELECT public:
-- DROP POLICY IF EXISTS "support_tickets_select_public" ON public.support_tickets;
-- CREATE POLICY "Agents can view all tickets" ON public.support_tickets FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))));
-- CREATE POLICY "Customers can view own tickets by email" ON public.support_tickets FOR SELECT TO public USING (((requester_email = (auth.jwt() ->> 'email'::text)) AND (NOT (EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))))));
-- CREATE POLICY "Customers can view own tickets by id" ON public.support_tickets FOR SELECT TO public USING (((requester_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1 FROM internal_roles WHERE (internal_roles.user_id = auth.uid()))))));


-- ============================================================================
-- Table: transaction_submissions
-- Command: SELECT, Role: public
-- Merging: agents_can_read_own_submissions, brokers_can_read_org_submissions
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "agents_can_read_own_submissions" ON public.transaction_submissions;
DROP POLICY IF EXISTS "brokers_can_read_org_submissions" ON public.transaction_submissions;

CREATE POLICY "transaction_submissions_select_public" ON public.transaction_submissions
    FOR SELECT
    TO public
    USING (
        (submitted_by = auth.uid())
        OR
        (organization_id IN ( SELECT organization_members.organization_id
           FROM organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND ((organization_members.role)::text = ANY ((ARRAY['broker'::character varying, 'admin'::character varying])::text[])))))
    );

COMMIT;

-- ROLLBACK for transaction_submissions SELECT public:
-- DROP POLICY IF EXISTS "transaction_submissions_select_public" ON public.transaction_submissions;
-- CREATE POLICY "agents_can_read_own_submissions" ON public.transaction_submissions FOR SELECT TO public USING ((submitted_by = auth.uid()));
-- CREATE POLICY "brokers_can_read_org_submissions" ON public.transaction_submissions FOR SELECT TO public USING ((organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND ((organization_members.role)::text = ANY ((ARRAY['broker'::character varying, 'admin'::character varying])::text[]))))));


-- ============================================================================
-- Table: transaction_submissions
-- Command: UPDATE, Role: public
-- Merging: agents_can_update_own_submissions, brokers_can_review_submissions
--
-- NOTE: agents_can_update_own_submissions has BOTH qual AND with_check.
--       brokers_can_review_submissions has ONLY qual (no with_check).
--       For the merged policy:
--       - USING = qual_a OR qual_b
--       - WITH CHECK = check_a OR qual_b (broker's NULL with_check means
--         the USING clause is used as with_check, so we use their qual)
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "agents_can_update_own_submissions" ON public.transaction_submissions;
DROP POLICY IF EXISTS "brokers_can_review_submissions" ON public.transaction_submissions;

CREATE POLICY "transaction_submissions_update_public" ON public.transaction_submissions
    FOR UPDATE
    TO public
    USING (
        -- Agents can update own submissions in specific statuses
        ((submitted_by = auth.uid()) AND ((status)::text = ANY (ARRAY['needs_changes'::text, 'uploading'::text])))
        OR
        -- Brokers can review org submissions
        (organization_id IN ( SELECT organization_members.organization_id
           FROM organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND ((organization_members.role)::text = ANY ((ARRAY['broker'::character varying, 'admin'::character varying])::text[])))))
    )
    WITH CHECK (
        -- Agents can update to specific statuses
        ((submitted_by = auth.uid()) AND ((status)::text = ANY (ARRAY['needs_changes'::text, 'resubmitted'::text, 'uploading'::text, 'submitted'::text])))
        OR
        -- Brokers can review (no with_check restriction = same as USING)
        (organization_id IN ( SELECT organization_members.organization_id
           FROM organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND ((organization_members.role)::text = ANY ((ARRAY['broker'::character varying, 'admin'::character varying])::text[])))))
    );

COMMIT;

-- ROLLBACK for transaction_submissions UPDATE public:
-- DROP POLICY IF EXISTS "transaction_submissions_update_public" ON public.transaction_submissions;
-- CREATE POLICY "agents_can_update_own_submissions" ON public.transaction_submissions FOR UPDATE TO public USING (((submitted_by = auth.uid()) AND ((status)::text = ANY (ARRAY['needs_changes'::text, 'uploading'::text])))) WITH CHECK (((submitted_by = auth.uid()) AND ((status)::text = ANY (ARRAY['needs_changes'::text, 'resubmitted'::text, 'uploading'::text, 'submitted'::text]))));
-- CREATE POLICY "brokers_can_review_submissions" ON public.transaction_submissions FOR UPDATE TO public USING ((organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE ((organization_members.user_id = auth.uid()) AND ((organization_members.role)::text = ANY ((ARRAY['broker'::character varying, 'admin'::character varying])::text[]))))));


-- ============================================================================
-- Table: users
-- Command: SELECT, Role: public
-- Merging: internal_users_can_read_all_users,
--          org_members_can_read_org_users, users_can_read_own_user
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "internal_users_can_read_all_users" ON public.users;
DROP POLICY IF EXISTS "org_members_can_read_org_users" ON public.users;
DROP POLICY IF EXISTS "users_can_read_own_user" ON public.users;

CREATE POLICY "users_select_public" ON public.users
    FOR SELECT
    TO public
    USING (
        has_internal_role(auth.uid())
        OR
        (id IN ( SELECT om.user_id
           FROM organization_members om
          WHERE ((om.organization_id IN ( SELECT organization_members.organization_id
                   FROM organization_members
                  WHERE (organization_members.user_id = auth.uid()))) AND (om.user_id IS NOT NULL))))
        OR
        (( SELECT auth.uid() AS uid) = id)
    );

COMMIT;

-- ROLLBACK for users SELECT public:
-- DROP POLICY IF EXISTS "users_select_public" ON public.users;
-- CREATE POLICY "internal_users_can_read_all_users" ON public.users FOR SELECT TO public USING (has_internal_role(auth.uid()));
-- CREATE POLICY "org_members_can_read_org_users" ON public.users FOR SELECT TO public USING ((id IN ( SELECT om.user_id FROM organization_members om WHERE ((om.organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE (organization_members.user_id = auth.uid()))) AND (om.user_id IS NOT NULL)))));
-- CREATE POLICY "users_can_read_own_user" ON public.users FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = id));
