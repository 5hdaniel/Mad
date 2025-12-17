# Task TASK-314: Content Sanitizer

## Goal

Create a content sanitizer service that removes or masks PII (personally identifiable information) from email content before sending to LLM providers, implementing Security Option A from the AI MVP plan.

## Non-Goals

- Do NOT implement consent tracking (that's in TASK-302/TASK-311)
- Do NOT implement actual LLM calls
- Do NOT modify email storage

## Deliverables

1. New file: `electron/services/llm/contentSanitizer.ts` - Sanitization service

## Acceptance Criteria

- [ ] Email addresses detected and masked
- [ ] Phone numbers detected and masked
- [ ] SSN/tax IDs detected and masked
- [ ] Credit card numbers detected and masked
- [ ] Bank account numbers detected and masked
- [ ] Preserves document structure for LLM understanding
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes

## Implementation Notes

### Content Sanitizer

Create `electron/services/llm/contentSanitizer.ts`:

```typescript
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
  original: string;  // For debugging/logging (don't expose in production)
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
  | 'name';  // Names are tricky - optional

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
  // Bank account numbers (basic pattern)
  {
    pattern: /\b\d{8,17}\b/g,
    type: 'bank_account',
    maskFn: (account) => {
      // Only mask if it looks like an account number (context-dependent)
      // This is a conservative pattern - may need refinement
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
      const matches = content.match(pattern) ?? [];
      matches.forEach((match, matchIdx) => {
        const placeholder = `__PRESERVE_${idx}_${matchIdx}__`;
        preserved.push({ placeholder, original: match });
        sanitizedContent = sanitizedContent.replace(match, placeholder);
      });
    });

    // Apply PII masking
    for (const { pattern, type, maskFn } of this.patterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;

      let match;
      const replacements: Array<{ original: string; masked: string }> = [];

      while ((match = pattern.exec(sanitizedContent)) !== null) {
        // Skip if this is a preserved placeholder
        if (match[0].startsWith('__PRESERVE_')) continue;

        const original = match[0];
        const masked = maskFn(original);

        replacements.push({ original, masked });
        maskedItems.push({
          type,
          original,
          masked,
          position: { start: match.index, end: match.index + original.length },
        });
      }

      // Apply replacements
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

    const toResults = email.to.map(addr => {
      const result = this.sanitize(addr);
      allMaskedItems.push(...result.maskedItems);
      return result.sanitizedContent;
    });

    const ccResults = (email.cc ?? []).map(addr => {
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
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
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
    byType: Record<PIIType, number>;
    reductionPercent: number;
  } {
    const byType: Record<PIIType, number> = {} as any;

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
```

### Test File

Create `electron/services/llm/__tests__/contentSanitizer.test.ts`:

```typescript
import { ContentSanitizer } from '../contentSanitizer';

describe('ContentSanitizer', () => {
  let sanitizer: ContentSanitizer;

  beforeEach(() => {
    sanitizer = new ContentSanitizer();
  });

  describe('email masking', () => {
    it('should mask email addresses', () => {
      const result = sanitizer.sanitize('Contact john.doe@example.com for details');
      expect(result.sanitizedContent).toContain('[EMAIL:j***@e***.com]');
      expect(result.maskedItems).toHaveLength(1);
      expect(result.maskedItems[0].type).toBe('email');
    });
  });

  describe('phone masking', () => {
    it('should mask phone numbers', () => {
      const result = sanitizer.sanitize('Call me at (555) 123-4567');
      expect(result.sanitizedContent).toContain('[PHONE:***-***-4567]');
    });

    it('should handle various phone formats', () => {
      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '+1 555 123 4567',
        '555.123.4567',
      ];

      for (const phone of formats) {
        const result = sanitizer.sanitize(`Number: ${phone}`);
        expect(result.maskedItems[0].type).toBe('phone');
      }
    });
  });

  describe('SSN masking', () => {
    it('should mask SSN', () => {
      const result = sanitizer.sanitize('SSN: 123-45-6789');
      expect(result.sanitizedContent).toContain('[SSN:***-**-****]');
    });
  });

  describe('credit card masking', () => {
    it('should mask credit card numbers', () => {
      const result = sanitizer.sanitize('Card: 4111-1111-1111-1234');
      expect(result.sanitizedContent).toContain('[CARD:****-****-****-1234]');
    });
  });

  describe('preservation', () => {
    it('should preserve property addresses', () => {
      const content = 'Property at 123 Main Street is listed at $450,000';
      const result = sanitizer.sanitize(content);
      expect(result.sanitizedContent).toContain('123 Main Street');
      expect(result.sanitizedContent).toContain('$450,000');
    });

    it('should preserve MLS numbers', () => {
      const result = sanitizer.sanitize('MLS #12345678');
      expect(result.sanitizedContent).toContain('MLS #12345678');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize all email parts', () => {
      const result = sanitizer.sanitizeEmail({
        subject: 'Call 555-123-4567',
        body: 'Email me at john@example.com',
        from: 'sender@email.com',
        to: ['recipient@email.com'],
      });

      expect(result.subject).toContain('[PHONE:');
      expect(result.body).toContain('[EMAIL:');
      expect(result.from).toContain('[EMAIL:');
      expect(result.to[0]).toContain('[EMAIL:');
    });
  });

  describe('containsPII', () => {
    it('should detect PII without modifying', () => {
      const content = 'SSN: 123-45-6789, Email: test@example.com';
      const result = sanitizer.containsPII(content);

      expect(result.hasPII).toBe(true);
      expect(result.types).toContain('ssn');
      expect(result.types).toContain('email');
    });

    it('should return false for clean content', () => {
      const result = sanitizer.containsPII('Property at 123 Main Street');
      expect(result.hasPII).toBe(false);
    });
  });
});
```

## Integration Notes

- Imports from: None (standalone utility)
- Exports to: BACKLOG-075 (AI Analysis Tools)
- Used by: `hybridExtractorService` before LLM calls
- Depends on: TASK-306 (for integration)

## Do / Don't

### Do:
- Preserve real estate-relevant information
- Keep masked format consistent for LLM understanding
- Log sanitization stats for monitoring
- Test with real email samples (anonymized)

### Don't:
- Don't mask property addresses
- Don't mask transaction amounts
- Don't over-mask (lose context)
- Don't store original PII with masked data

## When to Stop and Ask

- If additional PII patterns needed
- If preservation patterns too broad/narrow
- If real estate content being masked incorrectly

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - All PII type detection
  - Preservation of real estate data
  - Edge cases (empty, very long)
  - Email structure sanitization

### Coverage

- Coverage impact: >90% (critical security feature)

### CI Requirements

- [ ] Unit tests (npm test)
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

## PR Preparation

- **Branch**: `feature/TASK-314-content-sanitizer`
- **Title**: `feat(llm): add content sanitizer for PII removal`
- **Labels**: `llm`, `security`, `ai-mvp`, `sprint-004`
- **Depends on**: TASK-306

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] electron/services/llm/contentSanitizer.ts
- [ ] electron/services/llm/__tests__/contentSanitizer.test.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Reviewer notes:**
<Anything reviewer should pay attention to>

