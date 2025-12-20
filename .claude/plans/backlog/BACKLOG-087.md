# BACKLOG-087: Onboarding Value Proposition Screen (Temptation Bundling)

## Status
- **Priority:** Medium
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-19
- **Type:** UX / Onboarding

## Summary

Add a value proposition screen during onboarding that creates an "aha moment" before users connect their email. Use temptation bundling to pair the hard task (setup) with something desirable (never manually audit again).

## Psychology: Temptation Bundling

> "We're more likely to do the hard stuff when tightly coupled with something tempting."

**Hard task (should):** Connect email, grant permissions, wait for sync
**Tempting reward (want):** Never screenshot transactions again, automated audit trails

By showing the reward upfront, users are motivated to complete setup.

## Current Onboarding Flow

```
1. Welcome screen
2. Terms & Conditions
3. Connect email provider
4. Sync progress
5. Dashboard
```

Missing: No "why this is worth it" moment.

## Proposed Flow

```
1. Welcome screen
2. Terms & Conditions
3. ✨ VALUE PROPOSITION SCREEN ✨  ← NEW
4. Connect email provider
5. Sync progress
6. Dashboard
```

## Value Proposition Screen Design

### Option A: Pain/Solution Contrast

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              Before Magic Audit                     │
│                                                     │
│    📸 Screenshot every transaction email            │
│    📁 Export PDFs for each closing                  │
│    ⏰ Hours spent organizing files                  │
│    😰 Stress before audits                          │
│                                                     │
│              ─────────────────                      │
│                                                     │
│              After Magic Audit                      │
│                                                     │
│    ✨ Transactions found automatically              │
│    📋 Audit trail ready in seconds                  │
│    ☕ More time for what matters                    │
│    😌 Audits? No problem.                          │
│                                                     │
│                                                     │
│         [ See the magic in action → ]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Option B: Time Savings Focus

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                     ⏱️                              │
│                                                     │
│       You spend 2+ hours per transaction            │
│       organizing emails for audit                   │
│                                                     │
│                     ↓                               │
│                                                     │
│       Magic Audit does it in seconds                │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │   10 transactions/month × 2 hours = 20 hrs   │ │
│  │                                               │ │
│  │   That's 240 hours/year you'll get back      │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│                                                     │
│            [ Start saving time → ]                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Option C: Visual Demo Preview

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│          Here's what's about to happen              │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │   [Animation/illustration showing:]           │ │
│  │                                               │ │
│  │   📧 Emails scanning...                       │ │
│  │        ↓                                      │ │
│  │   🏠 Transaction detected!                    │ │
│  │        ↓                                      │ │
│  │   📋 Audit trail ready                        │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│   Your transactions. Found automatically.           │
│   Your audit trail. Built instantly.               │
│                                                     │
│                                                     │
│              [ Let's go → ]                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Option D: Social Proof + Value

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│       "I used to spend my Sundays                   │
│        organizing transaction files.                │
│        Now I just click 'Export Audit'."            │
│                                                     │
│              — Sarah M., Realtor                    │
│                                                     │
│  ───────────────────────────────────────────────── │
│                                                     │
│         ✓ Finds transactions automatically          │
│         ✓ Builds audit trails instantly             │
│         ✓ Export-ready for compliance               │
│                                                     │
│                                                     │
│            [ See it in action → ]                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Recommended Approach

**Option A (Pain/Solution)** for initial release because:
- Clear before/after contrast
- Emotional connection (stress → relief)
- No assets needed (text-based)

Later iterate with:
- Option C animation for polish
- Option D testimonials once we have them

## CTA Button Options

| Button Text | Feeling |
|-------------|---------|
| "See the magic in action" | Curiosity |
| "Start saving time" | Practical value |
| "Let's go" | Excitement, momentum |
| "Find my transactions" | Direct, action-oriented |
| "Set me free" | Emotional relief |

## Implementation Notes

### Location
Insert after Terms & Conditions, before email provider selection.

### File
`src/components/onboarding/OnboardingFlow.tsx`

### New Component
`src/components/onboarding/ValueProposition.tsx`

### Skip Option
Consider: Should users be able to skip?
Recommendation: No skip button - it's one screen, creates anticipation.

## Acceptance Criteria

- [ ] Value proposition screen added to onboarding flow
- [ ] Before/after contrast clearly shown
- [ ] Compelling CTA button
- [ ] Screen appears after T&C, before email connection
- [ ] Mobile-responsive design
- [ ] No skip option (or subtle skip in corner)
- [ ] Smooth transition to next step

## Metrics to Track

- Time spent on screen (engagement)
- Drop-off rate at this step vs. email connection step
- Completion rate through full onboarding
- User feedback/NPS correlation

## Dependencies

- None (can be implemented independently)

## Related Items

- BACKLOG-086: Transaction Discovery Flow (celebration screen)
- Onboarding flow: `src/components/onboarding/OnboardingFlow.tsx`

## Notes

- Keep text concise - this is about emotion, not explanation
- Consider A/B testing different CTAs once analytics is set up
- Could add subtle animation to enhance "magic" feeling
- Future: Personalize based on user's transaction volume
