import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatRelativeTime, getStatusColor, formatStatus } from '@/lib/utils';

interface SubmissionStats {
  total: number;
  submitted: number;
  under_review: number;
  needs_changes: number;
  approved: number;
  rejected: number;
}

async function getStats(): Promise<SubmissionStats> {
  const supabase = await createClient();

  // Get all submissions for the user's organization
  const { data, error } = await supabase
    .from('transaction_submissions')
    .select('status');

  if (error || !data) {
    console.error('Error fetching stats:', error);
    return {
      total: 0,
      submitted: 0,
      under_review: 0,
      needs_changes: 0,
      approved: 0,
      rejected: 0,
    };
  }

  return {
    total: data.length,
    submitted: data.filter(s => s.status === 'submitted').length,
    under_review: data.filter(s => s.status === 'under_review').length,
    needs_changes: data.filter(s => s.status === 'needs_changes').length,
    approved: data.filter(s => s.status === 'approved').length,
    rejected: data.filter(s => s.status === 'rejected').length,
  };
}

async function getRecentSubmissions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transaction_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching recent submissions:', error);
    return [];
  }

  return data || [];
}

export default async function DashboardPage() {
  const [stats, recentSubmissions] = await Promise.all([
    getStats(),
    getRecentSubmissions(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of transaction submissions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Review"
          value={stats.submitted + stats.under_review}
          color="blue"
        />
        <StatCard
          title="Needs Changes"
          value={stats.needs_changes}
          color="orange"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          color="green"
        />
        <StatCard
          title="Total Submissions"
          value={stats.total}
          color="gray"
        />
      </div>

      {/* Recent Submissions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">
            Recent Submissions
          </h2>
          <Link
            href="/dashboard/submissions"
            className="text-sm text-primary-600 hover:text-primary-500"
          >
            View all
          </Link>
        </div>

        {recentSubmissions.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            No submissions yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recentSubmissions.map((submission) => (
              <li key={submission.id}>
                <Link
                  href={`/dashboard/submissions/${submission.id}`}
                  className="block px-4 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {submission.property_address}
                      </p>
                      <p className="text-sm text-gray-500">
                        {submission.property_city}, {submission.property_state}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">
                        {formatRelativeTime(submission.created_at)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          submission.status
                        )}`}
                      >
                        {formatStatus(submission.status)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: 'blue' | 'orange' | 'green' | 'gray';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-3 rounded-md ${colors[color]}`}>
            <span className="text-2xl font-bold">{value}</span>
          </div>
          <div className="ml-5">
            <p className="text-sm font-medium text-gray-500">{title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
