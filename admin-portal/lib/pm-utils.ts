/**
 * Shared utility functions for the Project Management module.
 */

/** Format a token count for display (e.g. 1500 -> "2K", 1200000 -> "1.2M"). */
export function formatTokens(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return '-';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}
