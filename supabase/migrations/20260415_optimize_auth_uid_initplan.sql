-- Migration: Optimize auth.uid() initplan queries
-- BACKLOG-1637
--
-- Problem: Direct auth.uid() calls in RLS policies create separate "initplan"
-- subqueries per policy evaluation. Wrapping in (select auth.uid()) caches the
-- result for the entire query, significantly reducing overhead.
--
-- This migration recreates all policies that use bare auth.uid() with the
-- optimized (select auth.uid()) pattern. Policies already using the wrapped
-- form are skipped.
--
-- Rollback: Each section includes the original policy as a comment.

BEGIN;

-- ============================================================================
-- Table: admin_audit_logs
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "Internal users can view admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Internal users can view admin audit logs" ON public.admin_audit_logs
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: admin_permissions
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "Internal users can view permissions" ON public.admin_permissions;
CREATE POLICY "Internal users can view permissions" ON public.admin_permissions
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: admin_role_permissions
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "Internal users can view role permissions" ON public.admin_role_permissions;
CREATE POLICY "Internal users can view role permissions" ON public.admin_role_permissions
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- Original: ir.user_id = auth.uid()
DROP POLICY IF EXISTS "Super admins can delete role permissions" ON public.admin_role_permissions;
CREATE POLICY "Super admins can delete role permissions" ON public.admin_role_permissions
    FOR DELETE
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_roles ar ON ar.id = ir.role_id
        WHERE ir.user_id = (select auth.uid()) AND ar.is_system = true
    ));

-- Original: ir.user_id = auth.uid()
DROP POLICY IF EXISTS "Super admins can insert role permissions" ON public.admin_role_permissions;
CREATE POLICY "Super admins can insert role permissions" ON public.admin_role_permissions
    FOR INSERT
    TO public
    WITH CHECK (EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_roles ar ON ar.id = ir.role_id
        WHERE ir.user_id = (select auth.uid()) AND ar.is_system = true
    ));

-- ============================================================================
-- Table: admin_roles
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "Internal users can view roles" ON public.admin_roles;
CREATE POLICY "Internal users can view roles" ON public.admin_roles
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- Original: ir.user_id = auth.uid()
DROP POLICY IF EXISTS "Super admins can delete non-system roles" ON public.admin_roles;
CREATE POLICY "Super admins can delete non-system roles" ON public.admin_roles
    FOR DELETE
    TO public
    USING (NOT is_system AND EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_roles ar ON ar.id = ir.role_id
        WHERE ir.user_id = (select auth.uid()) AND ar.is_system = true
    ));

-- Original: ir.user_id = auth.uid()
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.admin_roles;
CREATE POLICY "Super admins can insert roles" ON public.admin_roles
    FOR INSERT
    TO public
    WITH CHECK (EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_roles ar ON ar.id = ir.role_id
        WHERE ir.user_id = (select auth.uid()) AND ar.is_system = true
    ));

-- Original: ir.user_id = auth.uid()
DROP POLICY IF EXISTS "Super admins can update roles" ON public.admin_roles;
CREATE POLICY "Super admins can update roles" ON public.admin_roles
    FOR UPDATE
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_roles ar ON ar.id = ir.role_id
        WHERE ir.user_id = (select auth.uid()) AND ar.is_system = true
    ));

-- ============================================================================
-- Table: audit_logs
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_all_audit_logs" ON public.audit_logs;
CREATE POLICY "internal_users_can_read_all_audit_logs" ON public.audit_logs
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- NOTE: users_can_read_own_audit_logs already uses (SELECT auth.uid()) - SKIPPED

-- ============================================================================
-- Table: devices
-- ============================================================================

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can delete own devices" ON public.devices;
CREATE POLICY "Users can delete own devices" ON public.devices
    FOR DELETE
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;
CREATE POLICY "Users can insert own devices" ON public.devices
    FOR INSERT
    TO public
    WITH CHECK ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can read own devices" ON public.devices;
CREATE POLICY "Users can read own devices" ON public.devices
    FOR SELECT
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
CREATE POLICY "Users can update own devices" ON public.devices
    FOR UPDATE
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_all_devices" ON public.devices;
CREATE POLICY "internal_users_can_read_all_devices" ON public.devices
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: email_delivery_log
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read logs" ON public.email_delivery_log;
CREATE POLICY "Internal users can read logs" ON public.email_delivery_log
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: error_logs
-- ============================================================================

