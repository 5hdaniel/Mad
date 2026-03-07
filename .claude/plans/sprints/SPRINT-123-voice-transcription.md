# SPRINT-123: Voice Message Transcription

**Created:** 2026-03-06
**Status:** Planned
**Goal:** Add speech-to-text transcription for voice messages during iPhone sync when Apple's native transcript is unavailable

---

## Sprint Narrative

The desktop app already detects voice messages (`message_type = "voice_message"`) and reads Apple's native `audio_transcript` column from the iPhone backup's messages database when available. However, many iOS versions and voice messages do not populate this column, leaving voice messages without text content for audit purposes. This sprint adds a fallback: extract audio attachments from voice messages, run speech-to-text transcription (using a local or cloud-based STT service), and store the transcript alongside the message. This gives auditors readable text for every voice message, not just those with Apple-provided transcripts.

---

## In-Scope

| Task | Backlog | Title | Est. Tokens | Status |
|------|---------|-------|-------------|--------|
| TASK-2130 | BACKLOG-895 | Voice Message Text Transcription Support | ~50K | Pending |

### Key Deliverables

1. **Audio extraction:** Extract audio attachment files (CAF/AMR/M4A) from iPhone backup for voice messages missing `audio_transcript`
2. **Transcription service:** Integrate speech-to-text (Whisper API or local whisper.cpp) for audio-to-text conversion
3. **Transcript storage:** Store generated transcript in the `audio_transcript` column or a new dedicated column
4. **Progress reporting:** Report transcription progress through existing sync progress mechanism
5. **Opt-in configuration:** Setting to enable/disable voice transcription (may incur API costs if cloud-based)

## Out of Scope / Deferred

- macOS Messages voice message transcription (desktop iMessage, not iPhone sync)
- Real-time voice transcription during calls
- Video message transcription
- Multi-language transcription configuration (default to English initially)
- Feature flagging for transcription (can be added when SPRINT-122 is complete)
- Broker portal display changes (transcripts already render via existing `audio_transcript` field)

---

## Dependencies

- No upstream sprint dependencies -- this is fully independent
- Independent of SPRINT-121 (feature flags) and SPRINT-122 (plan admin)
- Independent of SPRINT-116 (impersonation) and SPRINT-117 (SOC 2)
- Builds on existing iPhone sync infrastructure (SPRINT-114)

---

## Task Breakdown

### Phase 1: Full Implementation (Sequential -- single task)

| Task | Title | Est. Tokens | Status |
|------|-------|-------------|--------|
| TASK-2130 | Voice Message Text Transcription Support | ~50K | Pending |

**Execution:** Sequential. Single task.

**Dependency:** None -- independent sprint.

---

## Dependency Graph

```
TASK-2130 (Voice Transcription)
    |
    (no downstream dependencies in current backlog)
```

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| Engineer work | ~50K |
| SR Review (1 review x ~20K) | ~20K |
| **Total** | **~70K** |

---

## Merge Plan

- No integration branch needed (single task)
- Target: `develop`
- Branch: `feature/task-2130-voice-transcription`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audio format compatibility (CAF/AMR/M4A) | High | Use ffmpeg or built-in Node audio libraries for format conversion; test with real iPhone backup samples |
| Cloud STT API costs per voice message | Medium | Make transcription opt-in; consider local whisper.cpp for zero-cost alternative |
| Transcription quality varies by audio quality | Medium | Store confidence score alongside transcript; mark as "auto-transcribed" |
| Large audio files slow down sync | Medium | Process transcription asynchronously after main sync completes; show progress separately |
| Privacy concerns with cloud STT | High | Offer local-only transcription option; document data handling in privacy policy |
| Electron/Node.js audio processing overhead | Medium | Use worker thread for transcription to avoid blocking main process |

---

## Technical Context

### Existing Voice Message Infrastructure

The app already has:
- `MessageType = "voice_message"` type (`electron/types/models.ts`)
- `audioTranscript` field on parsed messages (`electron/types/iosMessages.ts`)
- `audio_transcript` column detection in iOS messages DB (`electron/services/iosMessagesParser.ts`)
- `detectMessageType()` utility that checks `hasAudioTranscript` (`electron/utils/messageTypeDetector.ts`)
- Voice message rendering in `MessageBubble.tsx` and export in `textExportHelpers.ts`
- Storage of `audio_transcript` in local SQLite via `iPhoneSyncStorageService.ts`

### What This Sprint Adds

The gap is: when Apple's `audio_transcript` column is NULL or the column does not exist, voice messages have no text. This sprint fills that gap by running STT on the audio attachment.

---

## Testing Plan

| Surface | Requirement |
|---------|-------------|
| Unit tests | Audio extraction from backup, format detection, transcript storage |
| Integration | End-to-end: voice message with no Apple transcript gets auto-transcribed |
| Existing tests | All existing message parsing and storage tests continue to pass |
| CI | `npm test`, `npm run type-check`, `npm run lint` all pass |

---

## Task Files

- `.claude/plans/tasks/TASK-2130-voice-transcription.md`
