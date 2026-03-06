import Link from 'next/link';
import { ArrowLeft, UserX } from 'lucide-react';

export default function UserNotFound() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <UserX className="mx-auto h-12 w-12 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">User not found</h2>
        <p className="mt-2 text-sm text-gray-500">
          The user you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/dashboard/users"
          className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
        >
          Search Users
        </Link>
      </div>
    </div>
  );
}
