# TASK-1009: Streamline Terms and Conditions Onboarding Step

**Backlog ID:** BACKLOG-181
**Sprint:** SPRINT-028
**Phase:** Phase 1 - Quick Fixes (Parallel)
**Branch:** `fix/TASK-1009-streamline-terms`
**Estimated Tokens:** ~15K
**Token Cap:** 60K

---

## Objective

Streamline the Terms and Conditions acceptance step to match the visual style and flow of other onboarding steps.

---

## Context

Current experience:
- "Welcome to Magic Audit!" header with personalized greeting
- Two separate checkboxes (Terms of Service, Privacy Policy)
- "Decline" and "Accept & Continue" buttons
- Different styling compared to other onboarding steps

Issues:
- Feels disconnected from rest of onboarding
- Two checkboxes is redundant
- "Decline" button is unnecessary (user can close app)

---

## Requirements

### Must Do:
1. Match visual style with other onboarding steps
2. Single checkbox/toggle for accepting both Terms and Privacy
3. Keep inline links to view full documents
4. Smooth transition to next step
5. Remove "Decline" button

### Must NOT Do:
- Remove ability to view full Terms/Privacy documents
- Break legal compliance (acceptance must be explicit)
- Remove user personalization

---

## Acceptance Criteria

- [ ] Terms step matches visual style of other onboarding steps
- [ ] Single acceptance action (not two separate checkboxes)
- [ ] Terms and Privacy Policy remain accessible via links
- [ ] Smooth transition to next step after acceptance
- [ ] User greeting/personalization preserved
- [ ] "Decline" button removed

---

## Files to Investigate/Modify

- `src/components/onboarding/` - Onboarding components
- Look for `TermsStep.tsx` or similar
- Check onboarding state machine integration

---

## Design Notes

Example simplified UI:
```
[Card matching other onboarding steps]

Welcome, {userName}!

Before we get started, please review and accept our terms.

[ ] I accept the Terms of Service and Privacy Policy
    (View Terms | View Privacy Policy)

[Accept & Continue]
```

---

## PR Preparation

- **Title:** `fix(onboarding): streamline terms acceptance step`
- **Branch:** `fix/TASK-1009-streamline-terms`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

| Metric | Value |
|--------|-------|
| Agent ID | `<from Task tool output>` |
| Total Tokens | `<from tokens.jsonl>` |

### Results

- **PR**: [URL]

---

## Guardrails

**STOP and ask PM if:**
- Legal/compliance concerns about single checkbox
- Significant state machine changes needed
- Design direction unclear
