/**
 * Contact Role Extractor Tool
 * TASK-316: Identifies contact roles from communication context
 *
 * Pure-function AI tool that extracts buyer, seller, agent, escrow,
 * inspector, and other real estate transaction participants with
 * confidence scores and evidence.
 */

import { BaseLLMService } from '../baseLLMService';
import { LLMConfig, LLMMessage } from '../types';
import {
  ContactRoleExtraction,
  ExtractContactRolesInput,
  ToolResult,
  ContactRole,
  ContactRoleAssignment,
} from './types';
import { ContentSanitizer } from '../contentSanitizer';

const VALID_ROLES: ContactRole[] = [
  'buyer',
  'seller',
  'buyer_agent',
  'seller_agent',
  'escrow',
  'title',
  'lender',
  'inspector',
  'appraiser',
  'attorney',
  'other',
];

export class ExtractContactRolesTool {
  private llmService: BaseLLMService;
  private sanitizer: ContentSanitizer;

  constructor(llmService: BaseLLMService) {
    this.llmService = llmService;
    this.sanitizer = new ContentSanitizer();
  }

  /**
   * Extract contact roles from communication history.
   */
  async extract(
    input: ExtractContactRolesInput,
    config: LLMConfig
  ): Promise<ToolResult<ContactRoleExtraction>> {
    const startTime = Date.now();

    try {
      // Handle empty communications
      if (!input.communications || input.communications.length === 0) {
        return {
          success: true,
          data: { assignments: [] },
          latencyMs: Date.now() - startTime,
        };
      }

      // Sanitize all communication content
      const sanitizedComms = input.communications.map((comm) => ({
        ...comm,
        body: this.sanitizer.sanitize(comm.body).sanitizedContent,
        subject: this.sanitizer.sanitize(comm.subject).sanitizedContent,
      }));

      const messages = this.buildPrompt({
        ...input,
        communications: sanitizedComms,
      });

      const response = await this.llmService.completeWithRetry(messages, {
        ...config,
        maxTokens: 2000, // May need more for multiple contacts
      });

      const extraction = this.parseResponse(response.content);

      return {
        success: true,
        data: extraction,
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
   * Build the LLM prompt for contact role extraction.
   */
  private buildPrompt(input: ExtractContactRolesInput): LLMMessage[] {
    const systemPrompt = `You are a real estate transaction analyst. Analyze the provided email communications and identify the role of each participant.

IMPORTANT: Return ONLY valid JSON matching this exact schema:
{
  "assignments": [
    {
      "name": string,
      "email": string | null,
      "phone": string | null,
      "role": "buyer" | "seller" | "buyer_agent" | "seller_agent" | "escrow" | "title" | "lender" | "inspector" | "appraiser" | "attorney" | "other",
      "confidence": number (0-1),
      "evidence": [string] (direct quotes from emails supporting this role assignment)
    }
  ],
  "transactionContext": {
    "propertyAddress": string | null,
    "transactionType": "purchase" | "sale" | "lease" | null
  }
}

Role definitions:
- buyer: The person/entity purchasing the property
- seller: The person/entity selling the property
- buyer_agent: Real estate agent representing the buyer
- seller_agent: Real estate agent representing the seller (listing agent)
- escrow: Escrow officer or company
- title: Title company representative
- lender: Mortgage lender or loan officer
- inspector: Home inspector
- appraiser: Property appraiser
- attorney: Real estate attorney
- other: Any other transaction participant

Provide evidence by quoting relevant text that indicates each person's role. Keep evidence quotes short and relevant.`;

    let userPrompt = `Analyze these email communications and identify participant roles:\n\n`;

    if (input.propertyAddress) {
      userPrompt += `Property: ${input.propertyAddress}\n\n`;
    }

    if (input.knownContacts && input.knownContacts.length > 0) {
      userPrompt += `Known contacts (match if possible):\n`;
      input.knownContacts.forEach((c) => {
        userPrompt += `- ${c.name}${c.email ? ` (${c.email})` : ''}${c.phone ? ` ${c.phone}` : ''}\n`;
      });
      userPrompt += '\n';
    }

    userPrompt += `Communications:\n\n`;
    input.communications.forEach((comm, i) => {
      userPrompt += `--- Email ${i + 1} ---\n`;
      userPrompt += `From: ${comm.sender}\n`;
      userPrompt += `To: ${comm.recipients.join(', ')}\n`;
      userPrompt += `Date: ${comm.date}\n`;
      userPrompt += `Subject: ${comm.subject}\n\n`;
      userPrompt += `${comm.body}\n\n`;
    });

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Parse and validate the LLM response.
   */
  private parseResponse(content: string): ContactRoleExtraction {
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

    // Validate and normalize assignments
    const assignments: ContactRoleAssignment[] = (parsed.assignments || [])
      .map((a: Record<string, unknown>): ContactRoleAssignment | null => {
        if (!a || typeof a !== 'object') return null;

        const name = String(a.name || '');
        if (!name) return null;

        // Validate role
        const role = VALID_ROLES.includes(a.role as ContactRole)
          ? (a.role as ContactRole)
          : 'other';

        // Ensure confidence is valid
        let confidence = parseFloat(String(a.confidence));
        if (isNaN(confidence) || confidence < 0) confidence = 0;
        if (confidence > 1) confidence = 1;

        return {
          name,
          email: a.email ? String(a.email) : undefined,
          phone: a.phone ? String(a.phone) : undefined,
          role,
          confidence,
          evidence: Array.isArray(a.evidence)
            ? a.evidence.map(String).filter((e: string) => e.length > 0)
            : [],
        };
      })
      .filter((a: ContactRoleAssignment | null): a is ContactRoleAssignment => a !== null);

    // Validate transaction context
    const transactionContext: ContactRoleExtraction['transactionContext'] = {};

    if (parsed.transactionContext?.propertyAddress) {
      transactionContext.propertyAddress = String(parsed.transactionContext.propertyAddress);
    }

    if (parsed.transactionContext?.transactionType) {
      const type = parsed.transactionContext.transactionType;
      if (type === 'purchase' || type === 'sale' || type === 'lease') {
        transactionContext.transactionType = type;
      }
    }

    return {
      assignments,
      transactionContext:
        Object.keys(transactionContext).length > 0 ? transactionContext : undefined,
    };
  }
}
