-- Add local_ai feature flag for Gemma 4 on-device AI
-- This feature gates: model download, chatbot UI, AI timeline

INSERT INTO feature_definitions (key, name, description, value_type, category)
VALUES (
  'local_ai',
  'Local AI (Gemma 4)',
  'Enable on-device AI powered by Gemma 4. Includes AI chatbot, transaction timeline generation, and local model management. Data never leaves the user''s device.',
  'boolean',
  'general'
)
ON CONFLICT (key) DO NOTHING;
