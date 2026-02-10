# BACKLOG-625: New Outlook Contacts Experience — Contacts Invisible to Graph API

## Status: Deferred (Blocked on Microsoft)

## Summary

Contacts created using the **new Outlook contacts experience** (Outlook on the web, new People hub) are not returned by any Microsoft Graph API endpoint. This is a known Microsoft issue — the new contacts UI stores contacts in a location that the Graph API has not been updated to access.

## Impact

- Users who create contacts exclusively via the new Outlook web experience will not see those contacts synced into Magic Audit
- Contacts created via classic Outlook, mobile Outlook, or programmatically via Graph API **do** sync correctly
- Our `/me/contacts` implementation is correct and working

## Evidence

- `/me/contacts` (v1.0) — returns empty for new-experience contacts
- `/me/contacts` (beta) — returns empty for new-experience contacts
- `/me/contactFolders` — returns empty
- `/me/people` — returns only implicit contacts (email interactions) and org directory users, not saved contacts
- Contacts created via Graph Explorer or classic method DO appear correctly in `/me/contacts`

## Microsoft Community Thread

https://techcommunity.microsoft.com/discussions/outlookgeneral/additional-contacts-in-new-contacts-not-visible-in-classic/4440874

Key quote from MVP: "New Outlook contacts is not completely finished yet" — the feature has unresolved implementation issues.

## Resolution Path

- **Blocked on Microsoft** — no API endpoint exists to access these contacts
- Monitor Microsoft Graph API changelog for updates to contacts endpoints
- When Microsoft exposes new-experience contacts via API, update `outlookFetchService.fetchContacts()` to use the new endpoint

## Workaround for Users

Users who want their Outlook contacts to sync with Magic Audit should:
1. Create contacts in classic Outlook desktop, or
2. Use Outlook mobile, or
3. The macOS Contacts app will pick up Exchange-synced contacts automatically

## Discovered During

Sprint-073 Outlook contacts import debugging (2026-02-07). Confirmed via Graph Explorer that `/me/contacts` works correctly for classic contacts but new-experience contacts are invisible to all API endpoints.
