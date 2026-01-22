/**
 * Prompt Version Service
 * TASK-319: Service for managing prompt version tracking
 *
 * Provides access to current prompt versions for auditing,
 * A/B testing, and rollback capabilities.
 */

import { PromptMetadata, ALL_PROMPTS } from './prompts';

/**
 * Simplified version info for a prompt template.
 * Used for tracking which version was used for LLM results.
 */
export interface PromptVersion {
  /** Unique identifier for the prompt template */
  name: string;
  /** Semantic version of the prompt */
  version: string;
  /** Hash of combined prompt content for change detection */
  hash: string;
}

/**
 * Service for managing prompt version tracking.
 * Singleton pattern ensures consistent version info across the app.
 *
 * @example
 * ```typescript
 * const service = PromptVersionService.getInstance();
 * const version = service.getCurrentVersion('message-analysis');
 * // { name: 'message-analysis', version: '1.0.0', hash: 'abc12345' }
 * ```
 */
export class PromptVersionService {
  private static instance: PromptVersionService;
  private promptMap: Map<string, PromptMetadata>;

  /**
   * Private constructor - use getInstance() for access.
   */
  private constructor() {
    this.promptMap = new Map();
    ALL_PROMPTS.forEach((p) => this.promptMap.set(p.name, p));
  }

  /**
   * Get the singleton instance of PromptVersionService.
   * @returns The singleton instance
   */
  static getInstance(): PromptVersionService {
    if (!PromptVersionService.instance) {
      PromptVersionService.instance = new PromptVersionService();
    }
    return PromptVersionService.instance;
  }

  /**
   * Reset the singleton instance.
   * Only for testing purposes.
   */
  static resetInstance(): void {
    PromptVersionService.instance = undefined as unknown as PromptVersionService;
  }

  /**
   * Get the current version info for a named prompt.
   * @param promptName - The unique name of the prompt template
   * @returns PromptVersion if found, undefined otherwise
   */
  getCurrentVersion(promptName: string): PromptVersion | undefined {
    const meta = this.promptMap.get(promptName);
    if (!meta) return undefined;
    return {
      name: meta.name,
      version: meta.version,
      hash: meta.hash,
    };
  }

  /**
   * Get version info for all registered prompts.
   * @returns Array of all prompt versions
   */
  getAllVersions(): PromptVersion[] {
    return ALL_PROMPTS.map((p) => ({
      name: p.name,
      version: p.version,
      hash: p.hash,
    }));
  }

  /**
   * Get all registered prompt names.
   * @returns Array of prompt name strings
   */
  getPromptNames(): string[] {
    return Array.from(this.promptMap.keys());
  }

  /**
   * Check if a prompt with the given name exists.
   * @param promptName - The unique name of the prompt template
   * @returns true if the prompt exists, false otherwise
   */
  hasPrompt(promptName: string): boolean {
    return this.promptMap.has(promptName);
  }

  /**
   * Get the total count of registered prompts.
   * @returns Number of registered prompts
   */
  getPromptCount(): number {
    return this.promptMap.size;
  }
}

/**
 * Convenience function to get the PromptVersionService instance.
 * @returns The singleton PromptVersionService instance
 */
export function getPromptVersionService(): PromptVersionService {
  return PromptVersionService.getInstance();
}
