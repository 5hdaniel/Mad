/**
 * Loading State for User Details Page
 *
 * Shows skeleton UI while fetching user details.
 *
 * TASK-1813: User details view
 */

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back Link Skeleton */}
      <div className="h-4 w-24 bg-gray-200 rounded" />

      {/* Card Skeleton */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-full bg-gray-200" />
            <div className="space-y-2">
              <div className="h-6 w-40 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="flex gap-2 mt-2">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-gray-200 rounded-md" />
            <div className="h-9 w-24 bg-gray-200 rounded-md" />
            <div className="h-9 w-24 bg-gray-200 rounded-md" />
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Membership Section */}
          <div>
            <div className="h-5 w-28 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div>
            <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
