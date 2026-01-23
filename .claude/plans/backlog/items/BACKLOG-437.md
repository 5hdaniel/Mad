# BACKLOG-437: Contact Card Should Display All Email Addresses

## Summary

Contact cards in the Key Contacts section only display one email address even when the contact has multiple emails. All email addresses should be visible.

## Category

Bug / UI

## Priority

P2 - Medium (Data exists but not displayed)

## Description

### Problem

When a contact has multiple email addresses (e.g., personal + work email):
- Only one email is shown on the contact card
- User doesn't know the contact has other emails
- May cause confusion when communications from the hidden email appear

### Expected Behavior

Contact card should show all email addresses, either:
- Inline: `john@personal.com, john@work.com`
- Stacked with labels:
  ```
  john@personal.com (primary)
  john@work.com (work)
  ```

### Reproduction Steps

1. Have a contact with 2+ email addresses (e.g., Madison)
2. Add contact to a transaction
3. View Key Contacts section in transaction details
4. Only one email is displayed

## Acceptance Criteria

- [ ] All email addresses display on contact card
- [ ] All phone numbers display on contact card
- [ ] Handles 2-3+ emails gracefully (don't overflow layout)
- [ ] Primary email/phone indicated if applicable

## Estimated Effort

~5K tokens

## Related Items

- BACKLOG-435: Contact Card View Details & Edit
- Key Contacts component
