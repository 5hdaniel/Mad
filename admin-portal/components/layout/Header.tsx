'use client';

/**
 * Header - Admin Portal
 *
 * Top header bar with title and user info.
 */

import { useAuth } from '@/components/providers/AuthProvider';

export function Header() {
  const { user } = useAuth();

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Admin User';

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <header className="flex items-center justify-end px-6 py-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm text-gray-700">{displayName}</span>
      </div>
    </header>
  );
}