-- Original: user_id = auth.uid()
DROP POLICY IF EXISTS "users_can_read_own_error_logs" ON public.error_logs;
CREATE POLICY "users_can_read_own_error_logs" ON public.error_logs
    FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()));

-- ============================================================================
-- Table: impersonation_sessions
-- ============================================================================

-- Original: admin_user_id = auth.uid() AND has_internal_role(auth.uid())
DROP POLICY IF EXISTS "Internal users can view their own sessions" ON public.impersonation_sessions;
CREATE POLICY "Internal users can view their own sessions" ON public.impersonation_sessions
    FOR SELECT
    TO public
    USING (admin_user_id = (select auth.uid()) AND has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: individual_invitations
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_individual_invitations" ON public.individual_invitations;
CREATE POLICY "internal_users_can_read_individual_invitations" ON public.individual_invitations
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: internal_roles
-- ============================================================================

-- Original: is_super_admin(auth.uid())
DROP POLICY IF EXISTS "Super admins can manage internal roles" ON public.internal_roles;
CREATE POLICY "Super admins can manage internal roles" ON public.internal_roles
    FOR ALL
    TO public
    USING (is_super_admin((select auth.uid())));

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can read own internal role" ON public.internal_roles;
CREATE POLICY "Users can read own internal role" ON public.internal_roles
    FOR SELECT
    TO public
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- Table: iphone_sync_devices
-- ============================================================================

-- Original: auth.uid() = user_id (USING and WITH CHECK)
DROP POLICY IF EXISTS "Users can manage own iPhone sync devices" ON public.iphone_sync_devices;
CREATE POLICY "Users can manage own iPhone sync devices" ON public.iphone_sync_devices
    FOR ALL
    TO public
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- Table: licenses
-- ============================================================================

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can insert own license" ON public.licenses;
CREATE POLICY "Users can insert own license" ON public.licenses
    FOR INSERT
    TO public
    WITH CHECK ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can read own license" ON public.licenses;
CREATE POLICY "Users can read own license" ON public.licenses
    FOR SELECT
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can update own license" ON public.licenses;
CREATE POLICY "Users can update own license" ON public.licenses
    FOR UPDATE
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_all_licenses" ON public.licenses;
CREATE POLICY "internal_users_can_read_all_licenses" ON public.licenses
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: organization_identity_providers
-- ============================================================================

-- Original: om.user_id = auth.uid()
DROP POLICY IF EXISTS "IT admins can manage identity providers" ON public.organization_identity_providers;
CREATE POLICY "IT admins can manage identity providers" ON public.organization_identity_providers
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = organization_identity_providers.organization_id
        AND om.user_id = (select auth.uid())
        AND om.role::text = 'it_admin'::text
        AND om.license_status::text = 'active'::text
    ));

-- Original: om.user_id = auth.uid()
DROP POLICY IF EXISTS "Org admins can view identity providers" ON public.organization_identity_providers;
CREATE POLICY "Org admins can view identity providers" ON public.organization_identity_providers
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = organization_identity_providers.organization_id
        AND om.user_id = (select auth.uid())
        AND om.role::text = ANY (ARRAY['admin'::character varying, 'it_admin'::character varying]::text[])
        AND om.license_status::text = 'active'::text
    ));

-- ============================================================================
-- Table: organization_members
-- ============================================================================

-- Original: is_org_admin(auth.uid(), organization_id)
DROP POLICY IF EXISTS "admins_can_manage_members" ON public.organization_members;
CREATE POLICY "admins_can_manage_members" ON public.organization_members
    FOR ALL
    TO public
    USING (is_org_admin((select auth.uid()), organization_id));

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_all_organization_members" ON public.organization_members;
CREATE POLICY "internal_users_can_read_all_organization_members" ON public.organization_members
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- Original: get_user_org_ids(auth.uid())
DROP POLICY IF EXISTS "members_can_read_org_members" ON public.organization_members;
CREATE POLICY "members_can_read_org_members" ON public.organization_members
    FOR SELECT
    TO public
    USING (organization_id IN (SELECT get_user_org_ids((select auth.uid()))));

