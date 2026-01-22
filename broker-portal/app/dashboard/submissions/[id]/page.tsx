import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate, getStatusColor, formatStatus } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSubmission(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transaction_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

async function getMessages(submissionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('submission_messages')
    .select('*')
    .eq('submission_id', submissionId)
    .order('sent_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

async function getAttachments(submissionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('submission_attachments')
    .select('*')
    .eq('submission_id', submissionId);

  if (error) {
    console.error('Error fetching attachments:', error);
    return [];
  }

  return data || [];
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [submission, messages, attachments] = await Promise.all([
    getSubmission(id),
    getMessages(id),
    getAttachments(id),
  ]);

  if (!submission) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/submissions"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to submissions
      </Link>

      {/* Header */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {submission.property_address}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {submission.property_city}, {submission.property_state} {submission.property_zip}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                submission.status
              )}`}
            >
              {formatStatus(submission.status)}
            </span>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          <DetailItem label="Transaction Type" value={submission.transaction_type} />
          <DetailItem label="Listing Price" value={formatCurrency(submission.listing_price)} />
          <DetailItem label="Sale Price" value={formatCurrency(submission.sale_price)} />
          <DetailItem label="Started" value={formatDate(submission.started_at)} />
          <DetailItem label="Closed" value={formatDate(submission.closed_at)} />
          <DetailItem label="Messages" value={submission.message_count.toString()} />
          <DetailItem label="Attachments" value={submission.attachment_count.toString()} />
          <DetailItem label="Submitted" value={formatDate(submission.created_at)} />
        </div>

        {/* Review Notes */}
        {submission.review_notes && (
          <div className="px-6 py-5 border-t border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Review Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {submission.review_notes}
            </p>
          </div>
        )}
      </div>

      {/* Review Actions (for submitted/under_review status) */}
      {['submitted', 'under_review', 'resubmitted'].includes(submission.status) && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Review Actions</h2>
          <div className="flex gap-3">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Approve
            </button>
            <button
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              Request Changes
            </button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Reject
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Review actions will be implemented in BACKLOG-400
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Messages ({messages.length})
          </h2>
        </div>
        {messages.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No messages in this submission
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {messages.map((message) => (
              <li key={message.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      message.direction === 'outbound'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {message.direction === 'outbound' ? 'OUT' : 'IN'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {message.subject || '(No subject)'}
                      </span>
                      <span className="text-xs text-gray-400 uppercase">
                        {message.channel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {message.body_text || '(No content)'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(message.sent_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Attachments */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Attachments ({attachments.length})
          </h2>
        </div>
        {attachments.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No attachments in this submission
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {attachment.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attachment.document_type && (
                          <span className="capitalize">{attachment.document_type} - </span>
                        )}
                        {attachment.file_size_bytes
                          ? `${(attachment.file_size_bytes / 1024).toFixed(1)} KB`
                          : 'Unknown size'}
                      </p>
                    </div>
                  </div>
                  <button
                    className="text-sm text-primary-600 hover:text-primary-500"
                    title="Download functionality in BACKLOG-401"
                  >
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 capitalize">{value || '-'}</dd>
    </div>
  );
}
