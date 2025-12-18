# Task TASK-404: LLMSettings Component

## Goal

Create a React component for configuring LLM settings including API keys, provider selection, usage display, and consent management.

## Non-Goals

- Do NOT implement the backend LLM config service (already exists)
- Do NOT create IPC handlers (already exist from SPRINT-004)
- Do NOT implement actual LLM calls
- Do NOT modify other Settings tabs

## Deliverables

1. New file: `src/components/settings/LLMSettings.tsx`
2. Update: `src/components/Settings.tsx` (add LLMSettings section)

## Acceptance Criteria

- [ ] Two tabs: OpenAI | Anthropic
- [ ] API key input with show/hide toggle
- [ ] "Validate Key" button with status indicator
- [ ] Model selection dropdown per provider
- [ ] Usage display: "X tokens used this month"
- [ ] Platform allowance toggle
- [ ] Feature toggles: Auto-detect, Role extraction
- [ ] Consent checkbox required before first use
- [ ] Settings persist correctly
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// src/components/settings/LLMSettings.tsx
import { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

interface LLMSettingsProps {
  userId: string;
}

export function LLMSettings({ userId }: LLMSettingsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [openAIKey, setOpenAIKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [usage, setUsage] = useState({ tokensUsed: 0, limit: 0 });

  useEffect(() => {
    // Load existing config
    loadConfig();
  }, [userId]);

  const loadConfig = async () => {
    const config = await window.api.llm.getConfig(userId);
    if (config) {
      setOpenAIKey(config.openai_api_key ? '••••••••' : '');
      setAnthropicKey(config.anthropic_api_key ? '••••••••' : '');
      setConsentGiven(config.consent_given || false);
      setUsage({
        tokensUsed: config.tokens_used_this_month || 0,
        limit: config.budget_limit_tokens || 0,
      });
    }
  };

  const handleValidateKey = async (provider: 'openai' | 'anthropic') => {
    setValidating(true);
    const key = provider === 'openai' ? openAIKey : anthropicKey;
    const result = await window.api.llm.validateApiKey(provider, key);
    setValidationStatus(result.valid ? 'valid' : 'invalid');
    setValidating(false);
  };

  const handleSaveKey = async (provider: 'openai' | 'anthropic', key: string) => {
    await window.api.llm.updateConfig(userId, {
      [`${provider}_api_key`]: key,
    });
  };

  return (
    <div className="llm-settings">
      {!consentGiven && (
        <ConsentModal
          onAccept={() => {
            setConsentGiven(true);
            window.api.llm.updateConfig(userId, { consent_given: true });
          }}
          onDecline={() => {/* navigate away */}}
        />
      )}

      <Tabs selectedIndex={activeTab} onSelect={setActiveTab}>
        <TabList>
          <Tab>OpenAI</Tab>
          <Tab>Anthropic</Tab>
        </TabList>

        <TabPanel>
          <ProviderSettings
            provider="openai"
            apiKey={openAIKey}
            onKeyChange={setOpenAIKey}
            showKey={showKey}
            onToggleShow={() => setShowKey(!showKey)}
            onValidate={() => handleValidateKey('openai')}
            validating={validating}
            validationStatus={validationStatus}
            onSave={(key) => handleSaveKey('openai', key)}
          />
        </TabPanel>

        <TabPanel>
          <ProviderSettings
            provider="anthropic"
            apiKey={anthropicKey}
            onKeyChange={setAnthropicKey}
            showKey={showKey}
            onToggleShow={() => setShowKey(!showKey)}
            onValidate={() => handleValidateKey('anthropic')}
            validating={validating}
            validationStatus={validationStatus}
            onSave={(key) => handleSaveKey('anthropic', key)}
          />
        </TabPanel>
      </Tabs>

      <UsageDisplay tokensUsed={usage.tokensUsed} limit={usage.limit} />

      <FeatureToggles userId={userId} />
    </div>
  );
}
```

### Consent Modal Text

```
Before using AI features, please acknowledge:

Your email content will be sent to [OpenAI/Anthropic] for analysis.
This includes email subjects, bodies, and sender/recipient information.

Personal information is sanitized before sending, but some content
may still be transmitted to the AI provider.

[ ] I understand and consent to this data processing

[Cancel] [Accept & Continue]
```

## Integration Notes

- Imports from: `window.api.llm.*` (existing IPC)
- Exports to: `src/components/Settings.tsx`
- Used by: Settings page
- Depends on: None (uses existing SPRINT-004 IPC)

## Do / Don't

### Do:
- Use existing `window.api.llm` methods
- Mask API keys with •••• when not editing
- Clear validation status when key changes
- Show usage in human-readable format

### Don't:
- Store API keys in component state long-term
- Display raw API keys
- Allow saving without consent
- Make LLM calls from this component

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Component renders tabs
  - API key input masking
  - Validation button state changes
  - Consent modal behavior
  - Settings persistence

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(ui): add LLM settings component [TASK-404]`
- **Labels**: `ui`, `ai-mvp`, `phase-2`
- **Depends on**: None (parallel with TASK-405)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui`

**Estimated Totals:**
- **Turns:** 3
- **Tokens:** ~12K
- **Time:** ~25m

**Confidence:** Medium

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-404-llm-settings

### Execution Classification
- **Parallel Safe:** Yes (with TASK-405)
- **Depends On:** None
- **Blocks:** None

---

## Implementation Summary (Engineer-Owned)

**Implementation Date:** 2025-12-18
**Engineer:** Claude Opus 4.5
**Status:** COMPLETE

### Files Created/Modified
1. `src/components/settings/LLMSettings.tsx` - Main LLM settings component (~820 lines)
2. `src/components/Settings.tsx` - Added AI Settings section (+9 lines)
3. `src/components/__tests__/LLMSettings.test.tsx` - 34 unit tests
4. `src/components/__tests__/Settings.test.tsx` - Added LLM mocks and AI Settings test
5. `tests/setup.js` - Added window.api.llm mock methods

### Components Implemented
- **LLMSettings** - Main settings panel with provider tabs
- **ConsentModal** - Data processing consent before AI features
- **ProviderSettings** - API key input, validation, model selection per provider
- **UsageDisplay** - Token usage display with budget progress
- **FeatureToggle** - Toggle component for AI features

### Design Patterns Used
- Tab-based UI matching existing patterns (TransactionDetails tabs)
- IPC through window.api.llm.* (respects architecture boundaries)
- API key masking and validation before save
- Consent flow with modal acknowledgment

### Acceptance Criteria Status
- [x] Two tabs: OpenAI | Anthropic
- [x] API key input with show/hide toggle
- [x] "Validate Key" button with status indicator
- [x] Model selection dropdown per provider
- [x] Usage display: "X tokens used this month"
- [x] Platform allowance toggle
- [x] Feature toggles: Auto-detect, Role extraction
- [x] Consent checkbox required before first use
- [x] Settings persist correctly
- [x] All CI checks pass

---

## SR Engineer Review (SR-Owned)

**Review Date:** 2025-12-18 | **PR:** #174 | **Status:** MERGED

### PR Review Summary
- **Risk Level:** LOW-MEDIUM
- **CI Status:** All 6 checks passed
- **Merge Commit:** `4339ab8`

### Architecture Assessment
- IPC boundary respected - all LLM calls through window.api.llm.*
- Clean Settings.tsx integration (+9 lines only)
- New settings subdirectory follows component organization patterns
- Test mocks properly updated in tests/setup.js

### Code Quality
- Well-organized sub-components (ConsentModal, ProviderSettings, UsageDisplay, FeatureToggle)
- Proper TypeScript interfaces
- API key validation before save (security best practice)
- 34 unit tests covering component functionality

### Observations
- Component size (~820 lines) is acceptable given complexity
- Good handling of IPC type mapping (hasOpenAI vs hasOpenAIKey)

### SR Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 1 | ~2K | 3 min |
| PR Review (PR) | 1 | ~5K | 7 min |
| **SR Total** | 2 | ~7K | 10 min |

### Approval Notes
- All acceptance criteria met
- Security best practices followed (key masking, validation)
- Proper consent flow implementation
