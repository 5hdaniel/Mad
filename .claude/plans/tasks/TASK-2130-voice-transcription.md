# TASK-2130: Voice Message Text Transcription Support

**Backlog ID:** BACKLOG-895
**Sprint:** SPRINT-123
**Phase:** Phase 1 - Full Implementation (Sequential)
**Depends On:** None (independent sprint)
**Branch:** `feature/task-2130-voice-transcription`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~40K (service category x 0.5 = ~20K base, +20K for audio processing complexity = ~50K adjusted)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add speech-to-text transcription for voice messages during iPhone sync when Apple's native `audio_transcript` column is not available or is empty. Extract audio attachments from the iPhone backup, run them through a speech-to-text engine, and store the resulting transcript so that auditors have readable text for every voice message.

## Non-Goals

- Do NOT transcribe macOS Messages voice messages (desktop iMessage sync) -- iPhone sync only
- Do NOT add real-time call transcription
- Do NOT transcribe video messages
- Do NOT build multi-language transcription configuration (English default is sufficient)
- Do NOT add feature flag gating for transcription in this task (SPRINT-119 handles gating infrastructure)
- Do NOT modify broker portal or admin portal -- transcripts already render via existing `audio_transcript` field
- Do NOT modify the Supabase schema -- transcripts are stored locally in SQLite

## Deliverables

1. New file: `electron/services/voiceTranscriptionService.ts` -- STT service wrapper
2. New file: `electron/services/__tests__/voiceTranscriptionService.test.ts` -- Unit tests
3. Update: `electron/services/iPhoneSyncStorageService.ts` -- Call transcription service for voice messages without transcripts
4. Update: `electron/types/iosMessages.ts` -- Add transcription source field if needed
5. New file: `electron/utils/audioExtractor.ts` -- Extract and convert audio from iPhone backup attachments
6. New file: `electron/utils/__tests__/audioExtractor.test.ts` -- Audio extraction tests
7. Configuration: Add transcription settings to user preferences (opt-in, STT provider choice)

## File Boundaries

### Files to modify (owned by this task):

- `electron/services/voiceTranscriptionService.ts` (new)
- `electron/services/__tests__/voiceTranscriptionService.test.ts` (new)
- `electron/services/iPhoneSyncStorageService.ts` (add transcription call)
- `electron/types/iosMessages.ts` (add transcription metadata fields if needed)
- `electron/utils/audioExtractor.ts` (new)
- `electron/utils/__tests__/audioExtractor.test.ts` (new)

### Files this task must NOT modify:

- Any `admin-portal/` or `broker-portal/` files
- Any `supabase/` files
- `electron/services/iosMessagesParser.ts` -- Only reads from iPhone DB; transcription happens after parsing
- `electron/services/syncOrchestratorService.ts` -- Do not modify sync flow orchestration
- `src/components/transactionDetailsModule/components/MessageBubble.tsx` -- Already renders `audio_transcript`

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `VoiceTranscriptionService` exists with `transcribe(audioFilePath)` method
- [ ] Service supports at least one STT backend (OpenAI Whisper API recommended)
- [ ] Service has a local fallback option (whisper.cpp or similar) for privacy-sensitive deployments
- [ ] `audioExtractor` can extract audio files from iPhone backup attachment paths
- [ ] `audioExtractor` handles CAF, AMR, and M4A formats (convert to WAV/MP3 if needed for STT API)
- [ ] During iPhone sync, voice messages with empty `audio_transcript` are queued for transcription
- [ ] Transcription runs asynchronously after main message import (does NOT block sync)
- [ ] Generated transcript is stored in the local SQLite `audio_transcript` column
- [ ] Transcription source is distinguishable (Apple native vs auto-generated)
- [ ] Transcription is opt-in via user settings (default: disabled)
- [ ] Progress is reported through existing sync progress mechanism
- [ ] Errors during transcription do not crash the sync or lose other data
- [ ] Unit tests cover service initialization, transcription call, error handling, and audio extraction
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Architecture Overview

```
iPhone Sync Flow (existing):
  iosMessagesParser.ts → parses messages → iPhoneSyncStorageService.ts → stores in SQLite

New addition (after storage):
  iPhoneSyncStorageService.ts
    → identifies voice_message with empty audio_transcript
    → queues for transcription
    → voiceTranscriptionService.ts
        → audioExtractor.ts (extract audio file from backup)
        → STT API call (Whisper API or local whisper.cpp)
        → returns transcript text
    → updates SQLite audio_transcript column
```

### VoiceTranscriptionService

