# LLM Integration Testing Checklist

This checklist covers manual testing for the AI Transaction Auto-Detection feature across both Anthropic and OpenAI providers.

**Last Updated:** 2025-12-19
**Related Sprint:** SPRINT-006 (AI MVP Polish)
**Related Backlogs:** BACKLOG-077, BACKLOG-078, BACKLOG-079

---

## Provider Setup Testing

| Test | Anthropic | OpenAI | Notes |
|------|-----------|--------|-------|
| **API Key Validation** | | | Enter key, click Validate |
| Valid key accepted | ☐ | ☐ | Shows "Valid" |
| Invalid key rejected | ☐ | ☐ | Shows "Invalid key" |
| Billing error shown | ☐ | ☐ | Shows credits/quota message |
| **API Key Save** | | | |
| Save shows feedback | ☐ | ☐ | "Saving..." → "Saved" |
| Key persists after restart | ☐ | ☐ | Reopen Settings |
| **Default Tab** | | | |
| Shows provider with saved key | ☐ | ☐ | If only one provider configured |

---

## Email Scanning Testing

| Test | Anthropic | OpenAI | Notes |
|------|-----------|--------|-------|
| **Basic Scan** | | | |
| Scan completes successfully | ☐ | ☐ | No errors |
| Transactions detected | ☐ | ☐ | At least 1 found |
| Progress/loading shown | ☐ | ☐ | Spinner during scan |
| **Model Selection** | | | |
| Haiku works (default) | ☐ | N/A | Anthropic only |
| Sonnet works | ☐ | N/A | Anthropic only |
| GPT-4o-mini works | N/A | ☐ | OpenAI only |
| GPT-4o works | N/A | ☐ | OpenAI only |

---

## Detection UI Testing

| Test | Anthropic | OpenAI | Notes |
|------|-----------|--------|-------|
| **Filter Tabs** | | | |
| "All" shows everything | ☐ | ☐ | |
| "Pending" shows AI-detected | ☐ | ☐ | Unreviewed items |
| "Confirmed" shows approved | ☐ | ☐ | After approve action |
| "Rejected" shows rejected | ☐ | ☐ | After reject action |
| **Detection Badges** | | | |
| "AI Detected" badge visible | ☐ | ☐ | On auto-detected txns |
| Confidence % shown | ☐ | ☐ | e.g., "87% confident" |
| **Approve/Reject** | | | |
| Approve moves to Confirmed | ☐ | ☐ | Click approve |
| Reject prompts for reason | ☐ | ☐ | Click reject |
| Reject moves to Rejected | ☐ | ☐ | After entering reason |

---

## Transaction Modal Testing

| Test | Anthropic | OpenAI | Notes |
|------|-----------|--------|-------|
| **Edit Mode** | | | |
| Address pre-fills | ☐ | ☐ | From AI extraction |
| Type pre-fills | ☐ | ☐ | Purchase/Sale/etc |
| Price pre-fills | ☐ | ☐ | If detected |
| **Suggested Contacts** | | | |
| Contacts displayed | ☐ | ☐ | From AI extraction |
| Roles assigned | ☐ | ☐ | Buyer's Agent, etc |
| Can edit role | ☐ | ☐ | Dropdown works |
| Can remove contact | ☐ | ☐ | X button works |

---

## Error Handling Testing

| Test | Anthropic | OpenAI | Notes |
|------|-----------|--------|-------|
| No API key configured | ☐ | ☐ | Shows setup prompt |
| API key expired/revoked | ☐ | ☐ | Clear error message |
| Rate limit hit | ☐ | ☐ | Graceful retry message |
| Network error | ☐ | ☐ | Offline handling |
| No transactions found | ☐ | ☐ | Empty state message |

---

## End-to-End Flow

Run the complete flow twice - once per provider.

### Anthropic Flow

```
☐ 1. Settings → Anthropic tab → Enter key → Validate → Save
☐ 2. Select Haiku model (default)
☐ 3. Run email scan
☐ 4. Verify transactions detected with "AI Detected" badge
☐ 5. Filter by "Pending"
☐ 6. Open transaction → verify suggested contacts
☐ 7. Approve one transaction → moves to "Confirmed"
☐ 8. Reject another → enter reason → moves to "Rejected"
☐ 9. Edit transaction → verify pre-filled data → save
```

### OpenAI Flow

```
☐ 1. Settings → OpenAI tab → Enter key → Validate → Save
☐ 2. Select GPT-4o-mini model
☐ 3. Run email scan
☐ 4. Verify transactions detected with "AI Detected" badge
☐ 5. Filter by "Pending"
☐ 6. Open transaction → verify suggested contacts
☐ 7. Approve one transaction → moves to "Confirmed"
☐ 8. Reject another → enter reason → moves to "Rejected"
☐ 9. Edit transaction → verify pre-filled data → save
```

---

## Test Results

### Test Session Template

**Date:** YYYY-MM-DD
**Tester:** [Name]
**App Version:** [Version]
**OS:** [Windows/macOS]

#### Anthropic Results
- **API Key:** ☐ Pass / ☐ Fail
- **Scan:** ☐ Pass / ☐ Fail
- **UI Features:** ☐ Pass / ☐ Fail
- **E2E Flow:** ☐ Pass / ☐ Fail
- **Notes:**

#### OpenAI Results
- **API Key:** ☐ Pass / ☐ Fail
- **Scan:** ☐ Pass / ☐ Fail
- **UI Features:** ☐ Pass / ☐ Fail
- **E2E Flow:** ☐ Pass / ☐ Fail
- **Notes:**

---

## Known Issues / Bugs Found

| Date | Issue | Provider | Severity | Status |
|------|-------|----------|----------|--------|
| | | | | |

---

## Testing Notes

### Prerequisites
- Valid Anthropic API key with credits
- Valid OpenAI API key with credits
- Email account connected with real estate emails
- Clean database recommended for E2E testing

### Tips
- Test with fresh emails for most accurate results
- Check console (DevTools) for any errors during scan
- Verify database entries after approve/reject actions
- Test both providers to ensure parity

### Models Available

**Anthropic:**
- Claude 3.5 Haiku (Recommended - Best Value)
- Claude Sonnet 4 (Higher Accuracy)
- Claude 3.5 Sonnet

**OpenAI:**
- GPT-4o-mini (Recommended)
- GPT-4o (Higher Accuracy)
