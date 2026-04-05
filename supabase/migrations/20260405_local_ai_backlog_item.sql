-- Add backlog item for Gemma 4 Local AI integration
-- This tracks the full feature implementation in the PM system

INSERT INTO pm_backlog_items (item_number, title, type, area, priority, status, description)
VALUES (
  (SELECT COALESCE(MAX(item_number), 0) + 1 FROM pm_backlog_items),
  'Gemma 4 Local AI — Model Download, Chatbot, AI Timeline',
  'feature',
  'electron',
  'high',
  'in_progress',
  'Integrate Google Gemma 4 (Apache 2.0) as a free, local AI provider for Keepr desktop.

## Features
1. **On-demand model download** — Gemma 4 GGUF models downloaded from HuggingFace during onboarding or settings (E2B ~1.5GB, E4B ~5GB, 26B MoE ~18GB). Model recommendation based on machine RAM.
2. **AI Chatbot** — Floating bottom-left chat widget with full data access to user transactions, emails, and contacts. Uses local LLM inference via node-llama-cpp.
3. **AI Transaction Timeline** — New tab in transaction details that analyzes emails/attachments to produce a visual timeline of real estate milestones. Each event links back to source emails and documents.

## Technical
- node-llama-cpp for bundled GGUF inference (no Ollama dependency)
- LocalLLMService extends BaseLLMService (provider="local")
- ModelManagerService handles download/delete/recommend with resumable HTTP Range
- Feature-gated by `local_ai` flag in admin portal
- SQLite migration v37: local_model column, transaction_timelines table
- Reusable GemmaModelSelector component shared between onboarding and settings
- Chat IPC handlers with ChatContextService for data-aware prompts
- Extraction strategy updated to support local provider (free, no budget check)

## Acceptance Criteria
- [ ] Model download works from onboarding and settings
- [ ] Model recommendation matches machine specs (RAM-based)
- [ ] Chatbot responds to transaction/email/contact queries using local model
- [ ] Timeline generation produces structured milestones from email data
- [ ] Timeline events link to source emails/attachments
- [ ] All features hidden when local_ai feature flag is disabled
- [ ] Zero cost to users (all inference runs locally)
- [ ] Data never leaves the user device'
)
ON CONFLICT DO NOTHING;