---

## SR Engineer Review Notes

**Review Date:** 2025-12-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/llm-infrastructure (after TASK-306 merged)
- **Branch Into:** int/llm-infrastructure
- **Suggested Branch Name:** feature/TASK-314-content-sanitizer

### Execution Classification
- **Parallel Safe:** Yes (with TASK-307, TASK-308, TASK-309, TASK-310, TASK-313)
- **Depends On:** TASK-306 (LLM Base Interface - for integration)
- **Blocks:** None (standalone utility)

### Shared File Analysis
- Files created:
  - `electron/services/llm/contentSanitizer.ts`
  - `electron/services/llm/__tests__/contentSanitizer.test.ts`
- Conflicts with:
  - **NONE** - Creates new files

### Technical Considerations
- **SECURITY CRITICAL** - Implements Security Option A
- PII detection: email, phone, SSN, credit card, bank account, IP address
- Preservation patterns: property addresses, MLS numbers, transaction amounts
- Real estate-specific content PRESERVED for LLM context
- >90% coverage required (critical security feature)

### Security Notes
- Original PII stored in maskedItems for debugging/logging (don't expose in production)
- Masking preserves partial info for context (last 4 digits of phone/card)
- Placeholder preservation prevents over-masking of important data

### Pattern Testing
- Test all PII formats (phone number variations especially)
- Test preservation (property addresses NOT masked)
- Test edge cases: empty content, very long content, mixed content

### Standalone Utility
- Can be used independently of LLM services
- Exported singleton for convenience: `contentSanitizer`