-- Original: users.id = auth.uid()
DROP POLICY IF EXISTS "users_can_accept_invite" ON public.organization_members;
CREATE POLICY "users_can_accept_invite" ON public.organization_members
    FOR UPDATE
    TO public
    USING (invited_email = (SELECT users.email
        FROM auth.users
        WHERE users.id = (select auth.uid()))::text);

-- Original: user_id = auth.uid()
DROP POLICY IF EXISTS "users_can_view_own_membership" ON public.organization_members;
CREATE POLICY "users_can_view_own_membership" ON public.organization_members
    FOR SELECT
    TO public
    USING (user_id = (select auth.uid()));

-- ============================================================================
-- Table: organization_plans
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_org_plans" ON public.organization_plans;
CREATE POLICY "internal_users_can_read_org_plans" ON public.organization_plans
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- Original: has_permission(auth.uid(), 'plans.view')
DROP POLICY IF EXISTS "org_plans_admin_read" ON public.organization_plans;
CREATE POLICY "org_plans_admin_read" ON public.organization_plans
    FOR SELECT
    TO authenticated
    USING (has_permission((select auth.uid()), 'plans.view'::text));

-- Original: organization_members.user_id = auth.uid()
DROP POLICY IF EXISTS "org_plans_read" ON public.organization_plans;
CREATE POLICY "org_plans_read" ON public.organization_plans
    FOR SELECT
    TO authenticated
    USING (organization_id IN (
        SELECT organization_members.organization_id
        FROM organization_members
        WHERE organization_members.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: organizations
-- ============================================================================

-- Original: organization_members.user_id = auth.uid()
DROP POLICY IF EXISTS "admins_can_modify_org" ON public.organizations;
CREATE POLICY "admins_can_modify_org" ON public.organizations
    FOR UPDATE
    TO public
    USING (id IN (
        SELECT organization_members.organization_id
        FROM organization_members
        WHERE organization_members.user_id = (select auth.uid())
        AND organization_members.role::text = ANY (ARRAY['admin'::character varying, 'it_admin'::character varying]::text[])
    ));

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_all_organizations" ON public.organizations;
CREATE POLICY "internal_users_can_read_all_organizations" ON public.organizations
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- Original: organization_members.user_id = auth.uid()
DROP POLICY IF EXISTS "members_can_read_org" ON public.organizations;
CREATE POLICY "members_can_read_org" ON public.organizations
    FOR SELECT
    TO public
    USING (id IN (
        SELECT organization_members.organization_id
        FROM organization_members
        WHERE organization_members.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pending_internal_invitations
-- ============================================================================

-- Original: has_internal_role(auth.uid()) (USING and WITH CHECK)
DROP POLICY IF EXISTS "internal_users_can_manage_invitations" ON public.pending_internal_invitations;
CREATE POLICY "internal_users_can_manage_invitations" ON public.pending_internal_invitations
    FOR ALL
    TO public
    USING (has_internal_role((select auth.uid())))
    WITH CHECK (has_internal_role((select auth.uid())));

-- ============================================================================
-- Table: pm_attachments
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_attachments" ON public.pm_attachments;
CREATE POLICY "Internal users can read pm_attachments" ON public.pm_attachments
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_backlog_items
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_backlog_items" ON public.pm_backlog_items;
CREATE POLICY "Internal users can read pm_backlog_items" ON public.pm_backlog_items
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_changelog
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_changelog" ON public.pm_changelog;
CREATE POLICY "Internal users can read pm_changelog" ON public.pm_changelog
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_comments
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_comments" ON public.pm_comments;
CREATE POLICY "Internal users can read pm_comments" ON public.pm_comments
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_dependencies
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_dependencies" ON public.pm_dependencies;
CREATE POLICY "Internal users can read pm_dependencies" ON public.pm_dependencies
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_events
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_events" ON public.pm_events;
CREATE POLICY "Internal users can read pm_events" ON public.pm_events
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_item_labels
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_item_labels" ON public.pm_item_labels;
CREATE POLICY "Internal users can read pm_item_labels" ON public.pm_item_labels
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_labels
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_labels" ON public.pm_labels;
CREATE POLICY "Internal users can read pm_labels" ON public.pm_labels
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_projects
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_projects" ON public.pm_projects;
CREATE POLICY "Internal users can read pm_projects" ON public.pm_projects
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_saved_views
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid() AND user_id = auth.uid()
DROP POLICY IF EXISTS "Users can read own or shared saved views" ON public.pm_saved_views;
CREATE POLICY "Users can read own or shared saved views" ON public.pm_saved_views
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
        AND (user_id = (select auth.uid()) OR is_shared = true)
    );

-- ============================================================================
-- Table: pm_sprints
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_sprints" ON public.pm_sprints;
CREATE POLICY "Internal users can read pm_sprints" ON public.pm_sprints
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_task_links
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_task_links" ON public.pm_task_links;
CREATE POLICY "Internal users can read pm_task_links" ON public.pm_task_links
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_tasks
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_tasks" ON public.pm_tasks;
CREATE POLICY "Internal users can read pm_tasks" ON public.pm_tasks
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: pm_token_metrics
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Internal users can read pm_token_metrics" ON public.pm_token_metrics;
CREATE POLICY "Internal users can read pm_token_metrics" ON public.pm_token_metrics
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- ============================================================================
-- Table: profiles
-- ============================================================================

-- Original: id = auth.uid()
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.profiles;
CREATE POLICY "users_can_read_own_profile" ON public.profiles
    FOR SELECT
    TO public
    USING (id = (select auth.uid()));

-- Original: id = auth.uid()
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
CREATE POLICY "users_can_update_own_profile" ON public.profiles
    FOR UPDATE
    TO public
    USING (id = (select auth.uid()));

-- ============================================================================
-- Table: scim_sync_log
-- ============================================================================

-- Original: om.user_id = auth.uid()
DROP POLICY IF EXISTS "Admins can view SCIM sync logs" ON public.scim_sync_log;
CREATE POLICY "Admins can view SCIM sync logs" ON public.scim_sync_log
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = scim_sync_log.organization_id
        AND om.user_id = (select auth.uid())
        AND om.role::text = ANY (ARRAY['admin'::character varying, 'it_admin'::character varying]::text[])
        AND om.license_status::text = 'active'::text
    ));

-- ============================================================================
-- Table: scim_tokens
-- ============================================================================

-- Original: om.user_id = auth.uid()
DROP POLICY IF EXISTS "IT admins can manage SCIM tokens" ON public.scim_tokens;
CREATE POLICY "IT admins can manage SCIM tokens" ON public.scim_tokens
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = scim_tokens.organization_id
        AND om.user_id = (select auth.uid())
        AND om.role::text = 'it_admin'::text
        AND om.license_status::text = 'active'::text
    ));

