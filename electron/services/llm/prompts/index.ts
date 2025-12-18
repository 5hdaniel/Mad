/**
 * Prompt Templates Index
 * TASK-318: Barrel export for all prompt templates
 * TASK-319: Export prompt version service
 *
 * Provides centralized access to prompt templates, metadata, and utilities.
 */

// Export types and utilities
export * from './types';

// Export individual prompt templates
export * from './messageAnalysis';
export * from './contactRoles';
export * from './transactionClustering';

// Import metadata for catalog
import { messageAnalysisMetadata } from './messageAnalysis';
import { contactRolesMetadata } from './contactRoles';
import { transactionClusteringMetadata } from './transactionClustering';
import { PromptMetadata } from './types';

/**
 * Catalog of all available prompt templates.
 * Used for auditing, versioning, and management.
 */
export const ALL_PROMPTS: PromptMetadata[] = [
  messageAnalysisMetadata,
  contactRolesMetadata,
  transactionClusteringMetadata,
];

// Re-export prompt version service for convenience
export { PromptVersionService, getPromptVersionService } from '../promptVersionService';
export type { PromptVersion } from '../promptVersionService';
