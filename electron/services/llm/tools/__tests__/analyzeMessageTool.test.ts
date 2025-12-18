/**
 * Unit tests for AnalyzeMessageTool
 * TASK-315: Message Analyzer Tool
 */

import { AnalyzeMessageTool } from '../analyzeMessageTool';
import { BaseLLMService } from '../../baseLLMService';
import { LLMConfig, LLMMessage, LLMResponse } from '../../types';
import { AnalyzeMessageInput, MessageAnalysis } from '../types';

// Mock BaseLLMService
class MockLLMService extends BaseLLMService {
  private mockResponse: string = '';
  private shouldThrow: boolean = false;
  private throwError?: Error;

  constructor() {
    super('openai');
  }

  setMockResponse(response: string): void {
    this.mockResponse = response;
    this.shouldThrow = false;
  }

  setMockError(error: Error): void {
    this.shouldThrow = true;
    this.throwError = error;
  }

  async complete(
    _messages: LLMMessage[],
    _config: LLMConfig
  ): Promise<LLMResponse> {
    if (this.shouldThrow && this.throwError) {
      throw this.throwError;
    }
    return {
      content: this.mockResponse,
      tokensUsed: { prompt: 100, completion: 50, total: 150 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
      latencyMs: 500,
    };
  }

  async validateApiKey(_apiKey: string): Promise<boolean> {
    return true;
  }
}

describe('AnalyzeMessageTool', () => {
  let tool: AnalyzeMessageTool;
  let mockService: MockLLMService;
  const testConfig: LLMConfig = {
    provider: 'openai',
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
  };

  const testInput: AnalyzeMessageInput = {
    subject: 'Re: Closing on 123 Main St',
    body: 'Hi, I wanted to confirm the closing date for 123 Main Street. The buyer has approved the $450,000 offer.',
    sender: 'agent@realty.com',
    recipients: ['buyer@email.com', 'seller@email.com'],
    date: '2024-01-15T10:30:00Z',
  };

  beforeEach(() => {
    mockService = new MockLLMService();
    tool = new AnalyzeMessageTool(mockService);
  });

  describe('successful analysis', () => {
    it('should analyze a real estate email and return structured data', async () => {
      const mockResponse: MessageAnalysis = {
        isRealEstateRelated: true,
        confidence: 0.95,
        transactionIndicators: {
          type: 'purchase',
          stage: 'closing',
        },
        extractedEntities: {
          addresses: [{ value: '123 Main Street', confidence: 0.9 }],
          amounts: [{ value: 450000, context: 'offer' }],
          dates: [],
          contacts: [{ name: 'Agent', email: 'agent@realty.com', suggestedRole: 'buyer_agent' }],
        },
        reasoning: 'Email discusses closing on a property with specific address and offer amount.',
      };

      mockService.setMockResponse(JSON.stringify(mockResponse));

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.isRealEstateRelated).toBe(true);
      expect(result.data?.confidence).toBe(0.95);
      expect(result.data?.transactionIndicators.type).toBe('purchase');
      expect(result.data?.transactionIndicators.stage).toBe('closing');
      expect(result.data?.extractedEntities.addresses).toHaveLength(1);
      expect(result.data?.extractedEntities.amounts).toHaveLength(1);
      expect(result.tokensUsed).toBeDefined();
      expect(result.latencyMs).toBeDefined();
    });

    it('should handle non-RE email with low confidence', async () => {
      const mockResponse: MessageAnalysis = {
        isRealEstateRelated: false,
        confidence: 0.1,
        transactionIndicators: {
          type: null,
          stage: null,
        },
        extractedEntities: {
          addresses: [],
          amounts: [],
          dates: [],
          contacts: [],
        },
        reasoning: 'This appears to be a marketing email unrelated to real estate.',
      };

      mockService.setMockResponse(JSON.stringify(mockResponse));

      const result = await tool.analyze(
        { ...testInput, subject: 'Weekly Newsletter', body: 'Check out our latest deals!' },
        testConfig
      );

      expect(result.success).toBe(true);
      expect(result.data?.isRealEstateRelated).toBe(false);
      expect(result.data?.confidence).toBeLessThan(0.5);
    });
  });

  describe('JSON parsing', () => {
    it('should parse JSON wrapped in code blocks', async () => {
      const jsonContent = JSON.stringify({
        isRealEstateRelated: true,
        confidence: 0.85,
        transactionIndicators: { type: 'sale', stage: 'active' },
        extractedEntities: { addresses: [], amounts: [], dates: [], contacts: [] },
        reasoning: 'Test',
      });

      mockService.setMockResponse('```json\n' + jsonContent + '\n```');

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data?.confidence).toBe(0.85);
    });

    it('should parse JSON without code blocks', async () => {
      const jsonContent = JSON.stringify({
        isRealEstateRelated: true,
        confidence: 0.75,
        transactionIndicators: { type: 'lease', stage: 'prospecting' },
        extractedEntities: { addresses: [], amounts: [], dates: [], contacts: [] },
        reasoning: 'Test',
      });

      mockService.setMockResponse(jsonContent);

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data?.transactionIndicators.type).toBe('lease');
    });

    it('should extract JSON from mixed content', async () => {
      const jsonContent = JSON.stringify({
        isRealEstateRelated: true,
        confidence: 0.8,
        transactionIndicators: { type: 'purchase', stage: 'pending' },
        extractedEntities: { addresses: [], amounts: [], dates: [], contacts: [] },
        reasoning: 'Analysis complete',
      });

      mockService.setMockResponse('Here is my analysis:\n' + jsonContent + '\n\nLet me know if you need more.');

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data?.isRealEstateRelated).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      mockService.setMockResponse('{ invalid json }');

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.latencyMs).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      mockService.setMockResponse(JSON.stringify({ reasoning: 'test' }));

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('isRealEstateRelated');
    });

    it('should handle invalid confidence value', async () => {
      mockService.setMockResponse(
        JSON.stringify({
          isRealEstateRelated: true,
          confidence: 'high', // Invalid - should be number
          transactionIndicators: {},
          extractedEntities: {},
          reasoning: 'test',
        })
      );

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('confidence');
    });

    it('should handle LLM service errors', async () => {
      mockService.setMockError(new Error('API timeout'));

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API timeout');
    });
  });

  describe('validation', () => {
    it('should clamp confidence to 0-1 range', async () => {
      mockService.setMockResponse(
        JSON.stringify({
          isRealEstateRelated: true,
          confidence: 0.95,
          transactionIndicators: { type: null, stage: null },
          extractedEntities: {
            addresses: [{ value: '123 Test', confidence: 1.5 }], // Over 1
            amounts: [],
            dates: [],
            contacts: [],
          },
          reasoning: 'test',
        })
      );

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data?.extractedEntities.addresses[0].confidence).toBe(1);
    });

    it('should filter out invalid entities', async () => {
      mockService.setMockResponse(
        JSON.stringify({
          isRealEstateRelated: true,
          confidence: 0.8,
          transactionIndicators: { type: 'sale', stage: null },
          extractedEntities: {
            addresses: [{ value: '', confidence: 0.5 }, { value: '123 Main St', confidence: 0.9 }],
            amounts: [{ value: 0, context: 'test' }, { value: 500000, context: 'price' }],
            dates: [],
            contacts: [{ name: '' }, { name: 'John Doe' }],
          },
          reasoning: 'test',
        })
      );

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data?.extractedEntities.addresses).toHaveLength(1);
      expect(result.data?.extractedEntities.amounts).toHaveLength(1);
      expect(result.data?.extractedEntities.contacts).toHaveLength(1);
    });

    it('should normalize invalid transaction types to null', async () => {
      mockService.setMockResponse(
        JSON.stringify({
          isRealEstateRelated: true,
          confidence: 0.7,
          transactionIndicators: { type: 'rental', stage: 'unknown' },
          extractedEntities: { addresses: [], amounts: [], dates: [], contacts: [] },
          reasoning: 'test',
        })
      );

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.data?.transactionIndicators.type).toBeNull();
      expect(result.data?.transactionIndicators.stage).toBeNull();
    });
  });

  describe('result structure', () => {
    it('should always include latencyMs in result', async () => {
      mockService.setMockResponse(
        JSON.stringify({
          isRealEstateRelated: true,
          confidence: 0.9,
          transactionIndicators: { type: null, stage: null },
          extractedEntities: { addresses: [], amounts: [], dates: [], contacts: [] },
          reasoning: 'test',
        })
      );

      const result = await tool.analyze(testInput, testConfig);

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should include tokensUsed on success', async () => {
      mockService.setMockResponse(
        JSON.stringify({
          isRealEstateRelated: false,
          confidence: 0.2,
          transactionIndicators: { type: null, stage: null },
          extractedEntities: { addresses: [], amounts: [], dates: [], contacts: [] },
          reasoning: 'Not RE related',
        })
      );

      const result = await tool.analyze(testInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBeDefined();
      expect(result.tokensUsed?.total).toBe(150);
    });
  });
});