-- ============================================================================
-- Table: submission_attachments
-- ============================================================================

-- Original: transaction_submissions.submitted_by = auth.uid()
DROP POLICY IF EXISTS "agents_can_delete_own_attachments" ON public.submission_attachments;
CREATE POLICY "agents_can_delete_own_attachments" ON public.submission_attachments
    FOR DELETE
    TO public
    USING (submission_id IN (
        SELECT transaction_submissions.id
        FROM transaction_submissions
        WHERE transaction_submissions.submitted_by = (select auth.uid())
        AND transaction_submissions.status::text = 'uploading'::text
    ));

-- Original: transaction_submissions.submitted_by = auth.uid()
DROP POLICY IF EXISTS "agents_can_insert_attachments" ON public.submission_attachments;
CREATE POLICY "agents_can_insert_attachments" ON public.submission_attachments
    FOR INSERT
    TO public
    WITH CHECK (submission_id IN (
        SELECT transaction_submissions.id
        FROM transaction_submissions
        WHERE transaction_submissions.submitted_by = (select auth.uid())
    ));

-- Original: ts.submitted_by = auth.uid() and om.user_id = auth.uid()
DROP POLICY IF EXISTS "attachment_access_via_submission" ON public.submission_attachments;
CREATE POLICY "attachment_access_via_submission" ON public.submission_attachments
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM transaction_submissions ts
        WHERE ts.id = submission_attachments.submission_id
        AND (
            ts.submitted_by = (select auth.uid())
            OR EXISTS (
                SELECT 1
                FROM organization_members om
                WHERE om.organization_id = ts.organization_id
                AND om.user_id = (select auth.uid())
                AND om.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
            )
        )
    ));

