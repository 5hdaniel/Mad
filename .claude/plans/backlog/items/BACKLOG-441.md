# BACKLOG-441: AI Data Processing Consent Should Only Show for AI Add-on Users

## Summary

The "AI Features - Data Processing Consent" dialog should only be displayed to users who have the AI add-on enabled (`ai_detection_enabled = true`). Users without the AI add-on should never see this consent prompt.

## Category

Bug / License Gating

## Priority

P1 - High (Users seeing irrelevant consent for features they don't have)

## Description

### Problem

The AI data processing consent dialog is shown to all users, regardless of whether they have the AI add-on:

```
AI Features - Data Processing Consent

Before using AI features, please acknowledge:
• Your email content will be sent to OpenAI or Anthropic for analysis.
• This includes email subjects, bodies, and sender/recipient information.
• Personal information is sanitized before sending, but some content may still be transmitted to the AI provider.
• You can revoke consent at any time in settings.

[ ] I understand and consent to this data processing

[Cancel]  [Accept & Continue]
```

This confuses users who don't have AI features - they're being asked to consent to something they can't use.

### Expected Behavior

1. Check `ai_detection_enabled` from the license context
2. If `false` → Never show the AI consent dialog
3. If `true` → Show consent dialog before first AI feature use

### Implementation

Use the existing `LicenseGate` component or `useLicense` hook:

```tsx
const { canAutoDetect } = useLicense();

// Only show AI consent if user has AI add-on
if (canAutoDetect && !hasGivenAIConsent) {
  showAIConsentDialog();
}
```

Or wrap the consent trigger:

```tsx
<LicenseGate requires="ai_addon">
  <AIConsentDialog />
</LicenseGate>
```

## Acceptance Criteria

- [ ] AI consent dialog only shows for users with `ai_detection_enabled = true`
- [ ] Users without AI add-on never see the consent dialog
- [ ] Existing users who already consented are not affected
- [ ] Consent state is still persisted and respected for AI users

## Estimated Effort

~5K tokens

## Dependencies

- License system (BACKLOG-426, implemented in SPRINT-051)

## Related Items

- LicenseContext / useLicense hook
- LicenseGate component
- AI features consent flow
