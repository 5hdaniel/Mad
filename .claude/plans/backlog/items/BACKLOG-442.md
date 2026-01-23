# BACKLOG-442: Gray Out AI Settings Section for Non-AI Users

## Summary

The AI Settings section in the Settings page should be grayed out/disabled for users who don't have the AI add-on (`ai_detection_enabled = false`). Currently, all users can see and interact with AI settings even if they don't have access to AI features.

## Category

Enhancement / License Gating

## Priority

P2 - Medium (Confusing UX but not breaking)

## Description

### Problem

Users without the AI add-on can see the full AI Settings section:
- OpenAI / Anthropic toggle
- API Key input
- Validate Key button
- Model selection
- Usage statistics
- "Use Platform Allowance" toggle
- AI Features toggles (Auto-Detect, Role Extraction)

This is confusing because:
1. They can enter API keys but can't use them
2. They see features they don't have access to
3. No indication that these features require the AI add-on

### Expected Behavior

For users WITHOUT AI add-on:
1. AI Settings section should be visually grayed out / disabled
2. Show an overlay or badge: "AI Add-on Required"
3. Optionally show "Upgrade" link/button
4. All inputs and toggles should be non-interactive

### UI Mockup

```
┌─────────────────────────────────────────────────────┐
│ AI Settings                    🔒 AI Add-on Required │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │        (Grayed out / 50% opacity)               │ │
│ │                                                 │ │
│ │  OpenAI API Key                                 │ │
│ │  [________________________] [Validate]          │ │
│ │                                                 │ │
│ │  Model: GPT-4o Mini                            │ │
│ │                                                 │ │
│ │  ☐ Auto-Detect Transactions                    │ │
│ │  ☐ Role Extraction                             │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│  [Contact Sales to Enable AI Features]              │
└─────────────────────────────────────────────────────┘
```

### Implementation

Use the existing `LicenseGate` component:

```tsx
<LicenseGate
  requires="ai_addon"
  fallback={<AISettingsDisabled />}
>
  <AISettings />
</LicenseGate>
```

Or apply disabled styling:

```tsx
const { canAutoDetect } = useLicense();

<div className={!canAutoDetect ? 'opacity-50 pointer-events-none' : ''}>
  <AISettings />
  {!canAutoDetect && <UpgradeOverlay />}
</div>
```

## Acceptance Criteria

- [ ] AI Settings section grayed out for non-AI users
- [ ] All inputs/toggles disabled and non-interactive
- [ ] Clear indication that AI add-on is required
- [ ] Optional: "Upgrade" or "Contact Sales" CTA
- [ ] AI users see normal, fully interactive settings
- [ ] Existing AI user settings are preserved

## Estimated Effort

~8K tokens

## Dependencies

- License system (SPRINT-051)
- BACKLOG-441: AI consent gating

## Related Items

- BACKLOG-441: AI consent for AI users only
- LicenseGate component
- Settings page