-- ============================================================================
-- Table: submission_comments
-- ============================================================================

-- Original: multiple auth.uid() references
DROP POLICY IF EXISTS "comment_access_via_submission" ON public.submission_comments;
CREATE POLICY "comment_access_via_submission" ON public.submission_comments
    FOR SELECT
    TO public
    USING (
        submission_id IN (
            SELECT transaction_submissions.id
            FROM transaction_submissions
            WHERE transaction_submissions.submitted_by = (select auth.uid())
            OR transaction_submissions.organization_id IN (
                SELECT organization_members.organization_id
                FROM organization_members
                WHERE organization_members.user_id = (select auth.uid())
                AND organization_members.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
            )
        )
        AND (
            is_internal = false
            OR submission_id IN (
                SELECT ts.id
                FROM transaction_submissions ts
                JOIN organization_members om ON ts.organization_id = om.organization_id
                WHERE om.user_id = (select auth.uid())
                AND om.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
            )
        )
    );

-- Original: user_id = auth.uid() and multiple auth.uid() in subqueries
DROP POLICY IF EXISTS "users_can_create_comments" ON public.submission_comments;
CREATE POLICY "users_can_create_comments" ON public.submission_comments
    FOR INSERT
    TO public
    WITH CHECK (
        user_id = (select auth.uid())
        AND submission_id IN (
            SELECT transaction_submissions.id
            FROM transaction_submissions
            WHERE transaction_submissions.submitted_by = (select auth.uid())
            OR transaction_submissions.organization_id IN (
                SELECT organization_members.organization_id
                FROM organization_members
                WHERE organization_members.user_id = (select auth.uid())
                AND organization_members.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
            )
        )
    );

-- ============================================================================
-- Table: submission_messages
-- ============================================================================

-- Original: transaction_submissions.submitted_by = auth.uid()
DROP POLICY IF EXISTS "agents_can_insert_messages" ON public.submission_messages;
CREATE POLICY "agents_can_insert_messages" ON public.submission_messages
    FOR INSERT
    TO public
    WITH CHECK (submission_id IN (
        SELECT transaction_submissions.id
        FROM transaction_submissions
        WHERE transaction_submissions.submitted_by = (select auth.uid())
    ));

-- Original: ts.submitted_by = auth.uid() and om.user_id = auth.uid()
DROP POLICY IF EXISTS "message_access_via_submission" ON public.submission_messages;
CREATE POLICY "message_access_via_submission" ON public.submission_messages
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM transaction_submissions ts
        WHERE ts.id = submission_messages.submission_id
        AND (
            ts.submitted_by = (select auth.uid())
            OR EXISTS (
                SELECT 1
                FROM organization_members om
                WHERE om.organization_id = ts.organization_id
                AND om.user_id = (select auth.uid())
                AND om.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
            )
        )
    ));

-- ============================================================================
-- Table: support_response_templates
-- ============================================================================

-- Original: ir.user_id = auth.uid() (USING and WITH CHECK)
DROP POLICY IF EXISTS "support_templates_manage" ON public.support_response_templates;
CREATE POLICY "support_templates_manage" ON public.support_response_templates
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
        JOIN admin_permissions ap ON ap.id = arp.permission_id
        WHERE ir.user_id = (select auth.uid())
        AND ap.key = ANY (ARRAY['support.manage'::text, 'support.admin'::text])
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM internal_roles ir
        JOIN admin_role_permissions arp ON arp.role_id = ir.role_id
        JOIN admin_permissions ap ON ap.id = arp.permission_id
        WHERE ir.user_id = (select auth.uid())
        AND ap.key = ANY (ARRAY['support.manage'::text, 'support.admin'::text])
    ));

-- ============================================================================
-- Table: support_saved_views
-- ============================================================================

