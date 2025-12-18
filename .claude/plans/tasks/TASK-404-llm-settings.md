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

*To be completed by engineer*

---

## SR Engineer Review (SR-Owned)

*To be completed during PR review*
