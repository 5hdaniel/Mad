-- Migration: Admin Device Management
-- BACKLOG-1511: Add devices.manage permission and RPCs for viewing/revoking user devices

-- 1. New permission: devices.manage (category: users), granted to Super Admin
INSERT INTO public.admin_permissions (id, key, label, description, category)
VALUES (
  gen_random_uuid(),
  'devices.manage',
  'Manage Devices',
  'View and deactivate user devices',
  'users'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), '89e5f07f-7869-419b-9339-248e4d0da0ce', p.id
FROM public.admin_permissions p
WHERE p.key = 'devices.manage'
ON CONFLICT DO NOTHING;

-- 2. RPC: admin_list_user_devices
--    Returns JSONB array of devices for a user.
--    Requires has_internal_role + users.view permission.
CREATE OR REPLACE FUNCTION public.admin_list_user_devices(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_devices JSONB;
BEGIN
  IF NOT public.has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_permission(auth.uid(), 'users.view') THEN
    RAISE EXCEPTION 'Missing permission: users.view';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'device_name', d.device_name,
      'device_id', d.device_id,
      'os', d.os,
      'app_version', d.app_version,
      'platform', d.platform,
      'is_active', d.is_active,
      'last_seen_at', d.last_seen_at,
      'activated_at', d.activated_at
    ) ORDER BY d.last_seen_at DESC NULLS LAST
  ), '[]'::jsonb)
  INTO v_devices
  FROM public.devices d
  WHERE d.user_id = p_user_id;

  RETURN v_devices;
END;
$$;

-- 3. RPC: admin_deactivate_device
--    Deactivates a device (sets is_active = false, does NOT delete).
--    Requires has_internal_role + devices.manage permission.
--    Writes audit log via log_admin_action.
CREATE OR REPLACE FUNCTION public.admin_deactivate_device(p_device_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_device RECORD;
BEGIN
  IF NOT public.has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_permission(auth.uid(), 'devices.manage') THEN
    RAISE EXCEPTION 'Missing permission: devices.manage';
  END IF;

  SELECT id, device_name, device_id, is_active
  INTO v_device
  FROM public.devices
  WHERE id = p_device_id AND user_id = p_user_id;

  IF v_device.id IS NULL THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  IF v_device.is_active = false THEN
    RAISE EXCEPTION 'Device is already deactivated';
  END IF;

  UPDATE public.devices
  SET is_active = false
  WHERE id = p_device_id;

  PERFORM public.log_admin_action(
    'device.deactivate',
    'device',
    p_device_id::TEXT,
    jsonb_build_object(
      'user_id', p_user_id,
      'device_name', COALESCE(v_device.device_name, ''),
      'device_id', COALESCE(v_device.device_id, '')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'device_id', p_device_id,
    'device_name', v_device.device_name
  );
END;
$$;
