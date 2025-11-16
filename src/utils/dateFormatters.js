/**
 * Date formatting utilities for the frontend
 */

/**
 * Format MAC timestamp for display as relative or absolute date
 * @param {number} timestamp - MAC timestamp (nanoseconds since 2001-01-01)
 * @returns {string} Formatted date string
 */
export function formatMessageDate(timestamp) {
  if (!timestamp) return 'No messages';

  // Convert Mac timestamp to readable date
  const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
  const date = new Date(macEpoch + timestamp / 1000000);

  // Compare calendar days, not just time differences
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today - messageDay;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}
