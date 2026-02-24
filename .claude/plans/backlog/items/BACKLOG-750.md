# BACKLOG-750: Email Attachments and Messages Not Syncing From Folders Outside Inbox/Sent

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Bug                    |
| **Area**    | Service                |
| **Priority**| High                   |
| **Status**  | Pending                |
| **Created** | 2026-02-20             |

## Description

Attachments from emails that are not in the Inbox folder are not being pulled/synced. This may be a broader issue where the email sync itself is limited to only the Inbox and Sent folders, meaning emails (and their attachments) from other mailbox folders (subfolders, Archive, custom folders, etc.) are being missed entirely.

## Two Potential Issues

### 1. Attachment-Only Issue
- Emails from non-Inbox/Sent folders are synced, but their attachments are not being downloaded.

### 2. Broader Sync Issue (Needs Investigation)
- The email sync may only be querying Inbox and Sent folders, completely ignoring emails in other folders.
- If true, this affects both email content and attachments.

## Expected Behavior

- All emails from all mailbox folders should be synced (or at minimum, all folders the user has configured).
- Attachments should be pulled regardless of which folder the parent email resides in.

## Investigation Areas

- Check the Graph API / Gmail API query parameters — are folder IDs being filtered to only Inbox and Sent?
- Check if the attachment download logic has a folder-based filter or assumption
- Review how mailbox folders are enumerated during sync
- Test with emails in: Archive, subfolders, custom labels/folders, Drafts, Junk

## Acceptance Criteria

- [ ] Confirm whether email sync is limited to Inbox/Sent only
- [ ] If so, expand sync to cover all relevant mailbox folders
- [ ] Confirm attachments are pulled for emails in all synced folders
- [ ] Add test coverage for non-Inbox folder sync
