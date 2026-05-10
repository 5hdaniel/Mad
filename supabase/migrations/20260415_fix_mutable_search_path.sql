-- Fix mutable search_path on 53 public functions (BACKLOG-1633)
--
-- Security: Functions without SET search_path are vulnerable to search_path
-- injection attacks. An attacker who can create objects could shadow public
-- schema functions by placing malicious functions in a schema earlier in the
-- search_path.
--
-- Reference: https://supabase.com/docs/guides/database/database-advisors
-- Advisor: 0010_security_definer_view (security)

ALTER FUNCTION public.admin_add_internal_user(p_email text, p_role text) SET search_path = public;
ALTER FUNCTION public.admin_assign_org_plan(p_org_id uuid, p_plan_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_create_organization(p_name text, p_max_seats integer) SET search_path = public;
ALTER FUNCTION public.admin_create_plan(p_name text, p_slug text, p_tier text, p_description text) SET search_path = public;
ALTER FUNCTION public.admin_create_role(p_name text, p_slug text, p_description text, p_permission_keys text[]) SET search_path = public;
ALTER FUNCTION public.admin_delete_plan(p_plan_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_delete_role(p_role_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_end_impersonation(p_session_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_get_impersonated_user_data(p_session_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_get_org_plan(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_invite_user(p_organization_id uuid, p_email text, p_role text, p_invited_by uuid, p_license_status text, p_plan_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_remove_internal_user(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_start_impersonation(p_target_user_id uuid) SET search_path = public;
ALTER FUNCTION public.admin_toggle_plan_active(p_plan_id uuid, p_is_active boolean) SET search_path = public;
ALTER FUNCTION public.admin_update_internal_user_role(p_user_id uuid, p_role_slug text) SET search_path = public;
ALTER FUNCTION public.admin_update_license(p_license_id uuid, p_changes jsonb) SET search_path = public;
ALTER FUNCTION public.admin_update_plan_feature(p_plan_id uuid, p_feature_id uuid, p_enabled boolean, p_value text) SET search_path = public;
ALTER FUNCTION public.admin_update_plan_tier(p_plan_id uuid, p_new_tier text) SET search_path = public;
ALTER FUNCTION public.admin_update_role(p_role_id uuid, p_name text, p_description text) SET search_path = public;
ALTER FUNCTION public.admin_update_role_permissions(p_role_id uuid, p_permission_keys text[]) SET search_path = public;
ALTER FUNCTION public.admin_validate_impersonation_token(p_token text) SET search_path = public;
ALTER FUNCTION public.broker_get_org_features(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.check_feature_access(p_org_id uuid, p_feature_key text) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_impersonation_sessions() SET search_path = public;
ALTER FUNCTION public.get_db_size() SET search_path = public;
ALTER FUNCTION public.get_org_features(p_org_id uuid) SET search_path = public;
ALTER FUNCTION public.get_storage_usage() SET search_path = public;
ALTER FUNCTION public.get_user_permissions(check_user_id uuid) SET search_path = public;
ALTER FUNCTION public.has_any_permission(check_user_id uuid, permission_keys text[]) SET search_path = public;
ALTER FUNCTION public.has_permission(check_user_id uuid, required_permission text) SET search_path = public;
ALTER FUNCTION public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_metadata jsonb, p_ip_address inet, p_user_agent text) SET search_path = public;
ALTER FUNCTION public.notify_ticket_confirmation() SET search_path = public;
ALTER FUNCTION public.pm_backlog_items_search_trigger() SET search_path = public;
ALTER FUNCTION public.pm_delete_project(p_project_id uuid) SET search_path = public;
ALTER FUNCTION public.pm_get_board_tasks(p_sprint_id uuid, p_project_id uuid, p_area text) SET search_path = public;
ALTER FUNCTION public.pm_get_item_detail(p_item_id uuid) SET search_path = public;
ALTER FUNCTION public.pm_get_project_detail(p_project_id uuid) SET search_path = public;
ALTER FUNCTION public.pm_update_item_status(p_item_id uuid, p_new_status text) SET search_path = public;
ALTER FUNCTION public.pm_update_sprint_field(p_sprint_id uuid, p_field text, p_value text) SET search_path = public;
ALTER FUNCTION public.prevent_audit_log_modification() SET search_path = public;
ALTER FUNCTION public.support_create_template(p_name text, p_body text, p_category text) SET search_path = public;
ALTER FUNCTION public.support_delete_saved_view(p_view_id uuid) SET search_path = public;
ALTER FUNCTION public.support_delete_template(p_id uuid) SET search_path = public;
ALTER FUNCTION public.support_get_ticket_detail(p_ticket_id uuid, p_requester_email text) SET search_path = public;
ALTER FUNCTION public.support_list_all_templates() SET search_path = public;
ALTER FUNCTION public.support_list_saved_views() SET search_path = public;
ALTER FUNCTION public.support_list_templates() SET search_path = public;
ALTER FUNCTION public.support_messages_search_trigger() SET search_path = public;
ALTER FUNCTION public.support_save_view(p_name text, p_filters_json jsonb, p_is_shared boolean) SET search_path = public;
ALTER FUNCTION public.support_search_requesters(p_query text) SET search_path = public;
ALTER FUNCTION public.support_tickets_search_trigger() SET search_path = public;
ALTER FUNCTION public.support_tickets_updated_at() SET search_path = public;
ALTER FUNCTION public.support_update_template(p_id uuid, p_name text, p_body text, p_category text, p_is_active boolean) SET search_path = public;
ALTER FUNCTION public.sync_item_number_seq() SET search_path = public;
ALTER FUNCTION public.tier_rank(p_tier text) SET search_path = public;
ALTER FUNCTION public.track_submission_status_changes() SET search_path = public;
ALTER FUNCTION public.validate_no_circular_dependency() SET search_path = public;
