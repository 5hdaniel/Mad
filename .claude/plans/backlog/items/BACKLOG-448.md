# BACKLOG-448: Portal - Limit Attachments Display to 3 Rows with "Show More"

**Priority:** P2 (Medium)
**Category:** ui / portal
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~5K

---

## Summary

On the broker portal submission detail page, limit the attachments section to show only 3 rows initially with a "Show All" button to expand, since attachments are media-heavy and can slow down the page.

---

## Problem Statement

Attachments section displays all attachments at once, which:
1. Makes the page heavy/slow with many attachments
2. Pushes other content down
3. Poor UX when there are 10+ attachments

---

## Proposed Solution

1. Show first 3 attachment rows by default
2. Add "Show All (X)" button if more than 3 attachments
3. Clicking expands to show all attachments
4. Optional: Add collapse button after expanding

```tsx
const [showAllAttachments, setShowAllAttachments] = useState(false);
const displayedAttachments = showAllAttachments
  ? attachments
  : attachments.slice(0, 3);

// Render displayedAttachments...

{attachments.length > 3 && !showAllAttachments && (
  <button onClick={() => setShowAllAttachments(true)}>
    Show All ({attachments.length})
  </button>
)}
```

---

## Acceptance Criteria

- [ ] Only 3 attachment rows shown by default
- [ ] "Show All (X)" button appears when more than 3
- [ ] Clicking button reveals all attachments
- [ ] Page loads faster with many attachments

---

## Related Items

- Broker Portal (SPRINT-050)
- Submission detail page
