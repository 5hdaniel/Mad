/**
 * Chat Bridge
 * Exposes AI chatbot IPC methods to the renderer process.
 */

import { ipcRenderer } from "electron";

export const chatBridge = {
  /**
   * Send a message to the AI chatbot and get a response.
   */
  sendMessage: (
    userId: string,
    message: string,
    history: Array<{ role: "user" | "assistant"; content: string }>
  ) =>
    ipcRenderer.invoke("chat:send-message", userId, message, history),

  /**
   * Clear chat history (renderer-side state reset confirmation).
   */
  clearHistory: () => ipcRenderer.invoke("chat:clear-history"),
};
