/**
 * Empty State Component
 *
 * Professional empty states with icons and optional actions.
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Generic Empty State
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-md mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Inbox/Document Icon for empty states
 */
export function InboxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-12 h-12', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}

/**
 * Search/Filter Icon
 */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-12 h-12', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

/**
 * Document Icon
 */
export function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-12 h-12', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

/**
 * Messages Icon
 */
export function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-12 h-12', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

/**
 * Attachment/Paperclip Icon
 */
export function AttachmentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-12 h-12', className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

/**
 * Empty Submissions State
 */
export function EmptySubmissions({ filtered = false }: { filtered?: boolean }) {
  if (filtered) {
    return (
      <EmptyState
        icon={<SearchIcon />}
        title="No matching submissions"
        description="Try adjusting your filters or search criteria to find what you're looking for."
      />
    );
  }

  return (
    <EmptyState
      icon={<InboxIcon />}
      title="No submissions yet"
      description="When agents submit transactions for review, they'll appear here. You'll be notified of new submissions in real-time."
    />
  );
}

/**
 * Empty Messages State
 */
export function EmptyMessages() {
  return (
    <EmptyState
      icon={<MessagesIcon />}
      title="No messages"
      description="This submission doesn't have any attached messages."
    />
  );
}

/**
 * Empty Attachments State
 */
export function EmptyAttachments() {
  return (
    <EmptyState
      icon={<AttachmentIcon />}
      title="No attachments"
      description="This submission doesn't have any attached files."
    />
  );
}
