import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatCurrency, formatRelativeTime, getStatusColor, formatStatus } from '@/lib/utils';
import { SubmissionListClient } from '@/components/submission/SubmissionListClient';
import { EmptySubmissions } from '@/components/ui/EmptyState';

interface Submission {
  id: string;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  transaction_type: string;
  listing_price: number | null;
  sale_price: number | null;
  status: string;
  message_count: number;
  attachment_count: number;
  created_at: string;
  reviewed_at: string | null;
}

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string }>;
}

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'needs_changes', label: 'Needs Changes' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

async function getSubmissions(status?: string): Promise<Submission[]> {
  const supabase = await createClient();

  let query = supabase
    .from('transaction_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply status filter if provided and not 'all'
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }

  return data || [];
}

export default async function SubmissionsPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const submissions = await getSubmissions(status);
  const currentStatus = status || 'all';

  return (
    <SubmissionListClient>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
            {currentStatus !== 'all' && ` with status "${formatStatus(currentStatus)}"`}
          </p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(({ value, label }) => {
            const isActive = currentStatus === value;
            return (
              <Link
                key={value}
                href={value === 'all' ? '/dashboard/submissions' : `/dashboard/submissions?status=${value}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        {submissions.length === 0 ? (
          <EmptySubmissions filtered={currentStatus !== 'all'} />
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Docs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {submission.property_address}
                    </div>
                    <div className="text-sm text-gray-500">
                      {submission.property_city}, {submission.property_state}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="capitalize text-sm text-gray-700">
                      {submission.transaction_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(submission.sale_price || submission.listing_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        submission.status
                      )}`}
                    >
                      {formatStatus(submission.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span title="Messages">{submission.message_count} msgs</span>
                      <span className="text-gray-300">|</span>
                      <span title="Attachments">{submission.attachment_count} files</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatRelativeTime(submission.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/submissions/${submission.id}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 font-medium group-hover:underline"
                    >
                      Review
                      <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </SubmissionListClient>
  );
}
