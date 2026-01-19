# BACKLOG-081: Consolidate AI Consent into Terms and Conditions

## Status
- **Priority:** Medium
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-18
- **Type:** Enhancement

## Summary

Move the AI data processing consent from a separate modal into the main Terms and Conditions document. Users should agree to AI data processing as part of the standard T&C acceptance flow rather than seeing a separate consent popup.

## Current Behavior

When users access LLM Settings for the first time, they see a separate "AI Features - Data Processing Consent" modal with:
- Acknowledgment that email content will be sent to OpenAI/Anthropic
- Details about email subjects, bodies, sender/recipient info being transmitted
- Note about personal information sanitization
- Ability to revoke consent in settings

## Desired Behavior

1. **Update Terms and Conditions** to include an AI/LLM data processing section covering:
   - What data is sent to AI providers (email content, subjects, bodies, contacts)
   - Which providers may receive data (OpenAI, Anthropic)
   - Data sanitization practices
   - User's right to opt-out/revoke consent
   - Data retention policies of AI providers

2. **Remove separate consent modal** from LLMSettings.tsx (or make it supplementary)

3. **Track consent via T&C version** - If user accepted T&C v2.0 which includes AI consent, they don't need separate AI consent

4. **Settings should still show consent status** and allow users to view/revoke

## Acceptance Criteria

- [ ] Terms and Conditions document updated with AI data processing section
- [ ] T&C version bumped to reflect new content
- [ ] Onboarding T&C acceptance covers AI consent
- [ ] LLM Settings shows consent status based on T&C acceptance
- [ ] Users can still revoke AI consent specifically in settings
- [ ] Existing users who haven't accepted new T&C see updated version

## Technical Notes

- Current consent logic: `src/components/settings/LLMSettings.tsx` (ConsentModal component)
- T&C acceptance tracked in user settings/database
- May need T&C versioning to track which version user accepted
- Consider: Should AI consent be revocable separately from T&C?

## Dependencies

- None blocking

## Related Items

- BACKLOG-078: AI MVP UI Enhancements (SPRINT-006)
