-- Migration: Remove 32 unused indexes (idx_scan = 0)
-- Task: BACKLOG-1639
-- Date: 2026-04-15
--
-- These indexes have zero scans since last statistics reset.
-- They waste storage, slow writes, and add maintenance overhead.
--
-- CAVEAT: pg_stat_user_indexes.idx_scan resets on server restart.
-- These stats reflect usage since the last Supabase restart, not all-time.
--
-- SAFETY: All unique constraint indexes, primary keys, and unique indexes
-- that enforce business rules have been excluded from this migration.
-- Only plain btree/gin indexes with no constraint backing are dropped.
--
-- Uses DROP INDEX CONCURRENTLY for zero-downtime removal.
-- NOTE: Each DROP INDEX CONCURRENTLY must be its own statement (cannot be
-- wrapped in a transaction block).

-- ============================================================
-- analytics_events (1 index, 32 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_analytics_created_at;

-- ============================================================
-- api_usage (1 index, 8 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_api_usage_created_at;

-- ============================================================
-- audit_logs (1 index, 112 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_audit_logs_timestamp;

-- ============================================================
-- error_logs (4 indexes, 32 kB total)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_error_logs_app_version;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_error_logs_created_at;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_error_logs_error_type;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_error_logs_unresolved;

-- ============================================================
-- individual_invitations (1 index, 16 kB)
-- NOTE: individual_invitations_invitation_token_key (UNIQUE) is kept
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_individual_invitations_token;

-- ============================================================
-- licenses (2 indexes, 32 kB total)
-- NOTE: licenses_license_key_key (UNIQUE) is kept
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_licenses_status;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_licenses_trial_expires_at;

-- ============================================================
-- organization_members (2 indexes, 24 kB total)
-- NOTE: organization_members_invitation_token_key (UNIQUE) is kept
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_organization_members_provisioned_by;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_organization_members_scim_synced;

-- ============================================================
-- organizations (2 indexes, 24 kB total)
-- NOTE: organizations_google_domain_key (UNIQUE) is kept
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_organizations_google_domain;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_organizations_microsoft_tenant_id;

-- ============================================================
-- pm_changelog (2 indexes, 32 kB total)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pm_changelog_date;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pm_changelog_sprint;

-- ============================================================
-- pm_token_metrics (2 indexes, 64 kB total)
-- NOTE: pm_token_metrics_legacy_id_unique (UNIQUE) is kept
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pm_token_metrics_backlog_item;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pm_token_metrics_task_uuid;

-- ============================================================
-- profiles (1 index, 16 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_profiles_license_type;

-- ============================================================
-- scim_sync_log (3 indexes, 24 kB total)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scim_sync_log_created_at;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scim_sync_log_operation;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_scim_sync_log_resource;

-- ============================================================
-- support_ticket_messages (1 index, 56 kB) — KEPT
-- ============================================================
-- idx_support_ticket_messages_search is NOT dropped despite idx_scan=0
-- because support_list_tickets() RPC queries
-- `support_ticket_messages.search_vector @@ v_query` when p_search is passed.
-- The zero-scan stat is misleading: the support search feature was added
-- recently (2026-03-15) and pg_stat_user_indexes stats reset on restart.
-- Dropping this GIN index would cause full scans on every support admin search.
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_support_ticket_messages_search;

-- ============================================================
-- support_tickets (1 index, 16 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_support_tickets_priority;

-- ============================================================
-- token_claims (1 index, 16 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_token_claims_user_expires;

-- ============================================================
-- users (6 indexes, 80 kB total)
-- NOTE: users_email_key (UNIQUE) and users_oauth_provider_oauth_id_key (UNIQUE) are kept
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_email_onboarding;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_provisioning_source;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_scim_external_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_sso_managed;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_subscription;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_suspended_at;

-- ============================================================
-- pm_labels (1 index, 16 kB — but this is UNIQUE, so we KEEP it)
-- pm_tasks (1 index, 16 kB)
-- ============================================================
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pm_tasks_status;


-- ============================================================
-- ROLLBACK: Re-create all dropped indexes if needed
-- ============================================================
-- To restore any or all indexes, run the corresponding CREATE statement:
--
-- CREATE INDEX idx_analytics_created_at ON public.analytics_events USING btree (created_at);
-- CREATE INDEX idx_api_usage_created_at ON public.api_usage USING btree (created_at);
-- CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp" DESC);
-- CREATE INDEX idx_error_logs_app_version ON public.error_logs USING btree (app_version);
-- CREATE INDEX idx_error_logs_created_at ON public.error_logs USING btree (created_at DESC);
-- CREATE INDEX idx_error_logs_error_type ON public.error_logs USING btree (error_type);
-- CREATE INDEX idx_error_logs_unresolved ON public.error_logs USING btree (created_at DESC) WHERE (resolved_at IS NULL);
-- CREATE INDEX idx_individual_invitations_token ON public.individual_invitations USING btree (invitation_token);
-- CREATE INDEX idx_licenses_status ON public.licenses USING btree (status);
-- CREATE INDEX idx_licenses_trial_expires_at ON public.licenses USING btree (trial_expires_at) WHERE (trial_status = 'active'::text);
-- CREATE INDEX idx_organization_members_provisioned_by ON public.organization_members USING btree (provisioned_by) WHERE (provisioned_by IS NOT NULL);
-- CREATE INDEX idx_organization_members_scim_synced ON public.organization_members USING btree (scim_synced_at) WHERE (scim_synced_at IS NOT NULL);
-- CREATE INDEX idx_organizations_google_domain ON public.organizations USING btree (google_domain) WHERE (google_domain IS NOT NULL);
-- CREATE INDEX idx_organizations_microsoft_tenant_id ON public.organizations USING btree (microsoft_tenant_id) WHERE (microsoft_tenant_id IS NOT NULL);
-- CREATE INDEX idx_pm_changelog_date ON public.pm_changelog USING btree (change_date);
-- CREATE INDEX idx_pm_changelog_sprint ON public.pm_changelog USING btree (sprint_ref);
-- CREATE INDEX idx_pm_token_metrics_backlog_item ON public.pm_token_metrics USING btree (backlog_item_id);
-- CREATE INDEX idx_pm_token_metrics_task_uuid ON public.pm_token_metrics USING btree (task_uuid);
-- CREATE INDEX idx_profiles_license_type ON public.profiles USING btree (license_type);
-- CREATE INDEX idx_scim_sync_log_created_at ON public.scim_sync_log USING btree (created_at DESC);
-- CREATE INDEX idx_scim_sync_log_operation ON public.scim_sync_log USING btree (operation);
-- CREATE INDEX idx_scim_sync_log_resource ON public.scim_sync_log USING btree (resource_type, resource_id);
-- CREATE INDEX idx_support_tickets_priority ON public.support_tickets USING btree (priority);
-- CREATE INDEX idx_token_claims_user_expires ON public.token_claims USING btree (user_id, expires_at);
-- CREATE INDEX idx_users_email_onboarding ON public.users USING btree (email_onboarding_completed_at);
-- CREATE INDEX idx_users_provisioning_source ON public.users USING btree (provisioning_source);
-- CREATE INDEX idx_users_scim_external_id ON public.users USING btree (scim_external_id) WHERE (scim_external_id IS NOT NULL);
-- CREATE INDEX idx_users_sso_managed ON public.users USING btree (is_managed, sso_only) WHERE ((is_managed = true) OR (sso_only = true));
-- CREATE INDEX idx_users_subscription ON public.users USING btree (subscription_status);
-- CREATE INDEX idx_users_suspended_at ON public.users USING btree (suspended_at) WHERE (suspended_at IS NOT NULL);
-- CREATE INDEX idx_pm_tasks_status ON public.pm_tasks USING btree (status);
