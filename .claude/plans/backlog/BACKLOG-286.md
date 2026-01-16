# BACKLOG-286: Unify Chat Card and Group Chat Card Components

## Category
UI/UX, Code Quality

## Priority
Low

## Status
Pending

## Description

The individual chat card and group chat card in the Text Messages section have inconsistent designs and are likely separate components. They should be unified into a single `ThreadCard` component with variants for individual vs group chats.

## Current State

**Individual Chat Card:**
- Avatar: Letter initial with gradient background (green/teal)
- Title: Contact name
- Subtitle: Phone number
- Preview: Last message text
- Badge: Green "X messages" pill

**Group Chat Card:**
- Avatar: Purple group icon (no initial)
- Title: "Group Chat" label + purple "X people" badge
- Subtitle: Participant names ("Also includes: ...")
- Info: Date range + message count as text (no badge)
- No preview text

## Visual Inconsistencies

1. **Avatar styles differ** - Individual uses colored gradient with initial; group uses icon
2. **Badge placement differs** - Individual has badge on right; group has inline badge after title
3. **Message count display differs** - Individual uses badge; group uses plain text
4. **Information hierarchy differs** - Individual shows preview; group shows date range
5. **Color schemes differ** - Individual uses green; group uses purple

## Proposed Solution

Create a unified `ThreadCard` component with:

```typescript
interface ThreadCardProps {
  variant: 'individual' | 'group';
  contactName: string;
  avatarInitial?: string;
  avatarColor?: string;
  phoneNumber?: string;
  participants?: string[];
  participantCount?: number;
  messageCount: number;
  previewText?: string;
  dateRange?: { start: Date; end: Date };
  threadId: string;
  onView: () => void;
  onUnlink: () => void;
}
```

### Design Decisions Needed

1. Should group chats also show an initial (first participant)?
2. Should individual chats also show date range?
3. Unified badge style - should both use badges for message count?
4. Color coding - keep different colors for visual distinction or unify?

## Acceptance Criteria

- [ ] Single `ThreadCard` component handles both variants
- [ ] Consistent spacing and alignment between variants
- [ ] Consistent badge styling for message counts
- [ ] Consistent avatar sizing and positioning
- [ ] Both variants have same hover/interaction states
- [ ] Existing functionality preserved (view, unlink)
- [ ] Tests cover both variants

## Files Likely Affected

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` (or similar)
- May need to create new unified component
- Update parent component that renders the cards

## Implementation Notes

- Consider using compound component pattern or variant props
- Tailwind's `cva` (class-variance-authority) could help manage variant styles
- Ensure accessibility: proper ARIA labels for both variants

## Related

- Text Messages section in Transaction Details
- `MessageThreadCard` component (current)

## Screenshots/Reference

User provided HTML showing current inconsistent designs.

## Created
2026-01-15
