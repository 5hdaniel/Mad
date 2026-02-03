# Task TASK-1800: Update MessageBubble for special message type display

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Update the MessageBubble component to display special message types with appropriate indicators, styling, and transcript text. Voice messages show "[Voice Message]" with transcript, location messages show "[Location Shared]" with location text.

## Non-Goals

- Do NOT implement audio playback (separate task: TASK-1801)
- Do NOT modify the data parsing layer (already done in TASK-1798)
- Do NOT update export service (separate task: TASK-1802)

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/MessageBubble.tsx`
2. Optional: Add icon components if needed

## Acceptance Criteria

- [ ] Voice messages display "[Voice Message]" indicator with microphone icon
- [ ] Voice message transcript displays below indicator (if present)
- [ ] Location messages display "[Location Shared]" indicator with pin icon
- [ ] Location description text displays properly
- [ ] System messages styled distinctly (centered, muted)
- [ ] Regular text messages unchanged
- [ ] Attachment-only messages show "[Media Attachment]"
- [ ] Component is accessible (aria labels)
- [ ] Component tests cover all message types
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```tsx
// In MessageBubble.tsx
import { MicrophoneIcon, MapPinIcon, PaperClipIcon } from '@heroicons/react/24/outline';

export function MessageBubble({ message, senderName, showSender = true }: MessageBubbleProps): React.ReactElement {
  const isOutbound = message.direction === "outbound";
  const messageType = message.message_type || 'text';

  // Get display content based on message type
  const { indicator, displayText, icon: Icon } = getMessageContent(message, messageType);

  return (
    <div
      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
      data-testid="message-bubble"
      data-direction={message.direction}
      data-message-type={messageType}
    >
      {/* System messages are centered and styled differently */}
      {messageType === 'system' ? (
        <div className="text-center text-xs text-gray-500 italic py-1">
          {displayText}
        </div>
      ) : (
        <div className={bubbleClasses}>
          {/* Special message indicator */}
          {indicator && (
            <div className={`flex items-center gap-1.5 mb-1 ${indicatorClasses}`}>
              {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
              <span className="font-medium text-sm">{indicator}</span>
            </div>
          )}

          {/* Message content */}
          <p className={textClasses}>
            {displayText}
          </p>

          {/* Timestamp */}
          {/* ... existing timestamp code ... */}
        </div>
      )}
    </div>
  );
}

// Helper function to determine display content
function getMessageContent(
  message: Communication,
  messageType: MessageType
): { indicator: string | null; displayText: string; icon: React.ComponentType | null } {
  switch (messageType) {
    case 'voice_message':
      return {
        indicator: 'Voice Message',
        displayText: message.audio_transcript || message.body_text || '[No transcript available]',
        icon: MicrophoneIcon,
      };

    case 'location':
      return {
        indicator: 'Location Shared',
        displayText: message.body_text || 'Location information',
        icon: MapPinIcon,
      };

    case 'attachment_only':
      return {
        indicator: 'Media Attachment',
        displayText: getAttachmentDescription(message),
        icon: PaperClipIcon,
      };

    case 'system':
      return {
        indicator: null,
        displayText: message.body_text || '',
        icon: null,
      };

    case 'text':
    default:
      return {
        indicator: null,
        displayText: message.body_text || message.body_plain || message.body || '',
        icon: null,
      };
  }
}
```

### Styling Classes

```tsx
// Indicator styling
const indicatorClasses = isOutbound
  ? 'text-blue-100'
  : 'text-gray-600';

// Special indicator text should be slightly italic/muted
const specialIndicatorClasses = 'italic opacity-90';
```

### Communication Type Extension

Ensure the Communication type includes the new fields:

```typescript
// The Communication type should now have:
interface Communication {
  // ... existing fields ...
  message_type?: MessageType;
  audio_transcript?: string; // For voice messages
}
```

### Important Details

- Use Heroicons for consistent icon styling
- Ensure proper contrast for accessibility
- Test with both inbound and outbound styling
- Handle missing/undefined message_type gracefully (default to text)

## Integration Notes

- Imports from: `@/types` (Communication, MessageType)
- Used by: ConversationView (parent component)
- Depends on: TASK-1798 (parsing), TASK-1799 (message_type field)

## Do / Don't

### Do:

- Preserve existing text message behavior
- Use semantic HTML for accessibility
- Add data-testid attributes for testing
- Handle all message types gracefully

### Don't:

- Don't add audio playback in this task
- Don't break existing message display
- Don't remove existing styling/functionality

## When to Stop and Ask

- If the icon library is not available
- If Communication type doesn't have expected fields
- If styling conflicts with existing theme

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test voice message rendering with/without transcript
  - Test location message rendering
  - Test attachment-only rendering
  - Test system message styling
  - Test default text behavior
- Existing tests to update:
  - Update mocks to include message_type

### Coverage

- Coverage impact: Should not decrease
- All message type branches should be covered

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(ui): display special message types in MessageBubble`
- **Labels**: `ui`, `enhancement`
- **Depends on**: TASK-1798, TASK-1799

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +6K |
| UI code | ~100 lines | +6K |
| Test complexity | Multiple branches | +8K |

**Confidence:** Medium

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/components/transactionDetailsModule/components/MessageBubble.tsx

Features implemented:
- [ ] Voice message indicator and transcript
- [ ] Location message indicator
- [ ] Attachment-only indicator
- [ ] System message styling
- [ ] Icon integration

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Verification (MANDATORY)

- [ ] PR merged and verified
- [ ] Task can now be marked complete
