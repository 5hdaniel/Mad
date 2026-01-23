# BACKLOG-449: Portal - Message Count Capped at 1000 (Missing Messages)

**Priority:** P1 (High)
**Category:** bug / portal
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~8K

---

## Summary

The broker portal messages section is capped at 1000 messages due to a SQL LIMIT, causing the count to show "1000" even when there are more messages. Messages beyond the limit are not displayed.

---

## Problem Statement

User observed:
- Messages header shows "Messages (1000)"
- Texts tab shows "Texts (1000)"
- Individual conversation counts sum to exactly 1000
- Likely more messages exist but are truncated

### Evidence

Conversation counts from screenshot:
- Sue ubqt: 723
- Brian: 188
- Various others: ~89
- **Total: exactly 1000** (suspicious round number = LIMIT hit)

---

## Root Cause

Likely a `LIMIT 1000` in the Supabase query fetching submission messages:

```sql
SELECT * FROM submission_messages
WHERE submission_id = ?
LIMIT 1000  -- This is the problem
```

---

## Proposed Solution

**Recommended: Infinite scroll (like Facebook/Instagram)**

1. Load initial batch (e.g., 50-100 messages)
2. As user scrolls down, load more automatically
3. Show loading spinner at bottom while fetching
4. Stop when all messages loaded

```tsx
// Intersection Observer pattern
const [messages, setMessages] = useState([]);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const loaderRef = useRef(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreMessages();
      }
    },
    { threshold: 0.1 }
  );
  if (loaderRef.current) observer.observe(loaderRef.current);
  return () => observer.disconnect();
}, [hasMore]);

// At bottom of list:
{hasMore && <div ref={loaderRef}><Spinner /></div>}
```

**Alternative: "View All" link to dedicated page**
- Show first 50 messages inline
- "View All (1,234)" link opens full-page view with infinite scroll

---

## Files to Modify

| File | Change |
|------|--------|
| `broker-portal/app/dashboard/submissions/[id]/page.tsx` | Increase/remove limit or add pagination |
| Supabase query | Fix the LIMIT clause |

---

## Acceptance Criteria

- [ ] All messages display (not capped at 1000)
- [ ] Count accurately reflects total messages
- [ ] Performance remains acceptable with large submissions
- [ ] Consider pagination for very large message sets

---

## Related Items

- Broker Portal (SPRINT-050)
- BACKLOG-448: Limit attachments display with "Show More"
