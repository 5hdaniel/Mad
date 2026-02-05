import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate, getStatusColor, formatStatus } from '@/lib/utils';
import { MessageList } from '@/components/submission/MessageList';
import { ReviewActions } from '@/components/submission/ReviewActions';
import { AttachmentList } from '@/components/submission/AttachmentList';
import { StatusHistory } from '@/components/submission/StatusHistory';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Message {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string | null;
  sent_at: string;
  has_attachments: boolean;
  attachment_count: number;
  thread_id: string | null;
  /** Message type: text, voice_message, location, attachment_only, system, unknown */
  message_type: string | null;
  participants: {
    from?: string;
    to?: string | string[];
    cc?: string[];
    bcc?: string[];
    chat_members?: string[];
    // Resolved names from contact lookup
    from_name?: string;
    to_names?: Record<string, string>;
    chat_member_names?: Record<string, string>;
  } | null;
}

interface Attachment {
  id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
  document_type: string | null;
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

/**
 * Mark submission as under_review when broker first opens it.
 * This prevents agent from resubmitting while broker is reviewing.
 */
async function markAsUnderReview(submission: { id: string; status: string }) {
  // Only transition from 'submitted' or 'resubmitted' to 'under_review'
  if (submission.status !== 'submitted' && submission.status !== 'resubmitted') {
    return;
  }

  const supabase = await createClient();

  await supabase
    .from('transaction_submissions')
    .update({
      status: 'under_review',
    })
    .eq('id', submission.id);
}

async function getMessages(submissionId: string): Promise<Message[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('submission_messages')
    .select('*')
    .eq('submission_id', submissionId)
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

async function getAttachments(submissionId: string): Promise<Attachment[]> {
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

  // Mark as under_review when broker first opens (don't await - fire and forget)
  // This prevents agent from resubmitting while broker is reviewing
  markAsUnderReview(submission);

  return (
    <div className="space-y-6 pb-24">
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
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{submission.property_address}</h1>
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
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{submission.review_notes}</p>
          </div>
        )}
      </div>

      {/* Review Actions */}
      <ReviewActions
        submission={{
          id: submission.id,
          status: submission.status,
          organization_id: submission.organization_id,
        }}
        disabled={submission.status === 'approved' || submission.status === 'rejected'}
      />

      {/* Status History Timeline */}
      {/* Note: status_history column doesn't exist in schema yet, passing empty array */}
      {/* The StatusHistory component gracefully handles this by showing initial submission entry */}
      <StatusHistory
        history={[]}
        currentStatus={submission.status}
        submittedAt={submission.created_at}
      />

      {/* Messages with filter tabs */}
      <MessageList messages={messages} />

      {/* Attachments with viewer */}
      <AttachmentList attachments={attachments} />
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