-- Original: user_id = auth.uid()
DROP POLICY IF EXISTS "Users can delete own support views" ON public.support_saved_views;
CREATE POLICY "Users can delete own support views" ON public.support_saved_views
    FOR DELETE
    TO public
    USING (user_id = (select auth.uid()));

-- Original: user_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert own support views" ON public.support_saved_views;
CREATE POLICY "Users can insert own support views" ON public.support_saved_views
    FOR INSERT
    TO public
    WITH CHECK (user_id = (select auth.uid()));

-- Original: user_id = auth.uid()
DROP POLICY IF EXISTS "Users can view own and shared support views" ON public.support_saved_views;
CREATE POLICY "Users can view own and shared support views" ON public.support_saved_views
    FOR SELECT
    TO public
    USING (user_id = (select auth.uid()) OR is_shared = true);

-- ============================================================================
-- Table: support_ticket_attachments
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Agents can view all attachments" ON public.support_ticket_attachments;
CREATE POLICY "Agents can view all attachments" ON public.support_ticket_attachments
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- Original: multiple auth.uid() references
DROP POLICY IF EXISTS "Customers can view attachments on own tickets" ON public.support_ticket_attachments;
CREATE POLICY "Customers can view attachments on own tickets" ON public.support_ticket_attachments
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM support_tickets t
            WHERE t.id = support_ticket_attachments.ticket_id
            AND (
                t.requester_id = (select auth.uid())
                OR t.requester_email = (SELECT users.email FROM auth.users WHERE users.id = (select auth.uid()))::text
            )
        )
        AND (
            message_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM support_ticket_messages m
                WHERE m.id = support_ticket_attachments.message_id
                AND m.message_type <> 'internal_note'::text
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- Table: support_ticket_backlog_links
-- ============================================================================

-- Original: om.user_id = auth.uid() (USING and WITH CHECK)
DROP POLICY IF EXISTS "Admins can manage links" ON public.support_ticket_backlog_links;
CREATE POLICY "Admins can manage links" ON public.support_ticket_backlog_links
    FOR ALL
    TO public
    USING (EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = (select auth.uid())
        AND om.role::text = ANY (ARRAY['admin'::character varying, 'super_admin'::character varying]::text[])
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.user_id = (select auth.uid())
        AND om.role::text = ANY (ARRAY['admin'::character varying, 'super_admin'::character varying]::text[])
    ));

-- Original: auth.uid() IS NOT NULL
DROP POLICY IF EXISTS "Authenticated users can read links" ON public.support_ticket_backlog_links;
CREATE POLICY "Authenticated users can read links" ON public.support_ticket_backlog_links
    FOR SELECT
    TO public
    USING ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- Table: support_ticket_events
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Agents can view all events" ON public.support_ticket_events;
CREATE POLICY "Agents can view all events" ON public.support_ticket_events
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- Original: multiple auth.uid() references
DROP POLICY IF EXISTS "Customers can view events on own tickets" ON public.support_ticket_events;
CREATE POLICY "Customers can view events on own tickets" ON public.support_ticket_events
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM support_tickets t
            WHERE t.id = support_ticket_events.ticket_id
            AND (
                t.requester_id = (select auth.uid())
                OR t.requester_email = (SELECT users.email FROM auth.users WHERE users.id = (select auth.uid()))::text
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- Table: support_ticket_links
-- ============================================================================

-- Original: st.requester_id = auth.uid() OR st.assignee_id = auth.uid()
DROP POLICY IF EXISTS "Users can delete ticket links for their org tickets" ON public.support_ticket_links;
CREATE POLICY "Users can delete ticket links for their org tickets" ON public.support_ticket_links
    FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM support_tickets st
        WHERE st.id = support_ticket_links.ticket_id
        AND (st.requester_id = (select auth.uid()) OR st.assignee_id = (select auth.uid()))
    ));

-- Original: st.requester_id = auth.uid() OR st.assignee_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert ticket links for their org tickets" ON public.support_ticket_links;
CREATE POLICY "Users can insert ticket links for their org tickets" ON public.support_ticket_links
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1
        FROM support_tickets st
        WHERE st.id = support_ticket_links.ticket_id
        AND (st.requester_id = (select auth.uid()) OR st.assignee_id = (select auth.uid()))
    ));

