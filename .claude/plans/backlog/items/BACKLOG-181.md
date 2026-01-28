# BACKLOG-181: Streamline Terms and Conditions Onboarding Step

**Priority:** Medium
**Category:** UX/Onboarding
**Created:** 2026-01-09
**Status:** Mostly Complete (2026-01-10)

---

## Recent Updates

**2026-01-10:** Added step indicator ("1 - Terms & Conditions") to match other onboarding steps. The WelcomeTerms component now shows a step number badge consistent with OnboardingShell styling.

Remaining items were already completed in prior work:
- Single checkbox ✓
- Consistent card styling ✓
- Removed decline button ✓

---

## Problem Statement

The Terms and Conditions acceptance step during onboarding feels disconnected from the rest of the onboarding flow. It has a different visual style and requires two separate checkbox confirmations before proceeding.

Current experience:
- "Welcome to Magic Audit!" header with personalized greeting
- Two separate checkboxes (Terms of Service, Privacy Policy)
- "Decline" and "Accept & Continue" buttons
- Different styling compared to other onboarding steps

## Proposed Solution

Streamline the terms acceptance to match the visual style and flow of other onboarding steps:

1. **Consistent styling** with other onboarding cards/steps
2. **Single checkbox** or toggle for accepting both Terms and Privacy Policy
3. **Inline links** to view full Terms/Privacy in a modal or new tab
4. **Seamless transition** to next onboarding step
5. **Remove "Decline" button** - user can close app if they don't accept

## Acceptance Criteria

- [x] Terms step matches visual style of other onboarding steps
- [x] Single acceptance action (not two separate checkboxes)
- [x] Terms and Privacy Policy remain accessible via links
- [x] Smooth transition to next step after acceptance
- [x] User greeting/personalization preserved
- [x] Step indicator shown (added 2026-01-10)

## Technical Notes

- Check `src/components/onboarding/` for current implementation
- May involve `TermsStep.tsx` or similar component
- Should integrate with existing onboarding state machine

## References

- Related to overall onboarding polish
