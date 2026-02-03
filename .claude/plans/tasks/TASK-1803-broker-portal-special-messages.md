# Task TASK-1803: Broker portal support for special message types

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Ensure special message types (voice messages, location sharing) are properly displayed in the broker portal web application, including syncing message_type field and enabling audio playback in browser context.

## Non-Goals

- Do NOT modify desktop app display (already done)
- Do NOT implement video playback
- Do NOT add map visualization for locations

## Deliverables

1. Verify/Update: Supabase schema includes `message_type` column
2. Verify/Update: Sync service includes `message_type` in sync
3. Update: Broker portal message components (if needed)

## Acceptance Criteria

- [ ] `message_type` field syncs to Supabase
- [ ] Portal displays "[Voice Message]" for voice messages
- [ ] Portal shows transcript below voice message indicator
- [ ] Audio playback works in web browser (from Supabase Storage)
- [ ] Portal displays "[Location Shared]" for location messages
- [ ] Location text displays correctly
- [ ] No regression in existing portal functionality
- [ ] All CI checks pass

## Implementation Notes

### Data Sync

```typescript
// Verify message_type is included in Supabase sync
// In the sync service that pushes to Supabase

interface MessageSyncPayload {
  // ... existing fields ...
  message_type?: MessageType;
  audio_transcript?: string;
}

// Ensure these fields are mapped when syncing
function mapMessageToSupabase(message: Message): MessageSyncPayload {
  return {
    // ... existing mappings ...
    message_type: message.message_type,
    audio_transcript: message.audio_transcript,
  };
}
```

### Supabase Schema

```sql
-- If message_type column doesn't exist in Supabase
ALTER TABLE messages ADD COLUMN message_type TEXT;
ALTER TABLE messages ADD COLUMN audio_transcript TEXT;
```

### Broker Portal UI

```tsx
// In broker portal message component (web React)
function MessageDisplay({ message }: { message: SyncedMessage }) {
  const messageType = message.message_type || 'text';

  if (messageType === 'voice_message') {
    return (
      <div className="voice-message">
        <div className="indicator">
          <MicrophoneIcon /> Voice Message
        </div>
        {message.audio_transcript && (
          <div className="transcript">{message.audio_transcript}</div>
        )}
        {message.audio_url && (
          <audio controls src={message.audio_url}>
            Audio not supported
          </audio>
        )}
      </div>
    );
  }

  // ... other message types
}
```

### Audio File Access

For broker portal audio playback:

```typescript
// Audio files need to be accessible via Supabase Storage
// Option 1: Upload audio to Supabase Storage during sync
// Option 2: Generate signed URLs for desktop-stored files (complex)

// If using Supabase Storage:
const audioUrl = supabase.storage
  .from('message-attachments')
  .getPublicUrl(message.attachment_path);
```

### Important Details

- Broker portal is a separate web application
- Audio files may need to be uploaded to cloud storage for web access
- Consider bandwidth/storage implications
- May need signed URLs for private audio files

## Integration Notes

- Imports from: Supabase database, Storage
- Depends on: TASK-1799 (message_type field), desktop sync implementation
- This task spans desktop (sync) and portal (display)

## Do / Don't

### Do:

- Verify sync is working before modifying portal
- Use Supabase Storage for audio if needed
- Handle missing audio gracefully
- Test in actual browser (not just Electron)

### Don't:

- Don't duplicate large files unnecessarily
- Don't break existing portal functionality
- Don't assume audio URLs are publicly accessible

## When to Stop and Ask

- If Supabase schema changes require migration coordination
- If audio file storage strategy unclear
- If broker portal codebase is not accessible

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (for sync logic)
- New tests to write:
  - Test message_type included in sync payload
  - Test audio_transcript synced
- Portal tests may be in separate repo

### Coverage

- Coverage impact: Should not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(sync): support special message types in broker portal`
- **Labels**: `sync`, `portal`, `enhancement`
- **Depends on**: TASK-1799, TASK-1800, TASK-1801

---

## PM Estimate (PM-Owned)

**Category:** `service` + `schema`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Sync updates | ~30 lines | +5K |
| Schema changes | Migration | +3K |
| Portal UI | ~50 lines | +5K |
| Testing | Medium | +2K |

**Confidence:** Low (depends on portal access)

**Risk factors:**
- Portal codebase may be separate repo
- Audio storage strategy TBD
- May require coordination with B2B team

**Note:** This is a stretch goal. May be deferred if sprint runs long.

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
- [ ] Sync service (message_type in payload)
- [ ] Supabase schema (if needed)
- [ ] Broker portal components (if accessible)

Features implemented:
- [ ] message_type syncs to Supabase
- [ ] audio_transcript syncs
- [ ] Portal displays special message types
- [ ] Audio playback works in browser

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test in broker portal
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Verification (MANDATORY)

- [ ] PR merged and verified
- [ ] Task can now be marked complete