```typescript
// electron/services/voiceTranscriptionService.ts

export interface TranscriptionResult {
  text: string;
  confidence: number;    // 0-1, from STT API
  source: 'whisper_api' | 'whisper_local' | 'apple_native';
  language: string;      // Detected language
  durationMs: number;    // Audio duration
}

export interface TranscriptionConfig {
  enabled: boolean;
  provider: 'whisper_api' | 'whisper_local';
  apiKey?: string;        // For Whisper API
  model?: string;         // 'whisper-1' for OpenAI
}

class VoiceTranscriptionService {
  private config: TranscriptionConfig;

  constructor(config: TranscriptionConfig) {
    this.config = config;
  }

  async transcribe(audioFilePath: string): Promise<TranscriptionResult> {
    if (this.config.provider === 'whisper_api') {
      return this.transcribeWithWhisperAPI(audioFilePath);
    }
    return this.transcribeWithWhisperLocal(audioFilePath);
  }

  private async transcribeWithWhisperAPI(audioFilePath: string): Promise<TranscriptionResult> {
    // Use OpenAI Whisper API
    // POST https://api.openai.com/v1/audio/transcriptions
    // Accepts: m4a, mp3, webm, mp4, mpga, wav
    // May need to convert CAF/AMR to a supported format first
  }

  private async transcribeWithWhisperLocal(audioFilePath: string): Promise<TranscriptionResult> {
    // Use whisper.cpp via Node.js bindings or child_process
    // This is the privacy-preserving option (no data leaves the machine)
    // May require bundling whisper.cpp model files
  }
}
```

### Audio Extractor

```typescript
// electron/utils/audioExtractor.ts

export interface AudioFile {
  path: string;
  format: 'caf' | 'amr' | 'm4a' | 'wav' | 'mp3' | 'unknown';
  sizeBytes: number;
}

/**
 * Extract audio attachment from iPhone backup.
 *
 * iPhone backups store attachments with hashed filenames in a flat structure.
 * The attachment path from the messages DB maps to a file in the backup.
 */
export async function extractAudioFromBackup(
  backupPath: string,
  attachmentRelativePath: string
): Promise<AudioFile | null> {
  // 1. Resolve the attachment path in the iPhone backup
  // 2. Check if the file exists and is an audio file
  // 3. Return the file info
}

/**
 * Convert audio to a format compatible with the STT API.
 * Whisper API accepts: m4a, mp3, webm, mp4, mpga, wav
 * iPhone voice messages are typically CAF or AMR format.
 */
export async function convertAudioForSTT(
  inputPath: string,
  outputFormat: 'wav' | 'mp3' = 'wav'
): Promise<string> {
  // Use ffmpeg (if available) or a Node.js audio library
  // Convert CAF/AMR to WAV/MP3
  // Return path to converted file
}
```

### Integration with iPhoneSyncStorageService

In `iPhoneSyncStorageService.ts`, after storing messages, queue voice messages for transcription:

```typescript
// After the main message storage loop:
if (transcriptionEnabled) {
  const voiceMessagesWithoutTranscript = storedMessages.filter(
    msg => msg.message_type === 'voice_message' && !msg.audio_transcript
  );

  if (voiceMessagesWithoutTranscript.length > 0) {
    // Process asynchronously -- do NOT block sync
    this.queueTranscriptions(voiceMessagesWithoutTranscript, backupPath);
  }
}
```

### Transcription Metadata

Add a field to track whether the transcript was auto-generated vs Apple-native:

```typescript
// In electron/types/iosMessages.ts, add:
export type TranscriptionSource = 'apple_native' | 'whisper_api' | 'whisper_local';

// The existing audioTranscript field stores the text
// Add a new field for source tracking:
audioTranscriptSource?: TranscriptionSource | null;
```

### Local SQLite Storage

The transcript goes into the existing `audio_transcript` column in the messages table. Add a `audio_transcript_source` column if it does not exist:

```typescript
// In the message storage service, check for and add the column:
// ALTER TABLE messages ADD COLUMN audio_transcript_source TEXT DEFAULT NULL;
```

### Settings Integration

Add transcription settings to user preferences:

```typescript
// In the settings/preferences system:
voiceTranscription: {
  enabled: boolean;       // Default: false (opt-in)
  provider: 'whisper_api' | 'whisper_local';
  apiKey: string;         // Encrypted via safeStorage
}
```

### Important Details

- **Audio formats:** iPhone voice messages are typically CAF (Core Audio Format) or AMR. The Whisper API accepts M4A/MP3/WAV. Conversion may be needed.
- **ffmpeg dependency:** If ffmpeg is required for audio conversion, check if it's already bundled or available on the user's system. Consider using `fluent-ffmpeg` npm package.
- **Worker thread:** Transcription should run in a worker thread to avoid blocking the main process. Check existing worker thread patterns in the codebase.
- **Rate limiting:** If using cloud API, respect rate limits and add retries with exponential backoff.
- **Cost visibility:** If using Whisper API, log the number of minutes transcribed so users understand API costs.
- **Existing infrastructure:** The `audioTranscript` field already flows through the entire pipeline (parsing -> storage -> export -> UI). Once this task stores a transcript, it will automatically appear in MessageBubble and text exports.

