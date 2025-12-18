/**
 * Prompt Template Types
 * TASK-318: Shared types for prompt templates with versioning support
 *
 * Provides interfaces for prompt templates, metadata, and hash computation
 * for tracking prompt changes and enabling snapshot testing.
 */

/**
 * A prompt template with system and user prompt builders.
 * Used by AI tools to construct LLM messages.
 *
 * @template TInput - The type of input for buildUserPrompt
 * @template TContext - The type of context for buildSystemPrompt
 */
export interface PromptTemplate<
  TInput = unknown,
  TContext = unknown
> {
  /** Unique identifier for the prompt template */
  name: string;
  /** Semantic version of the prompt (e.g., "1.0.0") */
  version: string;
  /** Hash of combined prompt content for change detection */
  hash: string;
  /** Builds the system prompt, optionally using context */
  buildSystemPrompt: (context?: TContext) => string;
  /** Builds the user prompt from input data */
  buildUserPrompt: (input: TInput) => string;
}

/**
 * Metadata about a prompt template for cataloging and auditing.
 */
export interface PromptMetadata {
  /** Unique identifier for the prompt template */
  name: string;
  /** Semantic version of the prompt */
  version: string;
  /** Hash of combined prompt content */
  hash: string;
  /** ISO date when this version was created */
  createdAt: string;
  /** Human-readable description of the prompt's purpose */
  description: string;
}

/**
 * Compute a simple hash for prompt version tracking.
 * Uses a fast, non-cryptographic hash suitable for change detection.
 *
 * @param systemPrompt - The system prompt content
 * @param userPromptTemplate - The user prompt template (may include placeholders)
 * @returns 8-character hexadecimal hash string
 */
export function computePromptHash(
  systemPrompt: string,
  userPromptTemplate: string
): string {
  const content = systemPrompt + userPromptTemplate;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
