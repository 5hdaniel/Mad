# Task TASK-312: LLM IPC Handlers

## Goal

Create IPC handlers for LLM operations, exposing the config service to the renderer process through the preload bridge.

## Non-Goals

- Do NOT add UI components
- Do NOT implement sync with Supabase
- Do NOT add additional LLM operations beyond config

## Deliverables

1. New file: `electron/llm-handlers.ts` - IPC handlers
2. Update: `electron/main.ts` - Register handlers
3. Update: `electron/preload.ts` - Add bridge methods

## Acceptance Criteria

- [ ] All handlers registered in main.ts
- [ ] Preload bridge methods added
- [ ] Type-safe IPC communication
- [ ] Error responses formatted correctly
- [ ] npm run type-check passes
- [ ] npm run lint passes

## Implementation Notes

### LLM Handlers

Create `electron/llm-handlers.ts`:

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { LLMConfigService, LLMUserConfig } from './services/llm/llmConfigService';
import { LLMProvider, LLMError } from './services/llm/types';

// Response wrapper for consistent error handling
interface LLMHandlerResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    type: string;
    retryable: boolean;
  };
}

function wrapResponse<T>(data: T): LLMHandlerResponse<T> {
  return { success: true, data };
}

function wrapError(error: unknown): LLMHandlerResponse<never> {
  if (error instanceof LLMError) {
    return {
      success: false,
      error: {
        message: error.message,
        type: error.type,
        retryable: error.retryable,
      },
    };
  }
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        message: error.message,
        type: 'unknown',
        retryable: false,
      },
    };
  }
  return {
    success: false,
    error: {
      message: String(error),
      type: 'unknown',
      retryable: false,
    },
  };
}

