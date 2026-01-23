/**
 * Submissions Page Loading State
 *
 * Shows skeleton UI while submissions are being fetched.
 */

import { SubmissionTableSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function SubmissionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Filter Pills Skeleton */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <SubmissionTableSkeleton rows={5} />
    </div>
  );
}
