/**
 * Sentry API Client Helper
 *
 * Provides a typed wrapper around the Sentry REST API
 * for fetching user-related issues.
 */

const SENTRY_BASE_URL = 'https://us.sentry.io/api/0';

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  status: string;
  count: string;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}

interface SentryConfig {
  apiToken: string;
  orgSlug: string;
}

function getConfig(): SentryConfig | null {
  const apiToken = process.env.SENTRY_API_TOKEN;
  const orgSlug = process.env.SENTRY_ORG_SLUG;

  if (!apiToken || !orgSlug) {
    return null;
  }

  return { apiToken, orgSlug };
}

/**
 * Fetch recent Sentry issues for a given user email.
 * Returns an empty array if Sentry is not configured or the API call fails.
 */
export async function fetchUserIssues(
  email: string,
  limit = 10
): Promise<SentryIssue[]> {
  const config = getConfig();
  if (!config) {
    return [];
  }

  const url = new URL(
    `${SENTRY_BASE_URL}/organizations/${config.orgSlug}/issues/`
  );
  url.searchParams.set('query', `user.email:${email}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('sort', 'date');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(
        `Sentry API error: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data: SentryIssue[] = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch Sentry issues:', error);
    return [];
  }
}
