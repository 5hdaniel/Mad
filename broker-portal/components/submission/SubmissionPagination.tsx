import Link from 'next/link';

interface SubmissionPaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

/**
 * Build the href for a specific page number.
 * If the baseUrl already has query params (e.g., ?status=submitted),
 * append &page=N. Otherwise, append ?page=N.
 * Page 1 omits the page param entirely for cleaner URLs.
 */
function buildPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) {
    return baseUrl;
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}page=${page}`;
}

/**
 * Server-rendered pagination component for the submission list.
 * Uses Next.js Link for server-side navigation (no client state).
 */
export function SubmissionPagination({
  currentPage,
  totalPages,
  baseUrl,
}: SubmissionPaginationProps) {
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 bg-gray-50">
      <span className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-2">
        {hasPrevious ? (
          <Link
            href={buildPageUrl(baseUrl, currentPage - 1)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Previous
          </Link>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-md cursor-not-allowed">
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildPageUrl(baseUrl, currentPage + 1)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Next
          </Link>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-md cursor-not-allowed">
            Next
          </span>
        )}
      </div>
    </div>
  );
}
