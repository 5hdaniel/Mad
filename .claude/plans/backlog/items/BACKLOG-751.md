# BACKLOG-751: Google Places Address Autocomplete Not Working

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Bug                    |
| **Area**    | Service                |
| **Priority**| High                   |
| **Status**  | Completed              |
| **Created** | 2026-02-20             |
| **Completed** | 2026-02-20           |
| **Sprint**  | SPRINT-089             |
| **Task**    | TASK-2022              |

## Description

Google Places address autocomplete was returning `REQUEST_DENIED` errors when users attempted to search for property addresses in the transaction form. The autocomplete dropdown was not populating with any results.

## Root Cause

Google Cloud billing was not enabled on the project associated with the Google Places API key. The Places API requires an active billing account to process requests, even within the free tier quota.

## Resolution

**Infrastructure fix -- no code change required.**

Billing was enabled on the Google Cloud Console at `console.cloud.google.com`. Once billing was activated, the Places API began returning results normally. The existing client-side integration code was working correctly.

## Verification

- Address autocomplete populates results when typing in the transaction address field
- No `REQUEST_DENIED` errors in the console
- API key and client-side code unchanged

## Related Items

- TASK-2022: Sprint task tracking this fix
