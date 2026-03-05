/**
 * Analytics Query Helpers
 *
 * Server-side Supabase queries for the admin analytics dashboard.
 * All queries use the authenticated server client — cross-org read
 * access is granted by TASK-2110 RLS policies for internal_roles users.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────

export interface VersionDistribution {
  app_version: string;
  user_count: number;
  adoption_pct: number;
}

export interface SystemCounts {
  active_users: number;
  total_orgs: number;
  active_devices: number;
}

export interface PlatformBreakdown {
  platform: string;
  user_count: number;
  pct: number;
}

export interface LicenseUtilization {
  plan: string;
  org_count: number;
  total_seats: number;
  active_seats: number;
  utilization_pct: number;
}

// ─── Queries ─────────────────────────────────────────────────────

/**
 * Active users by app version (last 30 days).
 *
 * Groups active devices by app_version, counts distinct users,
 * and computes adoption percentage relative to total active users.
 */
export async function getVersionDistribution(
  supabase: SupabaseClient
): Promise<VersionDistribution[]> {
  // Fetch active devices from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: devices, error } = await supabase
    .from('devices')
    .select('app_version, user_id')
    .eq('is_active', true)
    .gte('last_seen_at', thirtyDaysAgo.toISOString());

  if (error || !devices) {
    console.error('getVersionDistribution error:', error?.message);
    return [];
  }

  // Group by version, count distinct users
  const versionMap = new Map<string, Set<string>>();
  for (const d of devices) {
    const version = d.app_version || 'Unknown';
    if (!versionMap.has(version)) {
      versionMap.set(version, new Set());
    }
    versionMap.get(version)!.add(d.user_id);
  }

  // Total distinct active users
  const allUsers = new Set(devices.map((d) => d.user_id));
  const totalActive = allUsers.size || 1; // avoid division by zero

  const results: VersionDistribution[] = [];
  for (const [version, users] of versionMap) {
    results.push({
      app_version: version,
      user_count: users.size,
      adoption_pct: Math.round((users.size / totalActive) * 100),
    });
  }

  // Sort descending by version string (semver-ish)
  results.sort((a, b) => b.app_version.localeCompare(a.app_version));
  return results;
}

/**
 * System-wide counts: active users, total orgs, active devices.
 */
export async function getSystemCounts(
  supabase: SupabaseClient
): Promise<SystemCounts> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Run queries in parallel
  const [devicesResult, orgsResult] = await Promise.all([
    supabase
      .from('devices')
      .select('user_id')
      .eq('is_active', true)
      .gte('last_seen_at', thirtyDaysAgo.toISOString()),
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
  ]);

  const devices = devicesResult.data ?? [];
  const distinctUsers = new Set(devices.map((d) => d.user_id));

  return {
    active_users: distinctUsers.size,
    total_orgs: orgsResult.count ?? 0,
    active_devices: devices.length,
  };
}

/**
 * Platform breakdown (macOS vs Windows) for active devices.
 */
export async function getPlatformBreakdown(
  supabase: SupabaseClient
): Promise<PlatformBreakdown[]> {
  const { data: devices, error } = await supabase
    .from('devices')
    .select('platform, user_id')
    .eq('is_active', true);

  if (error || !devices) {
    console.error('getPlatformBreakdown error:', error?.message);
    return [];
  }

  const platformMap = new Map<string, Set<string>>();
  for (const d of devices) {
    const platform = d.platform || 'Unknown';
    if (!platformMap.has(platform)) {
      platformMap.set(platform, new Set());
    }
    platformMap.get(platform)!.add(d.user_id);
  }

  const totalUsers = new Set(devices.map((d) => d.user_id)).size || 1;

  const results: PlatformBreakdown[] = [];
  for (const [platform, users] of platformMap) {
    results.push({
      platform,
      user_count: users.size,
      pct: Math.round((users.size / totalUsers) * 100),
    });
  }

  results.sort((a, b) => b.user_count - a.user_count);
  return results;
}

/**
 * License utilization by organization plan.
 *
 * Groups orgs by plan, sums max_seats, counts active members.
 */
export async function getLicenseUtilization(
  supabase: SupabaseClient
): Promise<LicenseUtilization[]> {
  // Fetch orgs with plan and max_seats
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, plan, max_seats');

  if (orgsError || !orgs) {
    console.error('getLicenseUtilization orgs error:', orgsError?.message);
    return [];
  }

  // Fetch active members
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('license_status', 'active');

  if (membersError || !members) {
    console.error('getLicenseUtilization members error:', membersError?.message);
    return [];
  }

  // Count active members per org
  const memberCountByOrg = new Map<string, number>();
  for (const m of members) {
    const count = memberCountByOrg.get(m.organization_id) ?? 0;
    memberCountByOrg.set(m.organization_id, count + 1);
  }

  // Group by plan
  const planMap = new Map<
    string,
    { org_count: number; total_seats: number; active_seats: number }
  >();

  for (const org of orgs) {
    const plan = org.plan || 'trial';
    if (!planMap.has(plan)) {
      planMap.set(plan, { org_count: 0, total_seats: 0, active_seats: 0 });
    }
    const entry = planMap.get(plan)!;
    entry.org_count += 1;
    entry.total_seats += org.max_seats ?? 0;
    entry.active_seats += memberCountByOrg.get(org.id) ?? 0;
  }

  const results: LicenseUtilization[] = [];
  for (const [plan, data] of planMap) {
    results.push({
      plan,
      org_count: data.org_count,
      total_seats: data.total_seats,
      active_seats: data.active_seats,
      utilization_pct:
        data.total_seats > 0
          ? Math.round((data.active_seats / data.total_seats) * 100)
          : 0,
    });
  }

  // Sort: trial, pro, enterprise
  const planOrder: Record<string, number> = {
    trial: 0,
    pro: 1,
    enterprise: 2,
  };
  results.sort(
    (a, b) => (planOrder[a.plan] ?? 99) - (planOrder[b.plan] ?? 99)
  );

  return results;
}
