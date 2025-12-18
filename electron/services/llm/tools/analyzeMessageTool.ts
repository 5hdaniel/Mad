/**
 * Message Analyzer Tool
 * TASK-315: Analyzes a single email for real estate relevance
 *
 * Pure-function AI tool that extracts transaction indicators, entities,
 * and provides confidence scores for real estate relevance.
 */

import { BaseLLMService } from '../baseLLMService';
import { LLMConfig, LLMMessage } from '../types';
import { MessageAnalysis, AnalyzeMessageInput, ToolResult } from './types';
import { ContentSanitizer } from '../contentSanitizer';
import { messageAnalysisPrompt } from '../prompts';

export class AnalyzeMessageTool {
  private llmService: BaseLLMService;
  private sanitizer: ContentSanitizer;

  constructor(llmService: BaseLLMService) {
    this.llmService = llmService;
    this.sanitizer = new ContentSanitizer();
  }

  /**
   * Analyze an email message for real estate relevance.
   */
  async analyze(
    input: AnalyzeMessageInput,
    config: LLMConfig
  ): Promise<ToolResult<MessageAnalysis>> {
    const startTime = Date.now();

    try {
      // Sanitize input before sending to LLM
      const sanitizedBody = this.sanitizer.sanitize(input.body).sanitizedContent;
      const sanitizedSubject = this.sanitizer.sanitize(input.subject).sanitizedContent;

      const messages = this.buildPrompt({
        ...input,
        body: sanitizedBody,
        subject: sanitizedSubject,
      });

      const response = await this.llmService.completeWithRetry(messages, {
        ...config,
        maxTokens: 1500, // Sufficient for JSON response
      });

      // Parse and validate response
      const analysis = this.parseResponse(response.content);

      return {
        success: true,
        data: {
          ...analysis,
          promptVersion: messageAnalysisPrompt.hash,
        },
        tokensUsed: response.tokensUsed,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Build the LLM prompt for message analysis.
   * Uses external prompt template from prompts/messageAnalysis.ts
   */
  private buildPrompt(input: AnalyzeMessageInput): LLMMessage[] {
    return [
      { role: 'system', content: messageAnalysisPrompt.buildSystemPrompt() },
      { role: 'user', content: messageAnalysisPrompt.buildUserPrompt(input) },
    ];
  }

  /**
   * Parse and validate the LLM response.
   */
  private parseResponse(content: string): MessageAnalysis {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object if no code block
    if (!jsonMatch) {
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (typeof parsed.isRealEstateRelated !== 'boolean') {
      throw new Error('Invalid response: missing isRealEstateRelated');
    }
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Invalid response: confidence must be 0-1');
    }

    // Ensure arrays exist with defaults and validate nested structures
    return {
      isRealEstateRelated: parsed.isRealEstateRelated,
      confidence: parsed.confidence,
      transactionIndicators: {
        type: this.validateTransactionType(parsed.transactionIndicators?.type),
        stage: this.validateStage(parsed.transactionIndicators?.stage),
      },
      extractedEntities: {
        addresses: this.validateAddresses(parsed.extractedEntities?.addresses),
        amounts: this.validateAmounts(parsed.extractedEntities?.amounts),
        dates: this.validateDates(parsed.extractedEntities?.dates),
        contacts: this.validateContacts(parsed.extractedEntities?.contacts),
      },
      reasoning: String(parsed.reasoning ?? ''),
    };
  }

  private validateTransactionType(
    type: unknown
  ): 'purchase' | 'sale' | 'lease' | null {
    if (type === 'purchase' || type === 'sale' || type === 'lease') {
      return type;
    }
    return null;
  }

  private validateStage(
    stage: unknown
  ): 'prospecting' | 'active' | 'pending' | 'closing' | 'closed' | null {
    const validStages = ['prospecting', 'active', 'pending', 'closing', 'closed'];
    if (typeof stage === 'string' && validStages.includes(stage)) {
      return stage as 'prospecting' | 'active' | 'pending' | 'closing' | 'closed';
    }
    return null;
  }

  private validateAddresses(
    addresses: unknown
  ): Array<{ value: string; confidence: number }> {
    if (!Array.isArray(addresses)) return [];
    return addresses
      .filter((a): a is { value: unknown; confidence: unknown } => a && typeof a === 'object')
      .map((a) => ({
        value: String(a.value ?? ''),
        confidence: this.clampConfidence(a.confidence),
      }))
      .filter((a) => a.value.length > 0);
  }

  private validateAmounts(
    amounts: unknown
  ): Array<{ value: number; context: string }> {
    if (!Array.isArray(amounts)) return [];
    return amounts
      .filter((a): a is { value: unknown; context: unknown } => a && typeof a === 'object')
      .map((a) => ({
        value: typeof a.value === 'number' ? a.value : parseFloat(String(a.value)) || 0,
        context: String(a.context ?? ''),
      }))
      .filter((a) => a.value > 0);
  }

  private validateDates(
    dates: unknown
  ): Array<{ value: string; type: 'closing' | 'inspection' | 'other' }> {
    if (!Array.isArray(dates)) return [];
    return dates
      .filter((d): d is { value: unknown; type: unknown } => d && typeof d === 'object')
      .map((d) => ({
        value: String(d.value ?? ''),
        type: this.validateDateType(d.type),
      }))
      .filter((d) => d.value.length > 0);
  }

  private validateDateType(type: unknown): 'closing' | 'inspection' | 'other' {
    if (type === 'closing' || type === 'inspection') {
      return type;
    }
    return 'other';
  }

  private validateContacts(
    contacts: unknown
  ): Array<{ name: string; email?: string; phone?: string; suggestedRole?: string }> {
    if (!Array.isArray(contacts)) return [];
    return contacts
      .filter((c): c is Record<string, unknown> => c && typeof c === 'object')
      .map((c) => ({
        name: String(c.name ?? ''),
        email: c.email ? String(c.email) : undefined,
        phone: c.phone ? String(c.phone) : undefined,
        suggestedRole: c.suggestedRole ? String(c.suggestedRole) : undefined,
      }))
      .filter((c) => c.name.length > 0);
  }

  private clampConfidence(value: unknown): number {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
}
