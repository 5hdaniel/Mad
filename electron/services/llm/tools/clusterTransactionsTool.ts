/**
 * Transaction Clusterer Tool
 * TASK-317: Groups analyzed messages into transaction clusters
 *
 * Pure-function AI tool that groups messages by property address,
 * participants, and communication patterns to identify distinct
 * real estate transactions.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseLLMService } from '../baseLLMService';
import { LLMConfig, LLMMessage } from '../types';
import {
  TransactionCluster,
  ClusterTransactionsInput,
  ClusterTransactionsOutput,
  ToolResult,
  MessageAnalysis,
} from './types';
import { ContentSanitizer } from '../contentSanitizer';

type AnalyzedMessage = ClusterTransactionsInput['analyzedMessages'][0];

export class ClusterTransactionsTool {
  private llmService: BaseLLMService;
  private sanitizer: ContentSanitizer;

  constructor(llmService: BaseLLMService) {
    this.llmService = llmService;
    this.sanitizer = new ContentSanitizer();
  }

  /**
   * Cluster analyzed messages into transaction groups.
   */
  async cluster(
    input: ClusterTransactionsInput,
    config: LLMConfig
  ): Promise<ToolResult<ClusterTransactionsOutput>> {
    const startTime = Date.now();

    try {
      // Handle empty input
      if (!input.analyzedMessages || input.analyzedMessages.length === 0) {
        return {
          success: true,
          data: { clusters: [], unclustered: [] },
          latencyMs: Date.now() - startTime,
        };
      }

      // Pre-cluster by address for efficiency (reduce LLM calls)
      const addressGroups = this.preClusterByAddress(input.analyzedMessages);

      // If only one group with clear address, skip LLM
      if (addressGroups.size === 1) {
        const [address, messages] = [...addressGroups.entries()][0];
        if (address !== 'unknown') {
          return {
            success: true,
            data: {
              clusters: [this.createClusterFromGroup(address, messages)],
              unclustered: [],
            },
            latencyMs: Date.now() - startTime,
          };
        }
      }

      // Use LLM for complex clustering
      const messages = this.buildPrompt(input);

      const response = await this.llmService.completeWithRetry(messages, {
        ...config,
        maxTokens: 2500, // May need more for multiple clusters
      });

      const output = this.parseResponse(response.content, input.analyzedMessages);

      return {
        success: true,
        data: output,
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
   * Pre-cluster messages by property address for efficiency.
   */
  private preClusterByAddress(
    messages: AnalyzedMessage[]
  ): Map<string, AnalyzedMessage[]> {
    const groups = new Map<string, AnalyzedMessage[]>();

    messages.forEach((msg) => {
      // Get primary address from analysis
      const address =
        msg.analysis.extractedEntities.addresses[0]?.value || 'unknown';
      const normalized = this.normalizeAddress(address);

      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(msg);
    });

    return groups;
  }

  /**
   * Normalize address for comparison.
   */
  private normalizeAddress(address: string): string {
    // Basic normalization: lowercase, remove extra spaces
    return address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/,\s*/g, ', ')
      .trim();
  }

  /**
   * Create a cluster from a pre-grouped set of messages.
   */
  private createClusterFromGroup(
    address: string,
    messages: AnalyzedMessage[]
  ): TransactionCluster {
    const dates = messages
      .map((m) => new Date(m.date).getTime())
      .filter((d) => !isNaN(d))
      .sort((a, b) => a - b);

    // Aggregate transaction type from analyses
    const types = messages
      .map((m) => m.analysis.transactionIndicators.type)
      .filter(Boolean) as ('purchase' | 'sale' | 'lease')[];

    const typeCount = types.reduce(
      (acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const dominantType = (Object.entries(typeCount).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] as 'purchase' | 'sale' | 'lease') || null;

    // Aggregate stage
    const stages = messages
      .map((m) => m.analysis.transactionIndicators.stage)
      .filter(Boolean) as string[];

    const stageCount = stages.reduce(
      (acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const dominantStage = (Object.entries(stageCount).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] as
      | 'prospecting'
      | 'active'
      | 'pending'
      | 'closing'
      | 'closed') || null;

    // Aggregate contacts
    const contactMap = new Map<
      string,
      { name: string; email?: string; role?: string }
    >();
    messages.forEach((m) => {
      m.analysis.extractedEntities.contacts.forEach((c) => {
        const key = (c.email || c.name).toLowerCase();
        if (!contactMap.has(key)) {
          contactMap.set(key, {
            name: c.name,
            email: c.email,
            role: c.suggestedRole,
          });
        }
      });
    });

    // Calculate confidence from individual message confidences
    const avgConfidence =
      messages.reduce((sum, m) => sum + m.analysis.confidence, 0) /
      messages.length;

    const now = new Date().toISOString();

    return {
      clusterId: uuidv4(),
      propertyAddress: address,
      confidence: avgConfidence,
      transactionType: dominantType,
      stage: dominantStage,
      communicationIds: messages.map((m) => m.id),
      dateRange: {
        start: dates.length > 0 ? new Date(dates[0]).toISOString() : now,
        end: dates.length > 0 ? new Date(dates[dates.length - 1]).toISOString() : now,
      },
      suggestedContacts: [...contactMap.values()],
      summary: this.generateSummary(
        address,
        messages.length,
        dominantType,
        dominantStage
      ),
    };
  }

  /**
   * Generate a human-readable summary for a cluster.
   */
  private generateSummary(
    address: string,
    msgCount: number,
    type: string | null,
    stage: string | null
  ): string {
    const typeStr = type ? `${type} ` : '';
    const stageStr = stage ? ` (${stage})` : '';
    return `${typeStr}transaction at ${address}${stageStr} with ${msgCount} related communication${msgCount === 1 ? '' : 's'}`;
  }

  /**
   * Build the LLM prompt for complex clustering.
   */
  private buildPrompt(input: ClusterTransactionsInput): LLMMessage[] {
    const systemPrompt = `You are a real estate transaction analyst. Group the provided email analyses into distinct transaction clusters.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "clusters": [
    {
      "propertyAddress": string,
      "messageIds": [string],
      "transactionType": "purchase" | "sale" | "lease" | null,
      "stage": "prospecting" | "active" | "pending" | "closing" | "closed" | null,
      "confidence": number (0-1),
      "summary": string (1-2 sentence description)
    }
  ],
  "unclustered": [string] (message IDs that don't clearly belong to any transaction)
}

Clustering rules:
1. Primary grouping key is property address
2. Messages about the same property belong together
3. If address is unclear, use participant overlap as secondary signal
4. Separate overlapping timeframes with different properties
5. Mark ambiguous assignments with lower confidence`;

    let userPrompt = `Group these analyzed emails into transaction clusters:\n\n`;

    if (input.existingTransactions && input.existingTransactions.length > 0) {
      userPrompt += `Existing transactions (for reference):\n`;
      input.existingTransactions.forEach((t) => {
        userPrompt += `- ${t.propertyAddress} (${t.transactionType || 'unknown type'})\n`;
      });
      userPrompt += '\n';
    }

    userPrompt += `Analyzed messages:\n\n`;
    input.analyzedMessages.forEach((msg, i) => {
      userPrompt += `Message ${i + 1} (ID: ${msg.id}):\n`;
      userPrompt += `- Subject: ${this.sanitizer.sanitize(msg.subject).sanitizedContent}\n`;
      userPrompt += `- From: ${msg.sender}\n`;
      userPrompt += `- Date: ${msg.date}\n`;
      userPrompt += `- Is RE: ${msg.analysis.isRealEstateRelated}, Confidence: ${msg.analysis.confidence}\n`;
      if (msg.analysis.extractedEntities.addresses.length > 0) {
        userPrompt += `- Addresses: ${msg.analysis.extractedEntities.addresses.map((a) => a.value).join(', ')}\n`;
      }
      if (msg.analysis.transactionIndicators.type) {
        userPrompt += `- Type: ${msg.analysis.transactionIndicators.type}, Stage: ${msg.analysis.transactionIndicators.stage || 'unknown'}\n`;
      }
      userPrompt += '\n';
    });

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Parse and validate the LLM response.
   */
  private parseResponse(
    content: string,
    originalMessages: AnalyzedMessage[]
  ): ClusterTransactionsOutput {
    // Extract JSON from response
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

    // Build message lookup for enrichment
    const msgLookup = new Map(originalMessages.map((m) => [m.id, m]));

    const clusters: TransactionCluster[] = (parsed.clusters || []).map(
      (c: Record<string, unknown>) => {
        const messageIds = Array.isArray(c.messageIds)
          ? c.messageIds.map(String)
          : [];

        const messages = messageIds
          .map((id: string) => msgLookup.get(id))
          .filter((m): m is AnalyzedMessage => m !== undefined);

        // Calculate date range from messages
        const dates = messages
          .map((m) => new Date(m.date).getTime())
          .filter((d) => !isNaN(d))
          .sort((a, b) => a - b);

        // Aggregate contacts from messages
        const contactMap = new Map<
          string,
          { name: string; email?: string; role?: string }
        >();
        messages.forEach((m) => {
          m.analysis.extractedEntities.contacts.forEach((contact) => {
            const key = (contact.email || contact.name).toLowerCase();
            if (!contactMap.has(key)) {
              contactMap.set(key, {
                name: contact.name,
                email: contact.email,
                role: contact.suggestedRole,
              });
            }
          });
        });

        const now = new Date().toISOString();

        return {
          clusterId: uuidv4(),
          propertyAddress: String(c.propertyAddress || 'Unknown'),
          confidence: Math.max(
            0,
            Math.min(1, parseFloat(String(c.confidence)) || 0.5)
          ),
          transactionType: this.validateTransactionType(c.transactionType),
          stage: this.validateStage(c.stage),
          communicationIds: messageIds,
          dateRange: {
            start: dates.length > 0 ? new Date(dates[0]).toISOString() : now,
            end:
              dates.length > 0
                ? new Date(dates[dates.length - 1]).toISOString()
                : now,
          },
          suggestedContacts: [...contactMap.values()],
          summary: String(
            c.summary || `Transaction at ${c.propertyAddress || 'Unknown'}`
          ),
        };
      }
    );

    const unclustered = Array.isArray(parsed.unclustered)
      ? parsed.unclustered.map(String)
      : [];

    return {
      clusters,
      unclustered,
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
}
