/**
 * Analytics Query Helpers
 *
 * Server-side Supabase queries for the admin analytics dashboard.
 * All queries use the authenticated server client — cross-org read
 * access is granted by TASK-2110 RLS policies for internal_roles users.
 *
 * Where possible, queries use count-only or minimal-select patterns
 * to avoid fetching full row sets into memory.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────────────

export interface VersionUser {
  id: string;
  email: string | null;
  display_name: string | null;
}

export interface VersionDistribution {
  app_version: string;
  user_count: number;
  adoption_pct: number;
  users: VersionUser[];
}

export interface SystemCounts {
  active_users: number;
  total_orgs: number;
  active_devices: number;
  total_users: number;
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

export interface PhoneTypeBreakdown {
  phone_type: string;
  user_count: number;
  pct: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Queries ─────────────────────────────────────────────────────

/**
 * Active users by app version (last 30 days).
 *
 * Fetches only app_version and user_id (two columns, no payloads),
 * then aggregates in JS. For 10K+ devices, migrate to an RPC.
 */
/**
 * Compare two semver strings numerically (e.g. "2.9.1" < "2.10.1").
 * Non-semver strings like "Unknown" sort to the end.
 */
function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const isNumA = partsA.every((n) => !isNaN(n));
  const isNumB = partsB.every((n) => !isNaN(n));
  // Non-numeric versions (e.g. "Unknown") sort to the end
  if (!isNumA && !isNumB) return a.localeCompare(b);
  if (!isNumA) return 1;
  if (!isNumB) return -1;
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function getVersionDistribution(
  supabase: SupabaseClient,
  days = 30
): Promise<VersionDistribution[]> {
  const { data: devices, error } = await supabase
    .from('devices')
    .select('app_version, user_id')
    .eq('is_active', true)
    .gte('last_seen_at', daysAgo(days));

  if (error || !devices) {
    console.error('getVersionDistribution error:', error?.message);
    return [];
  }

  // Collect unique user IDs per version
  const versionMap = new Map<string, Set<string>>();
  for (const d of devices) {
    const version = d.app_version || 'Unknown';
    if (!versionMap.has(version)) versionMap.set(version, new Set());
    versionMap.get(version)!.add(d.user_id);
  }

  const totalActive = new Set(devices.map((d) => d.user_id)).size || 1;

  // Fetch user details for all unique user IDs
  const allUserIds = [...new Set(devices.map((d) => d.user_id))];
  const { data: usersData } = await supabase
    .from('users')
    .select('id, email, display_name')
    .in('id', allUserIds);

  const userLookup = new Map<string, VersionUser>();
  for (const u of usersData ?? []) {
    userLookup.set(u.id, { id: u.id, email: u.email, display_name: u.display_name });
  }

  const results: VersionDistribution[] = [];
  for (const [version, userIds] of versionMap) {
    const users: VersionUser[] = [...userIds].map(
      (uid) => userLookup.get(uid) ?? { id: uid, email: null, display_name: null }
    );
    users.sort((a, b) => (a.display_name ?? a.email ?? '').localeCompare(b.display_name ?? b.email ?? ''));
    results.push({
      app_version: version,
      user_count: users.length,
      adoption_pct: Math.round((users.length / totalActive) * 100),
      users,
    });
  }

  // Sort old → newest, "Unknown" at the end
  results.sort((a, b) => compareSemver(a.app_version, b.app_version));
  return results;
}

/**
 * System-wide counts using count-only queries (no row data transferred).
 */
export async function getSystemCounts(
  supabase: SupabaseClient
): Promise<SystemCounts> {
  const cutoff = daysAgo(30);

  const [devicesResult, orgsResult, totalUsersResult, activeDevicesResult] =
    await Promise.all([
      // Active users: need user_id for distinct count (minimal select)
      supabase
        .from('devices')
        .select('user_id')
        .eq('is_active', true)
        .gte('last_seen_at', cutoff),
      // Total orgs: count only, no data
      supabase
        .from('organizations')
        .select('id', { count: 'exact', head: true }),
      // Total users: count only
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true }),
      // Active devices: count only
      supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('last_seen_at', cutoff),
    ]);

  const distinctUsers = new Set(
    (devicesResult.data ?? []).map((d) => d.user_id)
  );

  return {
    active_users: distinctUsers.size,
    total_orgs: orgsResult.count ?? 0,
    active_devices: activeDevicesResult.count ?? 0,
    total_users: totalUsersResult.count ?? 0,
  };
}

/**
 * Platform breakdown using minimal select (two columns only).
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
    if (!platformMap.has(platform)) platformMap.set(platform, new Set());
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
 * License utilization — uses count-only for members, minimal select for orgs.
 */
export async function getLicenseUtilization(
  supabase: SupabaseClient
): Promise<LicenseUtilization[]> {
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, plan, max_seats');

  if (orgsError || !orgs) {
    console.error('getLicenseUtilization orgs error:', orgsError?.message);
    return [];
  }

  // Fetch only the org_id column for active members
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('license_status', 'active');

  if (membersError || !members) {
    console.error('getLicenseUtilization members error:', membersError?.message);
    return [];
  }

  const memberCountByOrg = new Map<string, number>();
  for (const m of members) {
    memberCountByOrg.set(
      m.organization_id,
      (memberCountByOrg.get(m.organization_id) ?? 0) + 1
    );
  }

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

/**
 * Phone type breakdown — fetches preferences JSONB (unavoidable for JSONB field extraction).
 */
export async function getPhoneTypeBreakdown(
  supabase: SupabaseClient
): Promise<PhoneTypeBreakdown[]> {
  const { data: prefs, error } = await supabase
    .from('user_preferences')
    .select('user_id, preferences');

  if (error || !prefs) {
    console.error('getPhoneTypeBreakdown error:', error?.message);
    return [];
  }

  const typeMap = new Map<string, number>();
  for (const p of prefs) {
    const phoneType =
      (p.preferences as Record<string, unknown>)?.phone_type as
        | string
        | undefined;
    const label = phoneType || 'Not set';
    typeMap.set(label, (typeMap.get(label) ?? 0) + 1);
  }

  const total = prefs.length || 1;
  const results: PhoneTypeBreakdown[] = [];
  for (const [phoneType, count] of typeMap) {
    results.push({
      phone_type: phoneType,
      user_count: count,
      pct: Math.round((count / total) * 100),
    });
  }

  results.sort((a, b) => b.user_count - a.user_count);
  return results;
}
