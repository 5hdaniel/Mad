# BACKLOG-443: Contact Import Should Store All Emails/Phones in Junction Tables

## Summary

When importing contacts, only the primary email/phone is stored in the main `contacts` table. Additional emails/phones are not being imported into the `contact_emails` and `contact_phones` junction tables, even though the schema supports multiple.

## Category

Bug / Data Import

## Priority

P1 - High (Missing contact data = incomplete audits)

## Description

### Problem

**Schema supports multiple emails/phones:**
- `contact_emails` table: stores multiple emails per contact
- `contact_phones` table: stores multiple phones per contact
- `contacts` table: has single `email`/`phone` fields (for convenience)

**But import only stores one:**
When importing a contact like Madison who has:
- `madisonsola@gmail.com` (personal)
- `madison@workdomain.com` (work)

Only the primary email ends up in the database:
```json
{
  "email": "madisonsola@gmail.com",  // Only this is stored
  "phone": "+13609181693"
}
```

The `contact_emails` table is empty or missing the work email.

### Root Cause (Suspected)

1. Contact import service only reads primary email from source
2. Or: Import reads all emails but only stores first one
3. Or: Import stores in contact_emails but API doesn't return them

### Expected Behavior

1. **Import**: Store ALL emails/phones from source:
   - Primary in `contacts.email` field
   - ALL (including primary) in `contact_emails` table

2. **API**: Return all emails when fetching contact:
   ```json
   {
     "id": "...",
     "display_name": "Madison",
     "email": "madisonsola@gmail.com",  // Primary
     "emails": [
       {"email": "madisonsola@gmail.com", "is_primary": true, "label": "personal"},
       {"email": "madison@work.com", "is_primary": false, "label": "work"}
     ],
     "phone": "+13609181693",
     "phones": [...]
   }
   ```

3. **Sync**: Query mailbox for ALL contact emails, not just primary

### Areas to Fix

1. **Contact Import Service**: Store all emails/phones in junction tables
2. **Contact API (getAll, getById)**: Include `emails[]` and `phones[]` arrays
3. **Communication Sync**: Query using all emails from contact_emails

## Acceptance Criteria

- [ ] Contact import stores all emails in `contact_emails` table
- [ ] Contact import stores all phones in `contact_phones` table
- [ ] Contact API returns `emails[]` array with all emails
- [ ] Contact API returns `phones[]` array with all phones
- [ ] Sync Communications queries all contact emails
- [ ] UI displays all emails (depends on BACKLOG-437)

## Estimated Effort

~25K tokens (touches import, API, and sync)

## Dependencies

None

## Related Items

- BACKLOG-437: Display all emails on contact card
- BACKLOG-438: Sync should fetch all contact emails
- contact_emails / contact_phones schema