-- Original: st.requester_id = auth.uid() OR st.assignee_id = auth.uid()
DROP POLICY IF EXISTS "Users can view ticket links for their org tickets" ON public.support_ticket_links;
CREATE POLICY "Users can view ticket links for their org tickets" ON public.support_ticket_links
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM support_tickets st
        WHERE st.id = support_ticket_links.ticket_id
        AND (st.requester_id = (select auth.uid()) OR st.assignee_id = (select auth.uid()))
    ));

-- ============================================================================
-- Table: support_ticket_messages
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Agents can view all messages" ON public.support_ticket_messages;
CREATE POLICY "Agents can view all messages" ON public.support_ticket_messages
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- Original: multiple auth.uid() references
DROP POLICY IF EXISTS "Customers can view public messages on own tickets" ON public.support_ticket_messages;
CREATE POLICY "Customers can view public messages on own tickets" ON public.support_ticket_messages
    FOR SELECT
    TO public
    USING (
        message_type <> 'internal_note'::text
        AND EXISTS (
            SELECT 1
            FROM support_tickets t
            WHERE t.id = support_ticket_messages.ticket_id
            AND (
                t.requester_id = (select auth.uid())
                OR t.requester_email = (SELECT users.email FROM auth.users WHERE users.id = (select auth.uid()))::text
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- Table: support_ticket_participants
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Agents can view all participants" ON public.support_ticket_participants;
CREATE POLICY "Agents can view all participants" ON public.support_ticket_participants
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- Original: multiple auth.uid() references
DROP POLICY IF EXISTS "Customers can view participants on own tickets" ON public.support_ticket_participants;
CREATE POLICY "Customers can view participants on own tickets" ON public.support_ticket_participants
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM support_tickets t
            WHERE t.id = support_ticket_participants.ticket_id
            AND (
                t.requester_id = (select auth.uid())
                OR t.requester_email = (SELECT users.email FROM auth.users WHERE users.id = (select auth.uid()))::text
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- Table: support_tickets
-- ============================================================================

-- Original: internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Agents can view all tickets" ON public.support_tickets;
CREATE POLICY "Agents can view all tickets" ON public.support_tickets
    FOR SELECT
    TO public
    USING (EXISTS (
        SELECT 1
        FROM internal_roles
        WHERE internal_roles.user_id = (select auth.uid())
    ));

-- Original: internal_roles.user_id = auth.uid()
-- NOTE: This policy uses auth.jwt() for requester_email check but auth.uid() for internal_roles
DROP POLICY IF EXISTS "Customers can view own tickets by email" ON public.support_tickets;
CREATE POLICY "Customers can view own tickets by email" ON public.support_tickets
    FOR SELECT
    TO public
    USING (
        requester_email = (auth.jwt() ->> 'email'::text)
        AND NOT EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
    );

-- Original: requester_id = auth.uid() and internal_roles.user_id = auth.uid()
DROP POLICY IF EXISTS "Customers can view own tickets by id" ON public.support_tickets;
CREATE POLICY "Customers can view own tickets by id" ON public.support_tickets
    FOR SELECT
    TO public
    USING (
        requester_id = (select auth.uid())
        AND NOT EXISTS (
            SELECT 1
            FROM internal_roles
            WHERE internal_roles.user_id = (select auth.uid())
        )
    );

-- ============================================================================
-- Table: token_claims
-- ============================================================================

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "Users can read their own unclaimed non-expired claims" ON public.token_claims;
CREATE POLICY "Users can read their own unclaimed non-expired claims" ON public.token_claims
    FOR SELECT
    TO public
    USING ((select auth.uid()) = user_id AND claimed_at IS NULL AND expires_at > now());

-- ============================================================================
-- Table: transaction_submissions
-- ============================================================================

-- Original: submitted_by = auth.uid() and organization_members.user_id = auth.uid()
DROP POLICY IF EXISTS "agents_can_create_submissions" ON public.transaction_submissions;
CREATE POLICY "agents_can_create_submissions" ON public.transaction_submissions
    FOR INSERT
    TO public
    WITH CHECK (
        submitted_by = (select auth.uid())
        AND organization_id IN (
            SELECT organization_members.organization_id
            FROM organization_members
            WHERE organization_members.user_id = (select auth.uid())
        )
    );

-- Original: submitted_by = auth.uid()
DROP POLICY IF EXISTS "agents_can_delete_stale_uploads" ON public.transaction_submissions;
CREATE POLICY "agents_can_delete_stale_uploads" ON public.transaction_submissions
    FOR DELETE
    TO public
    USING (submitted_by = (select auth.uid()) AND status::text = 'uploading'::text);

-- Original: submitted_by = auth.uid()
DROP POLICY IF EXISTS "agents_can_read_own_submissions" ON public.transaction_submissions;
CREATE POLICY "agents_can_read_own_submissions" ON public.transaction_submissions
    FOR SELECT
    TO public
    USING (submitted_by = (select auth.uid()));

-- Original: submitted_by = auth.uid() (USING and WITH CHECK)
DROP POLICY IF EXISTS "agents_can_update_own_submissions" ON public.transaction_submissions;
CREATE POLICY "agents_can_update_own_submissions" ON public.transaction_submissions
    FOR UPDATE
    TO public
    USING (
        submitted_by = (select auth.uid())
        AND status::text = ANY (ARRAY['needs_changes'::text, 'uploading'::text])
    )
    WITH CHECK (
        submitted_by = (select auth.uid())
        AND status::text = ANY (ARRAY['needs_changes'::text, 'resubmitted'::text, 'uploading'::text, 'submitted'::text])
    );

-- Original: organization_members.user_id = auth.uid()
DROP POLICY IF EXISTS "brokers_can_read_org_submissions" ON public.transaction_submissions;
CREATE POLICY "brokers_can_read_org_submissions" ON public.transaction_submissions
    FOR SELECT
    TO public
    USING (organization_id IN (
        SELECT organization_members.organization_id
        FROM organization_members
        WHERE organization_members.user_id = (select auth.uid())
        AND organization_members.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
    ));

-- Original: organization_members.user_id = auth.uid()
DROP POLICY IF EXISTS "brokers_can_review_submissions" ON public.transaction_submissions;
CREATE POLICY "brokers_can_review_submissions" ON public.transaction_submissions
    FOR UPDATE
    TO public
    USING (organization_id IN (
        SELECT organization_members.organization_id
        FROM organization_members
        WHERE organization_members.user_id = (select auth.uid())
        AND organization_members.role::text = ANY (ARRAY['broker'::character varying, 'admin'::character varying]::text[])
    ));

-- ============================================================================
-- Table: user_preferences
-- ============================================================================

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "user_preferences_delete_own" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences
    FOR DELETE
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
    FOR INSERT
    TO public
    WITH CHECK ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id
DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences
    FOR SELECT
    TO public
    USING ((select auth.uid()) = user_id);

-- Original: auth.uid() = user_id (USING and WITH CHECK)
DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
    FOR UPDATE
    TO public
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- Table: users
-- ============================================================================

-- Original: has_internal_role(auth.uid())
DROP POLICY IF EXISTS "internal_users_can_read_all_users" ON public.users;
CREATE POLICY "internal_users_can_read_all_users" ON public.users
    FOR SELECT
    TO public
    USING (has_internal_role((select auth.uid())));

-- Original: om.user_id = auth.uid()
DROP POLICY IF EXISTS "org_members_can_read_org_users" ON public.users;
CREATE POLICY "org_members_can_read_org_users" ON public.users
    FOR SELECT
    TO public
    USING (id IN (
        SELECT om.user_id
        FROM organization_members om
        WHERE om.organization_id IN (
            SELECT organization_members.organization_id
            FROM organization_members
            WHERE organization_members.user_id = (select auth.uid())
        )
        AND om.user_id IS NOT NULL
    ));

-- Original: auth.uid() = id
DROP POLICY IF EXISTS "users_can_insert_own_user" ON public.users;
CREATE POLICY "users_can_insert_own_user" ON public.users
    FOR INSERT
    TO public
    WITH CHECK ((select auth.uid()) = id);

-- NOTE: users_can_read_own_user already uses (SELECT auth.uid()) - SKIPPED
-- NOTE: users_can_update_own_user already uses (SELECT auth.uid()) - SKIPPED

COMMIT;
