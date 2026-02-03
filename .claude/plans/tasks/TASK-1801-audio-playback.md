# Task TASK-1801: Implement audio playback for voice messages

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Add audio playback capability to the MessageBubble component so users can listen to voice messages directly in the app using native HTML5 audio controls.

## Non-Goals

- Do NOT implement custom waveform visualization (future enhancement)
- Do NOT support video playback
- Do NOT modify the audio file storage (already handled by attachment system)

## Deliverables

1. **NEW (MANDATORY)**: `src/components/common/AudioPlayer.tsx` - Reusable audio player component
2. Update: `src/components/transactionDetailsModule/components/MessageBubble.tsx` - Integrate AudioPlayer
3. May need: IPC handler for getting attachment file paths

**SR Engineer Requirement:** AudioPlayer MUST be extracted to a separate component to:
- Prevent MessageBubble from exceeding line budgets
- Create reusable component for broker portal (TASK-1803)

## Acceptance Criteria

- [ ] Voice messages show audio player controls
- [ ] Clicking play starts audio playback
- [ ] Audio volume and seek controls available
- [ ] Audio stops at end of message
- [ ] Graceful handling if audio file not found
- [ ] Works in Electron (file:// protocol)
- [ ] Player styled consistently with message bubble
- [ ] Component tests for audio player rendering
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```tsx
// In MessageBubble.tsx or separate AudioPlayer component
interface AudioPlayerProps {
  src: string;
  className?: string;
}

function AudioPlayer({ src, className }: AudioPlayerProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`audio-player ${className}`}>
      {hasError ? (
        <div className="text-sm text-gray-500 italic">
          Audio unavailable
        </div>
      ) : (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          className="w-full h-10"
          onLoadedData={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        >
          <source src={src} type="audio/mp4" />
          <source src={src} type="audio/mpeg" />
          Your browser does not support audio playback.
        </audio>
      )}
    </div>
  );
}

// In MessageBubble - for voice messages
{messageType === 'voice_message' && attachmentPath && (
  <AudioPlayer
    src={`file://${attachmentPath}`}
    className="mt-2"
  />
)}
```

### Getting Attachment Path

The attachment path needs to be resolved. Options:

**Option A: Path already in Communication data**
```typescript
// If attachment storage_path is available in Communication
const attachmentPath = message.attachments?.[0]?.storage_path;
```

**Option B: Resolve via IPC**
```typescript
// May need to add IPC call if path not directly available
const attachmentPath = await window.electron.invoke('get-attachment-path', {
  messageId: message.id,
  attachmentId: message.attachments?.[0]?.id,
});
```

### File Protocol in Electron

```tsx
// Electron file:// URLs need proper formatting
const fileUrl = `file://${attachmentPath.replace(/\\/g, '/')}`;
```

### Audio Formats

iPhone voice messages typically use:
- `audio/x-m4a` or `audio/mp4` (M4A format)
- Some may be `audio/amr` (older iOS)

HTML5 audio supports M4A natively in most browsers.

### Styling

```tsx
// Match the bubble styling
<audio
  controls
  className="w-full h-10 rounded-lg"
  style={{
    // Custom styling for audio controls
    filter: isOutbound ? 'invert(1) hue-rotate(180deg)' : 'none',
  }}
/>
```

### Important Details

- Handle missing attachments gracefully (voice message without file)
- Consider loading state while audio loads
- Memory management - don't preload all audio files
- Test with large voice messages (several minutes)

## Integration Notes

- Imports from: Communication type with attachments
- Used by: MessageBubble component
- Depends on: TASK-1800 (MessageBubble special types)
- Related: Attachment storage from SPRINT-068

## Do / Don't

### Do:

- Use native HTML5 audio for simplicity
- Handle errors gracefully with user-friendly message
- Test with actual iPhone voice message files
- Consider mobile/responsive sizing

### Don't:

- Don't auto-play audio (bad UX)
- Don't implement custom controls (native is sufficient)
- Don't load audio until user interaction if possible

## When to Stop and Ask

- If attachment path is not accessible from renderer
- If Electron security policy blocks file:// URLs
- If audio format is unsupported

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test audio player renders for voice messages
  - Test error state when audio file missing
  - Test loading state
- Integration tests:
  - Manual test with actual voice message file

### Coverage

- Coverage impact: Should not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(ui): add audio playback for voice messages`
- **Labels**: `ui`, `enhancement`, `audio`
- **Depends on**: TASK-1800

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +5K |
| Audio component | ~80 lines | +8K |
| IPC if needed | ~30 lines | +5K |
| Test complexity | File path handling | +7K |

**Confidence:** Medium

**Risk factors:**
- Electron file:// protocol handling
- Audio format compatibility

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
- [ ] [Optional] src/components/common/AudioPlayer.tsx

Features implemented:
- [ ] Audio player component
- [ ] Play/pause/seek controls
- [ ] Error handling for missing files
- [ ] File path resolution

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test with voice message file
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Verification (MANDATORY)

- [ ] PR merged and verified
- [ ] Task can now be marked complete
