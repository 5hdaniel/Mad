'use client';

/**
 * Realtime Submissions Hook
 *
 * Subscribes to Supabase Realtime for instant updates when:
 * - New submissions are created in the organization
 * - Submission statuses are updated
 *
 * Shows toast notifications and triggers list refresh.
 */

import { useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { formatStatus } from '@/lib/utils';

interface UseRealtimeSubmissionsOptions {
  /** Organization ID to filter by (optional) */
  organizationId?: string;
  /** Called when a new submission is created */
  onNewSubmission?: (submission: RealtimeSubmission) => void;
  /** Called when a submission status changes */
  onStatusChange?: (submission: RealtimeSubmission) => void;
  /** Called to trigger a full data refresh */
  onRefresh?: () => void;
}

interface RealtimeSubmission {
  id: string;
  property_address: string;
  status: string;
  organization_id: string;
  submitted_by: string;
}

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: RealtimeSubmission;
  old: Partial<RealtimeSubmission>;
}

/**
 * Hook to subscribe to realtime submission updates
 */
export function useRealtimeSubmissions({
  organizationId,
  onNewSubmission,
  onStatusChange,
  onRefresh,
}: UseRealtimeSubmissionsOptions = {}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  const showToast = useCallback((title: string, description: string) => {
    // Simple toast implementation using browser notifications
    // In a real app, you'd use a toast library like react-hot-toast or sonner
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: description });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body: description });
          }
        });
      }
    }
    // Also log to console for debugging
    console.log(`[Realtime] ${title}: ${description}`);
  }, []);

  useEffect(() => {
    // Build channel name
    const channelName = organizationId
      ? `submissions-org-${organizationId}`
      : 'submissions-all';

    // Build filter if organization specified
    const filter = organizationId
      ? `organization_id=eq.${organizationId}`
      : undefined;

    // Create channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transaction_submissions',
          filter,
        },
        (payload: RealtimePayload) => {
          const submission = payload.new;
          console.log('[Realtime] New submission:', submission);

          showToast(
            'New Submission',
            `${submission.property_address} submitted for review`
          );

          onNewSubmission?.(submission);
          onRefresh?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transaction_submissions',
          filter,
        },
        (payload: RealtimePayload) => {
          const submission = payload.new;
          const oldStatus = payload.old?.status;

          // Only notify if status actually changed
          if (oldStatus && oldStatus !== submission.status) {
            console.log('[Realtime] Status change:', {
              id: submission.id,
              oldStatus,
              newStatus: submission.status,
            });

            showToast(
              'Status Updated',
              `${submission.property_address}: ${formatStatus(submission.status)}`
            );

            onStatusChange?.(submission);
            onRefresh?.();
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, organizationId, onNewSubmission, onStatusChange, onRefresh, showToast]);

  return {
    isConnected: channelRef.current !== null,
  };
}
