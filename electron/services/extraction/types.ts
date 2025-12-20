/**
 * Hybrid Extraction Types
 * TASK-320: Types for combining pattern matching and LLM-based extraction
 *
 * These types define the interface between pattern-based extraction
 * (transactionExtractorService) and LLM-based analysis (AI tools).
 */

import type { MessageAnalysis, ContactRoleExtraction, TransactionCluster } from '../llm/tools/types';
import type { AnalysisResult } from '../transactionExtractorService';

// ============================================================================
// Extraction Method Tracking
// ============================================================================

/**
 * Indicates which extraction method(s) produced a result.
 * - 'pattern': Pattern matching only (fast, no API cost)
 * - 'llm': LLM analysis only
 * - 'hybrid': Both methods used, results merged
 */
export type ExtractionMethod = 'pattern' | 'llm' | 'hybrid';

// ============================================================================
// Analyzed Message Types
// ============================================================================

/**
 * A message that has been analyzed for real estate relevance.
 * Contains results from pattern matching, LLM analysis, or both.
 */
export interface AnalyzedMessage {
  // Original message identifiers
  id: string;
  subject: string;
  sender: string;
  recipients: string[];
  date: string;
  body: string;

  // Pattern matching results (from transactionExtractorService)
  patternAnalysis?: AnalysisResult;

  // LLM analysis results (from AnalyzeMessageTool)
  llmAnalysis?: MessageAnalysis;

  // Combined/merged results
  isRealEstateRelated: boolean;
  confidence: number; // 0-1 normalized
  extractionMethod: ExtractionMethod;
}

// ============================================================================
// Detected Transaction Types
// ============================================================================

/**
 * A transaction detected from analyzing message clusters.
 * May be created from pattern matching, LLM clustering, or both.
 */
export interface DetectedTransaction {
  id: string;
  propertyAddress: string;
  transactionType: 'purchase' | 'sale' | 'lease' | null;
  stage: 'prospecting' | 'active' | 'pending' | 'closing' | 'closed' | null;
  confidence: number; // 0-1 normalized
  extractionMethod: ExtractionMethod;
  communicationIds: string[];
  dateRange: {
    start: string; // ISO date
    end: string; // ISO date
  };
  suggestedContacts: ContactRoleExtraction;
  summary: string;

  // Source data for debugging/validation
  cluster?: TransactionCluster;
  patternSummary?: PatternSummary;
}

/**
 * Summary from pattern-based extraction.
 * Subset of TransactionSummary from transactionExtractorService.
 */
export interface PatternSummary {
  propertyAddress: string;
  transactionType: 'purchase' | 'sale' | null;
  salePrice: number | null;
  closingDate: string | null;
  mlsNumbers: string[];
  communicationsCount: number;
  firstCommunication: number;
  lastCommunication: number;
  confidence: number; // 0-100 (pattern service format)
}

// ============================================================================
// Extraction Options
// ============================================================================

/**
 * Options for configuring hybrid extraction behavior.
 */
export interface HybridExtractionOptions {
  /** Enable pattern-based extraction (default: true) */
  usePatternMatching: boolean;
  /** Enable LLM-based extraction (default: true if configured) */
  useLLM: boolean;
  /** Preferred LLM provider */
  llmProvider?: 'openai' | 'anthropic';
  /** User ID for budget checking and config lookup */
  userId?: string;
}

/**
 * Default extraction options.
 */
export const DEFAULT_EXTRACTION_OPTIONS: HybridExtractionOptions = {
  usePatternMatching: true,
  useLLM: true,
};

// ============================================================================
// Extraction Result Types
// ============================================================================

/**
 * Result of running the full hybrid extraction pipeline.
 */
export interface HybridExtractionResult {
  success: boolean;
  analyzedMessages: AnalyzedMessage[];
  detectedTransactions: DetectedTransaction[];
  extractionMethod: ExtractionMethod;
  llmUsed: boolean;
  llmError?: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Raw message input for extraction.
 */
export interface MessageInput {
  id: string;
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  date: string;
  // TASK-503: Spam detection fields
  labels?: string[]; // Gmail labels
  inferenceClassification?: string; // Outlook focused/other
  parentFolderName?: string; // Outlook folder name
  // TASK-505: Thread grouping field
  thread_id?: string; // Thread/conversation ID for grouping
}

/**
 * Existing transaction reference for clustering.
 */
export interface ExistingTransactionRef {
  id: string;
  propertyAddress: string;
  transactionType?: string;
}

// ============================================================================
// Spam Filter Types (TASK-503)
// ============================================================================

/**
 * Statistics from spam filtering step.
 */
export interface SpamFilterStats {
  totalEmails: number;
  spamFiltered: number;
  gmailSpam: number;
  outlookJunk: number;
  percentFiltered: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Confidence merging weights.
 * LLM results are weighted higher due to contextual understanding.
 */
export const CONFIDENCE_WEIGHTS = {
  llm: 0.6,
  pattern: 0.4,
} as const;

/**
 * Minimum confidence threshold for real estate classification.
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.3;
