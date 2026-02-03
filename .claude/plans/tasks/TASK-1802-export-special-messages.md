# Task TASK-1802: Update PDF/folder export for special message types

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Update the folder export service to properly handle special message types in PDF output, ensuring voice message transcripts and location information are included in audit packages.

## Non-Goals

- Do NOT modify message parsing (already done)
- Do NOT modify MessageBubble (separate task)
- Do NOT embed audio in PDF (reference file path only)

## Deliverables

1. Update: `electron/services/folderExportService.ts`

## Acceptance Criteria

- [ ] Voice messages in PDF show "[Voice Message - Transcript:]" indicator
- [ ] Voice message transcript text included in PDF
- [ ] Audio file referenced in PDF (filename)
- [ ] Location messages show "[Location Shared]" indicator
- [ ] Location description text included
- [ ] System messages handled appropriately
- [ ] Summary report includes count of special message types
- [ ] Attachment-only messages show "[Media Attachment]"
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// In folderExportService.ts - when rendering messages to PDF

function formatMessageForPdf(message: Communication): string {
  const messageType = message.message_type || 'text';
  const timestamp = formatTimestamp(message.sent_at || message.received_at);
  const sender = message.direction === 'outbound' ? 'You' : getSenderName(message);

  let content: string;

  switch (messageType) {
    case 'voice_message':
      content = `[Voice Message - Transcript:]\n${message.audio_transcript || message.body_text || '[No transcript available]'}`;
      // Reference audio file if available
      if (message.attachments?.length) {
        content += `\n[Audio file: ${message.attachments[0].filename}]`;
      }
      break;

    case 'location':
      content = `[Location Shared]\n${message.body_text || 'Location information'}`;
      break;

    case 'attachment_only':
      const attachmentDesc = message.attachments?.map(a => a.filename).join(', ') || 'attachment';
      content = `[Media Attachment: ${attachmentDesc}]`;
      break;

    case 'system':
      content = `-- ${message.body_text || 'System message'} --`;
      break;

    case 'text':
    default:
      content = message.body_text || message.body_plain || message.body || '';
      break;
  }

  return `${timestamp} ${sender}:\n${content}\n`;
}
```

### Summary Report Update

```typescript
// Add special message counts to summary
interface ConversationSummary {
  totalMessages: number;
  textMessages: number;
  voiceMessages: number;
  locationMessages: number;
  attachmentOnlyMessages: number;
  systemMessages: number;
}

function generateConversationSummary(messages: Communication[]): ConversationSummary {
  return {
    totalMessages: messages.length,
    textMessages: messages.filter(m => m.message_type === 'text' || !m.message_type).length,
    voiceMessages: messages.filter(m => m.message_type === 'voice_message').length,
    locationMessages: messages.filter(m => m.message_type === 'location').length,
    attachmentOnlyMessages: messages.filter(m => m.message_type === 'attachment_only').length,
    systemMessages: messages.filter(m => m.message_type === 'system').length,
  };
}

// In PDF summary section
`Message Summary:
- Total Messages: ${summary.totalMessages}
- Text Messages: ${summary.textMessages}
- Voice Messages: ${summary.voiceMessages}
- Location Messages: ${summary.locationMessages}
- Media Attachments: ${summary.attachmentOnlyMessages}
- System Messages: ${summary.systemMessages}`
```

### PDF Visual Formatting

```typescript
// Consider visual differentiation in PDF
// Voice messages could be indented or have a different style

// For PDF-lib (or whatever PDF library is used):
function addVoiceMessageToPdf(page: PDFPage, message: Communication, y: number): number {
  // Add indicator line
  page.drawText('[Voice Message - Transcript:]', {
    x: margin,
    y: y,
    size: 10,
    font: italicFont,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= lineHeight;

  // Add transcript text
  if (message.audio_transcript) {
    page.drawText(message.audio_transcript, {
      x: margin + indent,
      y: y,
      size: 10,
      font: regularFont,
    });
    y -= calculateTextHeight(message.audio_transcript);
  }

  // Add audio file reference
  if (message.attachments?.length) {
    page.drawText(`[Audio file: ${message.attachments[0].filename}]`, {
      x: margin,
      y: y,
      size: 8,
      font: italicFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= lineHeight;
  }

  return y;
}
```

### Important Details

- Maintain existing PDF formatting for regular messages
- Don't break existing export functionality
- Handle missing transcript gracefully
- Consider PDF page breaks for long transcripts

## Integration Notes

- Imports from: Communication type with message_type
- Used by: Export handlers, audit package generation
- Depends on: TASK-1799 (message_type field)

## Do / Don't

### Do:

- Preserve existing export behavior for text messages
- Include helpful context for special messages
- Reference attachment files (don't embed audio)
- Update summary statistics

### Don't:

- Don't try to embed audio in PDF
- Don't break existing export functionality
- Don't change attachment file handling

## When to Stop and Ask

- If PDF library doesn't support needed formatting
- If existing export structure is significantly different
- If message_type field is not available in export context

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test voice message PDF formatting
  - Test location message formatting
  - Test summary statistics calculation
- Existing tests to update:
  - Add message_type to mock data

### Coverage

- Coverage impact: Should not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(export): handle special message types in PDF export`
- **Labels**: `export`, `enhancement`
- **Depends on**: TASK-1799

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file | +4K |
| Code changes | ~80 lines | +5K |
| Test complexity | Low-medium | +6K |

**Confidence:** Medium-High

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
- [ ] electron/services/folderExportService.ts

Features implemented:
- [ ] Voice message PDF formatting
- [ ] Location message formatting
- [ ] Attachment-only formatting
- [ ] Summary statistics update

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test export with special messages
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Verification (MANDATORY)

- [ ] PR merged and verified
- [ ] Task can now be marked complete