### Audio File Size Considerations

- Whisper API max file size: 25 MB
- Most voice messages are under 1 minute (~500 KB to 2 MB)
- For messages > 25 MB, skip transcription and log a warning

## Integration Notes

- **Independent:** No dependency on feature flag sprints (118/119) or other active sprints
- **Uses:** `iPhoneSyncStorageService.ts` (existing message storage pipeline)
- **Uses:** `iosMessagesParser.ts` (existing -- reads audioTranscript from iPhone DB, not modified)
- **Leverages:** Existing `audio_transcript` column in local SQLite and `audioTranscript` field in types
- **Leverages:** Existing `voice_message` type detection and rendering

## Do / Don't

### Do:
- Make transcription opt-in (disabled by default)
- Run transcription asynchronously (do NOT block sync completion)
- Use a worker thread for audio processing
- Support both cloud (Whisper API) and local (whisper.cpp) STT
- Store transcripts in the existing `audio_transcript` column
- Track transcription source (apple_native vs auto-generated)
- Handle errors gracefully -- a failed transcription should not affect other messages
- Encrypt API keys via safeStorage

### Don't:
- Do NOT block the iPhone sync waiting for transcription
- Do NOT send audio data to cloud APIs without user opt-in
- Do NOT modify the sync orchestrator flow
- Do NOT modify the message parser (it reads from iPhone DB; transcription happens after)
- Do NOT modify UI components (they already render audio_transcript)
- Do NOT require ffmpeg to be pre-installed (bundle or use pure JS alternatives)
- Do NOT process audio files larger than 25 MB

## When to Stop and Ask

- If iPhone backup attachment paths cannot be resolved (backup structure unclear)
- If CAF/AMR audio format conversion requires a dependency that is hard to bundle with Electron
- If whisper.cpp local bindings are too complex to integrate in a single task
- If the existing message storage pipeline does not have a good hook point for post-processing
- If you are unsure about the settings/preferences system pattern
- If the task feels like it will exceed 3 files to modify in the main codebase

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- `voiceTranscriptionService.test.ts`:
  - Service initializes with config
  - `transcribe()` calls correct provider based on config
  - Error handling for failed API calls
  - Handles missing audio file gracefully
  - Returns structured TranscriptionResult
- `audioExtractor.test.ts`:
  - Resolves attachment path in backup structure
  - Detects audio format correctly
  - Handles missing files gracefully
  - File size check (>25MB rejected)

### Coverage

- Coverage impact: New service should have >80% coverage
- Existing test coverage must not decrease

### Integration / Feature Tests

- Manual verification:
  - Run iPhone sync with voice messages that lack Apple transcripts
  - Verify transcription runs after sync completes
  - Verify transcript appears in message detail view
  - Verify transcript appears in export output
  - Verify opt-in setting prevents transcription when disabled
  - Verify error in one transcription does not affect others

### CI Requirements

This task's PR MUST pass:
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(sync): add voice message transcription via Whisper STT`
- **Labels**: `electron`, `sprint-120`, `sync`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service` + `ipc`

**Estimated Tokens:** ~35K-50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new files (service, tests, extractor, extractor tests) | +15K |
| Files to modify | 2-3 files (storage service, types, settings) | +10K |
| Audio processing complexity | Format detection, conversion, API integration | +15K |
| Test complexity | Unit tests for service and extractor | +5K |
| Service multiplier | x 0.5 (base) | Applied |
| IPC/integration multiplier | x 1.5 (for audio + worker thread) | Applied to integration portion |

**Confidence:** Medium

**Risk factors:**
- Audio format conversion (CAF/AMR) may require additional dependencies
- Worker thread integration adds complexity
- Local whisper.cpp integration may be out of scope for a single task
- iPhone backup attachment path resolution is not well-documented

**Similar past tasks:** TASK-2119 (iPhone sync orchestrator, ~40K -- similar complexity with service + worker thread)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/services/voiceTranscriptionService.ts
- [ ] electron/services/__tests__/voiceTranscriptionService.test.ts
- [ ] electron/utils/audioExtractor.ts
- [ ] electron/utils/__tests__/audioExtractor.test.ts

Files modified:
- [ ] electron/services/iPhoneSyncStorageService.ts
- [ ] electron/types/iosMessages.ts
- [ ] (settings/preferences files -- list during planning)

Features implemented:
- [ ] VoiceTranscriptionService with Whisper API support
- [ ] Audio extraction from iPhone backup
- [ ] Audio format conversion (CAF/AMR -> WAV/MP3)
- [ ] Post-sync transcription queue
- [ ] Transcript storage in audio_transcript column
- [ ] Transcription source tracking
- [ ] Opt-in settings
- [ ] Error handling and logging
- [ ] Unit tests

Verification:
- [ ] npm test passes
- [ ] npm run type-check passes
- [ ] npm run lint passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~50K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