export function registerLLMHandlers(configService: LLMConfigService): void {
  // Get user's LLM configuration
  ipcMain.handle(
    'llm:get-config',
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<LLMHandlerResponse<LLMUserConfig>> => {
      try {
        const config = await configService.getUserConfig(userId);
        return wrapResponse(config);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Set API key for a provider
  ipcMain.handle(
    'llm:set-api-key',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      provider: LLMProvider,
      apiKey: string
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.setApiKey(userId, provider, apiKey);
        return wrapResponse(undefined);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Validate API key without storing
  ipcMain.handle(
    'llm:validate-key',
    async (
      _event: IpcMainInvokeEvent,
      provider: LLMProvider,
      apiKey: string
    ): Promise<LLMHandlerResponse<boolean>> => {
      try {
        const isValid = await configService.validateApiKey(provider, apiKey);
        return wrapResponse(isValid);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Remove API key
  ipcMain.handle(
    'llm:remove-api-key',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      provider: LLMProvider
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.removeApiKey(userId, provider);
        return wrapResponse(undefined);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Update preferences
  ipcMain.handle(
    'llm:update-preferences',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      preferences: Parameters<typeof configService.updatePreferences>[1]
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.updatePreferences(userId, preferences);
        return wrapResponse(undefined);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Record consent
  ipcMain.handle(
    'llm:record-consent',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      consent: boolean
    ): Promise<LLMHandlerResponse<void>> => {
      try {
        await configService.recordConsent(userId, consent);
        return wrapResponse(undefined);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Get usage statistics
  ipcMain.handle(
    'llm:get-usage',
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<LLMHandlerResponse<Awaited<ReturnType<typeof configService.getUsageStats>>>> => {
      try {
        const stats = await configService.getUsageStats(userId);
        return wrapResponse(stats);
      } catch (error) {
        return wrapError(error);
      }
    }
  );

  // Check if user can use LLM
  ipcMain.handle(
    'llm:can-use',
    async (
      _event: IpcMainInvokeEvent,
      userId: string
    ): Promise<LLMHandlerResponse<{ canUse: boolean; reason?: string }>> => {
      try {
        const result = await configService.canUseLLM(userId);
        return wrapResponse(result);
      } catch (error) {
        return wrapError(error);
      }
    }
  );
}
```

### Main.ts Registration

Add to `electron/main.ts`:

```typescript
import { registerLLMHandlers } from './llm-handlers';
import { LLMConfigService } from './services/llm/llmConfigService';
import { LLMSettingsDbService } from './services/db/llmSettingsDbService';

// In initialization section, after database is ready:
const llmSettingsDbService = new LLMSettingsDbService(db);
const llmConfigService = new LLMConfigService(llmSettingsDbService, encryptionService);
registerLLMHandlers(llmConfigService);
```

### Preload Bridge

Update `electron/preload.ts`:

```typescript
// Add to contextBridge.exposeInMainWorld('api', { ... })

llm: {
  getConfig: (userId: string) =>
    ipcRenderer.invoke('llm:get-config', userId),

  setApiKey: (userId: string, provider: 'openai' | 'anthropic', apiKey: string) =>
    ipcRenderer.invoke('llm:set-api-key', userId, provider, apiKey),

  validateKey: (provider: 'openai' | 'anthropic', apiKey: string) =>
    ipcRenderer.invoke('llm:validate-key', provider, apiKey),

  removeApiKey: (userId: string, provider: 'openai' | 'anthropic') =>
    ipcRenderer.invoke('llm:remove-api-key', userId, provider),

  updatePreferences: (userId: string, preferences: {
    preferredProvider?: 'openai' | 'anthropic';
    openAIModel?: string;
    anthropicModel?: string;
    enableAutoDetect?: boolean;
    enableRoleExtraction?: boolean;
    usePlatformAllowance?: boolean;
    budgetLimit?: number;
  }) => ipcRenderer.invoke('llm:update-preferences', userId, preferences),

  recordConsent: (userId: string, consent: boolean) =>
    ipcRenderer.invoke('llm:record-consent', userId, consent),

  getUsage: (userId: string) =>
    ipcRenderer.invoke('llm:get-usage', userId),

  canUse: (userId: string) =>
    ipcRenderer.invoke('llm:can-use', userId),
},
```

### TypeScript Types for Renderer

Add to `src/types/electron.d.ts` or similar:

```typescript
interface LLMApi {
  getConfig(userId: string): Promise<LLMHandlerResponse<LLMUserConfig>>;
  setApiKey(userId: string, provider: 'openai' | 'anthropic', apiKey: string): Promise<LLMHandlerResponse<void>>;
  validateKey(provider: 'openai' | 'anthropic', apiKey: string): Promise<LLMHandlerResponse<boolean>>;
  removeApiKey(userId: string, provider: 'openai' | 'anthropic'): Promise<LLMHandlerResponse<void>>;
  updatePreferences(userId: string, preferences: LLMPreferences): Promise<LLMHandlerResponse<void>>;
  recordConsent(userId: string, consent: boolean): Promise<LLMHandlerResponse<void>>;
  getUsage(userId: string): Promise<LLMHandlerResponse<LLMUsageStats>>;
  canUse(userId: string): Promise<LLMHandlerResponse<{ canUse: boolean; reason?: string }>>;
}

interface Window {
  api: {
    // ... existing api
    llm: LLMApi;
  };
}
```

## Integration Notes

- Imports from: `./services/llm/llmConfigService.ts`
- Exports to: Renderer process via preload
- Used by: Future UI components (BACKLOG-078)
- Depends on: TASK-311

## Do / Don't

### Do:
- Use consistent response wrapper
- Handle all errors gracefully
- Keep handler functions thin (delegate to service)
- Add TypeScript types for renderer

### Don't:
- Don't expose internal service details
- Don't log sensitive data (API keys)
- Don't skip error wrapping

## When to Stop and Ask

- If preload pattern differs from existing
- If response format should change
- If additional handlers needed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (integration tests with mocked service)
- New tests to write:
  - Handler registration
  - Response wrapping
  - Error handling

### Coverage

- Coverage impact: >60%

### CI Requirements

- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-312-llm-handlers`
- **Title**: `feat(llm): add LLM IPC handlers`
- **Labels**: `llm`, `electron`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-311

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] electron/llm-handlers.ts

Files modified:
- [ ] electron/main.ts
- [ ] electron/preload.ts
- [ ] src/types/electron.d.ts (or equivalent)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Reviewer notes:**
