'use client';

/**
 * Submission List Client Component
 *
 * Wraps the server-rendered submission list with realtime updates.
 * Uses useRealtimeSubmissions hook to subscribe to changes and
 * triggers page refresh when updates occur.
 */

import { useRouter } from 'next/navigation';
import { useCallback, ReactNode } from 'react';
import { useRealtimeSubmissions } from '@/hooks/useRealtimeSubmissions';

interface SubmissionListClientProps {
  children: ReactNode;
  organizationId?: string;
}

export function SubmissionListClient({
  children,
  organizationId,
}: SubmissionListClientProps) {
  const router = useRouter();

  const handleRefresh = useCallback(() => {
    // Refresh the page data using Next.js router
    router.refresh();
  }, [router]);

  // Subscribe to realtime updates
  useRealtimeSubmissions({
    organizationId,
    onRefresh: handleRefresh,
  });

  return <>{children}</>;
}
