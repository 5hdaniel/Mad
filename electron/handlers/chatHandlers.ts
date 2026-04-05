/**
 * Chat IPC Handlers
 * Handles AI chatbot message sending via local or cloud LLM.
 * Builds context from user's transaction data before sending to LLM.
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import logService from '../services/logService';
import { LLMConfigService } from '../services/llm/llmConfigService';
import { chatContextService } from '../services/chat/chatContextService';
import type { LLMMessage } from '../services/llm/types';

interface ChatHandlerResponse {
  success: boolean;
  data?: { content: string };
  error?: { message: string };
}

export function registerChatHandlers(configService: LLMConfigService): void {
  /**
   * Send a chat message and get an AI response.
   * Channel: chat:send-message
   */
  ipcMain.handle(
    'chat:send-message',
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      message: string,
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    ): Promise<ChatHandlerResponse> => {
      try {
        // Build context-aware system prompt
        const systemPrompt = chatContextService.buildSystemPrompt(userId);

        // Build message array with history
        const messages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-10).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
          { role: 'user', content: message },
        ];

        // Use configService.complete() which handles provider selection internally
        const response = await configService.complete(userId, messages, {
          maxTokens: 1000,
          temperature: 0.7,
        });

        return { success: true, data: { content: response.content } };
      } catch (error) {
        logService.error('[Chat Handler] Send message failed:', 'ChatHandlers', { error });
        return {
          success: false,
          error: { message: error instanceof Error ? error.message : 'Chat failed' },
        };
      }
    }
  );

  /**
   * Clear chat history (no-op on backend, state is in renderer).
   * Channel: chat:clear-history
   */
  ipcMain.handle('chat:clear-history', async () => {
    return { success: true };
  });
}
