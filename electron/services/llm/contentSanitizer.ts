/**
 * Content Sanitizer for LLM Input
 * Implements Security Option A: Remove/mask PII before sending to LLM providers
 */

export interface SanitizationResult {
  sanitizedContent: string;
  maskedItems: MaskedItem[];
  originalLength: number;
  sanitizedLength: number;
}

export interface MaskedItem {
  type: PIIType;
  original: string; // For debugging/logging (don't expose in production)
  masked: string;
  position: { start: number; end: number };
}

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'bank_account'
  | 'ip_address'
  | 'address'
  | 'name';

interface PatternConfig {
  pattern: RegExp;
  type: PIIType;
  maskFn: (match: string) => string;
}

// PII detection patterns
const PII_PATTERNS: PatternConfig[] = [
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    type: 'email',
    maskFn: (email) => {
      const [local, domain] = email.split('@');
      const maskedLocal = local[0] + '***';
      const domainParts = domain.split('.');
      const maskedDomain = domainParts[0][0] + '***.' + domainParts.slice(-1)[0];
      return `[EMAIL:${maskedLocal}@${maskedDomain}]`;
    },
  },
  // Phone numbers (various formats)
  {
    pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    type: 'phone',
    maskFn: (phone) => {
      // Keep last 4 digits for context
      const digits = phone.replace(/\D/g, '');
      return `[PHONE:***-***-${digits.slice(-4)}]`;
    },
  },
  // SSN
  {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    type: 'ssn',
    maskFn: () => '[SSN:***-**-****]',
  },
  // Credit card numbers
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    type: 'credit_card',
    maskFn: (cc) => {
      const digits = cc.replace(/\D/g, '');
      return `[CARD:****-****-****-${digits.slice(-4)}]`;
    },
  },
  // Bank account numbers (basic pattern - 8-17 digits)
  {
    pattern: /\b\d{8,17}\b/g,
    type: 'bank_account',
    maskFn: (account) => {
      return `[ACCOUNT:****${account.slice(-4)}]`;
    },
  },
  // IP addresses
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    type: 'ip_address',
    maskFn: () => '[IP:***.***.***.***]',
  },
];

// Real estate-specific patterns to preserve (NOT mask)
const PRESERVE_PATTERNS = [
  // Property addresses (we want LLM to see these)
  /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl)\b/gi,
  // MLS numbers
  /\bMLS\s*#?\s*\d+/gi,
  // Transaction amounts (important for context)
  /\$[\d,]+(?:\.\d{2})?/g,
];

export class ContentSanitizer {
  private patterns: PatternConfig[];
  private preservePatterns: RegExp[];

  constructor(customPatterns?: PatternConfig[]) {
    this.patterns = customPatterns ?? PII_PATTERNS;
    this.preservePatterns = PRESERVE_PATTERNS;
  }

  /**
   * Sanitize content by masking PII.
   */
  sanitize(content: string): SanitizationResult {
    if (!content) {
      return {
        sanitizedContent: '',
        maskedItems: [],
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    const maskedItems: MaskedItem[] = [];
    let sanitizedContent = content;

    // Find items to preserve (mark with placeholders)
    const preserved: Array<{ placeholder: string; original: string }> = [];
    this.preservePatterns.forEach((pattern, idx) => {
      // Create a new RegExp to reset lastIndex
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      const matches = sanitizedContent.match(freshPattern) ?? [];
      matches.forEach((match, matchIdx) => {
        const placeholder = `__PRESERVE_${idx}_${matchIdx}__`;
        preserved.push({ placeholder, original: match });
        sanitizedContent = sanitizedContent.replace(match, placeholder);
      });
    });

    // Apply PII masking
    for (const { pattern, type, maskFn } of this.patterns) {
      // Create a new RegExp to reset lastIndex
      const freshPattern = new RegExp(pattern.source, pattern.flags);

      let match;
      const replacements: Array<{ original: string; masked: string; index: number }> = [];

      while ((match = freshPattern.exec(sanitizedContent)) !== null) {
        // Skip if this is a preserved placeholder
        if (match[0].startsWith('__PRESERVE_')) continue;

        const original = match[0];
        const masked = maskFn(original);

        replacements.push({ original, masked, index: match.index });
        maskedItems.push({
          type,
          original,
          masked,
          position: { start: match.index, end: match.index + original.length },
        });
      }

      // Apply replacements (in reverse to preserve indices)
      for (const { original, masked } of replacements) {
        sanitizedContent = sanitizedContent.replace(original, masked);
      }
    }

    // Restore preserved items
    for (const { placeholder, original } of preserved) {
      sanitizedContent = sanitizedContent.replace(placeholder, original);
    }

    return {
      sanitizedContent,
      maskedItems,
      originalLength: content.length,
      sanitizedLength: sanitizedContent.length,
    };
  }

  /**
   * Sanitize email for LLM analysis.
   * Preserves structure while masking PII.
   */
  sanitizeEmail(email: {
    subject: string;
    body: string;
    from: string;
    to: string[];
    cc?: string[];
  }): {
    subject: string;
    body: string;
    from: string;
    to: string[];
    cc: string[];
    maskedItems: MaskedItem[];
  } {
    const allMaskedItems: MaskedItem[] = [];

    const subjectResult = this.sanitize(email.subject);
    allMaskedItems.push(...subjectResult.maskedItems);

    const bodyResult = this.sanitize(email.body);
    allMaskedItems.push(...bodyResult.maskedItems);

    // For from/to/cc, we mask the email but keep structure
    const fromResult = this.sanitize(email.from);
    allMaskedItems.push(...fromResult.maskedItems);

    const toResults = email.to.map((addr) => {
      const result = this.sanitize(addr);
      allMaskedItems.push(...result.maskedItems);
      return result.sanitizedContent;
    });

    const ccResults = (email.cc ?? []).map((addr) => {
      const result = this.sanitize(addr);
      allMaskedItems.push(...result.maskedItems);
      return result.sanitizedContent;
    });

    return {
      subject: subjectResult.sanitizedContent,
      body: bodyResult.sanitizedContent,
      from: fromResult.sanitizedContent,
      to: toResults,
      cc: ccResults,
      maskedItems: allMaskedItems,
    };
  }

  /**
   * Check if content contains PII without modifying it.
   */
  containsPII(content: string): {
    hasPII: boolean;
    types: PIIType[];
  } {
    const foundTypes: Set<PIIType> = new Set();

    for (const { pattern, type } of this.patterns) {
      // Create a new RegExp to reset lastIndex
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      if (freshPattern.test(content)) {
        foundTypes.add(type);
      }
    }

    return {
      hasPII: foundTypes.size > 0,
      types: Array.from(foundTypes),
    };
  }

  /**
   * Get statistics about sanitization.
   */
  getStats(result: SanitizationResult): {
    itemsMasked: number;
    byType: Partial<Record<PIIType, number>>;
    reductionPercent: number;
  } {
    const byType: Partial<Record<PIIType, number>> = {};

    for (const item of result.maskedItems) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
    }

    const reductionPercent =
      result.originalLength > 0
        ? ((result.originalLength - result.sanitizedLength) / result.originalLength) * 100
        : 0;

    return {
      itemsMasked: result.maskedItems.length,
      byType,
      reductionPercent,
    };
  }
}

// Export singleton for convenience
export const contentSanitizer = new ContentSanitizer();
