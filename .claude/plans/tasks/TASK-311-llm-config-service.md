# Task TASK-311: LLM Config Service

## Goal

Create a service that manages LLM configuration including secure API key storage, provider selection, and coordination between OpenAI and Anthropic services.

## Non-Goals

- Do NOT add IPC handlers (TASK-312)
- Do NOT add UI components
- Do NOT implement sync with Supabase (future enhancement)

## Deliverables

1. New file: `electron/services/llm/llmConfigService.ts` - Main config service

## Acceptance Criteria

- [ ] API keys encrypted before storage
- [ ] Provider selection logic working
- [ ] Unified interface to underlying LLM services
- [ ] Budget checking integrated
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes

## Implementation Notes

### Config Service

Create `electron/services/llm/llmConfigService.ts`:

```typescript
import { LLMSettings } from '../../types/models';
import { LLMSettingsDbService } from '../db/llmSettingsDbService';
import { DatabaseEncryptionService } from '../databaseEncryptionService';
import { OpenAIService } from './openAIService';
import { AnthropicService } from './anthropicService';
import {
  LLMConfig,
  LLMResponse,
  LLMMessage,
  LLMProvider,
  LLMError,
} from './types';

export interface LLMUserConfig {
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  preferredProvider: LLMProvider;
  openAIModel: string;
  anthropicModel: string;
  tokensUsed: number;
  budgetLimit?: number;
  platformAllowanceRemaining: number;
  usePlatformAllowance: boolean;
  autoDetectEnabled: boolean;
  roleExtractionEnabled: boolean;
  hasConsent: boolean;
}

export class LLMConfigService {
  private openAIService: OpenAIService;
  private anthropicService: AnthropicService;
  private dbService: LLMSettingsDbService;
  private encryptionService: DatabaseEncryptionService;

  constructor(
    dbService: LLMSettingsDbService,
    encryptionService: DatabaseEncryptionService
  ) {
    this.dbService = dbService;
    this.encryptionService = encryptionService;
    this.openAIService = new OpenAIService();
    this.anthropicService = new AnthropicService();

    // Connect DB service for usage tracking
    this.openAIService.setDbService(dbService);
    this.anthropicService.setDbService(dbService);
  }

  /**
   * Get user's LLM configuration summary.
   */
  async getUserConfig(userId: string): Promise<LLMUserConfig> {
    let settings = this.dbService.getByUserId(userId);

    // Create default settings if none exist
    if (!settings) {
      settings = this.dbService.create(userId);
    }

    return {
      hasOpenAI: !!settings.openai_api_key_encrypted,
      hasAnthropic: !!settings.anthropic_api_key_encrypted,
      preferredProvider: settings.preferred_provider,
      openAIModel: settings.openai_model,
      anthropicModel: settings.anthropic_model,
      tokensUsed: settings.tokens_used_this_month,
      budgetLimit: settings.budget_limit_tokens ?? undefined,
      platformAllowanceRemaining:
        settings.platform_allowance_tokens - settings.platform_allowance_used,
      usePlatformAllowance: settings.use_platform_allowance,
      autoDetectEnabled: settings.enable_auto_detect,
      roleExtractionEnabled: settings.enable_role_extraction,
      hasConsent: settings.llm_data_consent,
    };
  }

  /**
   * Set API key for a provider.
   */
  async setApiKey(
    userId: string,
    provider: LLMProvider,
    apiKey: string
  ): Promise<void> {
    const encryptedKey = this.encryptionService.encrypt(apiKey);

    const updates: Partial<LLMSettings> =
      provider === 'openai'
        ? { openai_api_key_encrypted: encryptedKey }
        : { anthropic_api_key_encrypted: encryptedKey };

    this.dbService.update(userId, updates);
  }

  /**
   * Validate an API key without storing it.
   */
  async validateApiKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
    if (provider === 'openai') {
      return this.openAIService.validateApiKey(apiKey);
    } else {
      return this.anthropicService.validateApiKey(apiKey);
    }
  }

  /**
   * Remove API key for a provider.
   */
  async removeApiKey(userId: string, provider: LLMProvider): Promise<void> {
    const updates: Partial<LLMSettings> =
      provider === 'openai'
        ? { openai_api_key_encrypted: undefined }
        : { anthropic_api_key_encrypted: undefined };

    this.dbService.update(userId, updates);
  }

  /**
   * Update provider preferences.
   */
  async updatePreferences(
    userId: string,
    preferences: {
      preferredProvider?: LLMProvider;
      openAIModel?: string;
      anthropicModel?: string;
      enableAutoDetect?: boolean;
      enableRoleExtraction?: boolean;
      usePlatformAllowance?: boolean;
      budgetLimit?: number;
    }
  ): Promise<void> {
    const updates: Partial<LLMSettings> = {};

    if (preferences.preferredProvider !== undefined) {
      updates.preferred_provider = preferences.preferredProvider;
    }
    if (preferences.openAIModel !== undefined) {
      updates.openai_model = preferences.openAIModel;
    }
    if (preferences.anthropicModel !== undefined) {
      updates.anthropic_model = preferences.anthropicModel;
    }
    if (preferences.enableAutoDetect !== undefined) {
      updates.enable_auto_detect = preferences.enableAutoDetect;
    }
    if (preferences.enableRoleExtraction !== undefined) {
      updates.enable_role_extraction = preferences.enableRoleExtraction;
    }
    if (preferences.usePlatformAllowance !== undefined) {
      updates.use_platform_allowance = preferences.usePlatformAllowance;
    }
    if (preferences.budgetLimit !== undefined) {
      updates.budget_limit_tokens = preferences.budgetLimit;
    }

    this.dbService.update(userId, updates);
  }

  /**
   * Record user consent for LLM data processing.
   */
  async recordConsent(userId: string, consent: boolean): Promise<void> {
    this.dbService.update(userId, {
      llm_data_consent: consent,
      llm_data_consent_at: consent ? new Date().toISOString() : undefined,
    });
  }

  /**
   * Complete a chat using the configured provider.
   */
  async complete(
    userId: string,
    messages: LLMMessage[],
    options?: {
      provider?: LLMProvider;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<LLMResponse> {
    const settings = this.dbService.getByUserId(userId);
    if (!settings) {
      throw new LLMError(
        'LLM not configured. Please add an API key in settings.',
        'invalid_api_key',
        'openai',  // Default
        401,
        false
      );
    }

    // Check consent
    if (!settings.llm_data_consent) {
      throw new LLMError(
        'LLM data consent required. Please enable in settings.',
        'quota_exceeded',
        settings.preferred_provider,
        403,
        false
      );
    }

    // Determine provider
    const provider = options?.provider ?? settings.preferred_provider;
    const service = this.getServiceForProvider(provider, settings);

    // Build config
    const config: LLMConfig = {
      provider,
      apiKey: '', // Set by service initialization
      model:
        provider === 'openai' ? settings.openai_model : settings.anthropic_model,
      maxTokens: options?.maxTokens ?? 1000,
      temperature: options?.temperature ?? 0.7,
    };

    // Complete with tracking
    return service.completeWithTracking(userId, messages, config);
  }

  /**
   * Get usage statistics.
   */
  async getUsageStats(userId: string): Promise<{
    tokensThisMonth: number;
    budgetLimit?: number;
    budgetRemaining?: number;
    platformAllowance: number;
    platformUsed: number;
    resetDate?: string;
  }> {
    const settings = this.dbService.getByUserId(userId);
    if (!settings) {
      return {
        tokensThisMonth: 0,
        platformAllowance: 0,
        platformUsed: 0,
      };
    }

    return {
      tokensThisMonth: settings.tokens_used_this_month,
      budgetLimit: settings.budget_limit_tokens ?? undefined,
      budgetRemaining: settings.budget_limit_tokens
        ? settings.budget_limit_tokens - settings.tokens_used_this_month
        : undefined,
      platformAllowance: settings.platform_allowance_tokens,
      platformUsed: settings.platform_allowance_used,
      resetDate: settings.budget_reset_date ?? undefined,
    };
  }

  /**
   * Check if user can make LLM requests.
   */
  async canUseL LM(userId: string): Promise<{
    canUse: boolean;
    reason?: string;
  }> {
    const config = await this.getUserConfig(userId);

    if (!config.hasConsent) {
      return { canUse: false, reason: 'LLM data consent required' };
    }

    if (!config.hasOpenAI && !config.hasAnthropic && !config.usePlatformAllowance) {
      return { canUse: false, reason: 'No API key configured' };
    }

    if (config.budgetLimit && config.tokensUsed >= config.budgetLimit) {
      return { canUse: false, reason: 'Monthly budget exceeded' };
    }

    if (config.usePlatformAllowance && config.platformAllowanceRemaining <= 0) {
      return { canUse: false, reason: 'Platform allowance exhausted' };
    }

    return { canUse: true };
  }

  private getServiceForProvider(
    provider: LLMProvider,
    settings: LLMSettings
  ): OpenAIService | AnthropicService {
    if (provider === 'openai') {
      if (!settings.openai_api_key_encrypted) {
        throw new LLMError(
          'OpenAI API key not configured',
          'invalid_api_key',
          'openai',
          401,
          false
        );
      }
      const apiKey = this.encryptionService.decrypt(settings.openai_api_key_encrypted);
      this.openAIService.initialize(apiKey);
      return this.openAIService;
    } else {
      if (!settings.anthropic_api_key_encrypted) {
        throw new LLMError(
          'Anthropic API key not configured',
          'invalid_api_key',
          'anthropic',
          401,
          false
        );
      }
      const apiKey = this.encryptionService.decrypt(settings.anthropic_api_key_encrypted);
      this.anthropicService.initialize(apiKey);
      return this.anthropicService;
    }
  }
}
```

## Integration Notes

- Imports from: All LLM services, db service, encryption service
- Exports to: TASK-312 (IPC handlers)
- Used by: Future AI tools, transaction detection
- Depends on: TASK-309, TASK-310, TASK-302

## Do / Don't

### Do:
- Decrypt API keys only when needed
- Check consent before any LLM operation
- Create default settings on first access
- Track all usage through services

### Don't:
- Don't cache decrypted API keys
- Don't skip consent check
- Don't expose raw settings to UI

## When to Stop and Ask

- If encryption service API differs
- If consent flow needs changes
- If platform allowance sync needed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Config retrieval and creation
  - API key set/validate/remove
  - Consent recording
  - Provider selection logic

### Coverage

- Coverage impact: >70%

### CI Requirements

- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-311-llm-config-service`
- **Title**: `feat(llm): implement LLM config service`
- **Labels**: `llm`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-309, TASK-310, TASK-302

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
- [ ] electron/services/llm/llmConfigService.ts
- [ ] electron/services/llm/__tests__/llmConfigService.test.ts

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
