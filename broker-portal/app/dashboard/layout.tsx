import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UserMenu from '@/components/UserMenu';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { getImpersonationSession } from '@/lib/impersonation';
import { SupportWidget } from './components/SupportWidget';

async function getUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user's role from organization_members
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    ...user,
    role: membership?.role || undefined,
    name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
  };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const impersonation = await getImpersonationSession();
  const isImpersonating = !!impersonation;

  // During impersonation, we don't need a real auth session
  // The impersonation cookie provides the identity
  const user = await getUserWithRole();

  if (!user && !isImpersonating) {
    redirect('/login');
  }

  // During impersonation, use target user info from the session
  const displayEmail = isImpersonating
    ? impersonation.target_email
    : (user?.email || '');
  const displayName = isImpersonating
    ? impersonation.target_name
    : user?.name;
  const displayRole = isImpersonating ? undefined : user?.role;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo & Nav Links */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex flex-col">
                <span className="text-xl font-bold text-gray-900 leading-tight">
                  Keepr.
                </span>
                <span className="text-xs text-gray-500">
                  Broker Portal
                </span>
              </Link>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                {/* BACKLOG-907: During impersonation, show only target-user nav (Dashboard, Submissions).
                    Admin-only items (Users, Settings) are hidden so the admin sees what the target user sees. */}
                {(isImpersonating || !user || user.role !== 'it_admin') && (
                  <>
                    <Link
                      href="/dashboard"
                      className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/submissions"
                      className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Submissions
                    </Link>
                    <Link
                      href="/dashboard/support"
                      className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Support
                    </Link>
                  </>
                )}
                {/* Show Users/Settings nav links for admins only — NOT during impersonation */}
                {(!isImpersonating && (user?.role === 'admin' || user?.role === 'it_admin')) && (
                  <>
                    <Link
                      href="/dashboard/users"
                      className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Users
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      Settings
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center">
              <UserMenu
                email={displayEmail}
                name={displayName}
                role={displayRole}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Floating Support Widget */}
      <SupportWidget />
    </div>
  );
}
