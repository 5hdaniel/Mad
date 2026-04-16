-- Migration: Add indexes to unindexed foreign key columns
-- BACKLOG-1638: 42 foreign keys across public schema tables lack indexes,
-- causing slow JOIN and DELETE operations.
--
-- Uses CREATE INDEX CONCURRENTLY for zero-downtime index creation.
-- Naming convention: idx_<tablename>_<columnname>

-- admin_roles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_roles_created_by
ON public.admin_roles(created_by);

-- error_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_error_logs_resolved_by
ON public.error_logs(resolved_by);

-- impersonation_sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_impersonation_sessions_admin_user_id
ON public.impersonation_sessions(admin_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_impersonation_sessions_target_user_id
ON public.impersonation_sessions(target_user_id);

-- individual_invitations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_individual_invitations_invited_by
ON public.individual_invitations(invited_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_individual_invitations_plan_id
ON public.individual_invitations(plan_id);

-- internal_roles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_roles_created_by
ON public.internal_roles(created_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_roles_role_id
ON public.internal_roles(role_id);

-- organization_members
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_invited_by
ON public.organization_members(invited_by);

-- organization_plans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_plans_assigned_by
ON public.organization_plans(assigned_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_plans_plan_id
ON public.organization_plans(plan_id);

-- pending_internal_invitations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_internal_invitations_invited_by
ON public.pending_internal_invitations(invited_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_internal_invitations_role_id
ON public.pending_internal_invitations(role_id);

-- pm_attachments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_attachments_item_id
ON public.pm_attachments(item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_attachments_task_id
ON public.pm_attachments(task_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_attachments_uploader_id
ON public.pm_attachments(uploader_id);

-- pm_comments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_comments_author_id
ON public.pm_comments(author_id);

-- pm_labels
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_labels_project_id
ON public.pm_labels(project_id);

-- pm_projects
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_projects_owner_id
ON public.pm_projects(owner_id);

-- pm_saved_views
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_saved_views_user_id
ON public.pm_saved_views(user_id);

-- pm_sprints
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pm_sprints_project_id
ON public.pm_sprints(project_id);

-- profiles
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_organization_id
ON public.profiles(organization_id);

-- scim_sync_log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scim_sync_log_scim_token_id
ON public.scim_sync_log(scim_token_id);

-- scim_tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scim_tokens_created_by
ON public.scim_tokens(created_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scim_tokens_organization_id
ON public.scim_tokens(organization_id);

-- submission_comments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submission_comments_attachment_id
ON public.submission_comments(attachment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submission_comments_message_id
ON public.submission_comments(message_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submission_comments_user_id
ON public.submission_comments(user_id);

-- support_response_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_response_templates_created_by
ON public.support_response_templates(created_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_response_templates_updated_by
ON public.support_response_templates(updated_by);

-- support_ticket_attachments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_attachments_message_id
ON public.support_ticket_attachments(message_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_attachments_uploaded_by
ON public.support_ticket_attachments(uploaded_by);

-- support_ticket_backlog_links
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_backlog_links_created_by
ON public.support_ticket_backlog_links(created_by);

-- support_ticket_events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_events_actor_id
ON public.support_ticket_events(actor_id);

-- support_ticket_links
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_links_linked_by
ON public.support_ticket_links(linked_by);

-- support_ticket_messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_messages_sender_id
ON public.support_ticket_messages(sender_id);

-- support_ticket_participants
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_participants_added_by
ON public.support_ticket_participants(added_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_participants_user_id
ON public.support_ticket_participants(user_id);

-- support_tickets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_organization_id
ON public.support_tickets(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_subcategory_id
ON public.support_tickets(subcategory_id);

-- transaction_submissions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_submissions_parent_submission_id
ON public.transaction_submissions(parent_submission_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_submissions_reviewed_by
ON public.transaction_submissions(reviewed_by);
