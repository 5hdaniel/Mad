# BACKLOG-450: Portal - Show Agent Name on Submission Review

**Priority:** P1 (High)
**Category:** feature / portal
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~8K

---

## Summary

When a broker reviews a submission in the portal, they need to see which agent submitted it. Currently the agent name is not prominently displayed.

---

## Problem Statement

Brokers reviewing submissions need to quickly identify:
1. Which agent submitted this transaction
2. Agent contact info for follow-up questions
3. Agent's role (buyer agent, seller agent, etc.)

Without this, brokers can't efficiently process submissions.

---

## Proposed Solution

### Submission Header

Add agent info prominently in the submission detail header:

```tsx
<div className="submission-header">
  <h1>{propertyAddress}</h1>
  <div className="agent-info">
    <span className="label">Submitted by:</span>
    <span className="agent-name">{agentName}</span>
    <span className="agent-email">{agentEmail}</span>
  </div>
</div>
```

### Submission List

Show agent name in the submissions list view:

```
| Property Address | Agent | Status | Submitted |
|------------------|-------|--------|-----------|
| 123 Main St      | Madison Del Vigo | Under Review | Jan 23 |
```

---

## Data Requirements

The submission should include:
- `submitted_by` - User ID who submitted
- Join with users/profiles to get agent name
- Agent email for contact

---

## Acceptance Criteria

- [ ] Agent name visible on submission detail page
- [ ] Agent name visible in submissions list
- [ ] Agent email/contact info accessible
- [ ] Clear visual hierarchy showing who submitted

---

## Related Items

- BACKLOG-407: Show agent name on transaction card (desktop app)
- Broker Portal (SPRINT-050)
