import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ProjectsPlaceholderPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/pm"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500 mt-1">
          Project management -- Coming Soon
        </p>
      </div>
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
        <div className="text-center">
          <p className="text-gray-400 text-lg font-medium">Coming Soon</p>
          <p className="text-gray-300 text-sm mt-1">This page is under development</p>
        </div>
      </div>
    </div>
  );
}
