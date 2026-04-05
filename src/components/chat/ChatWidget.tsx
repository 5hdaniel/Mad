/**
 * ChatWidget Component
 * Floating AI chat button + slide-up conversation panel.
 * Follows the SupportWidget pattern for positioning.
 *
 * Feature-gated by local_ai — only visible when local model is downloaded.
 */

import React, { useState, useCallback } from "react";
import { usePlatform } from "../../contexts";
import ChatPanel from "./ChatPanel";

interface ChatWidgetProps {
  userId?: string;
}

export function ChatWidget({ userId }: ChatWidgetProps): React.ReactElement | null {
  const { isWindows } = usePlatform();
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Windows needs more offset to avoid resize zones
  const positionClass = isWindows ? "bottom-8 left-20" : "bottom-4 left-16";

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className={`
          fixed ${positionClass} z-[60]
          w-12 h-12 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-200
          no-drag-region
          ${isOpen
            ? "bg-gray-600 hover:bg-gray-700 scale-90"
            : "bg-purple-600 hover:bg-purple-700 hover:shadow-xl hover:scale-105"
          }
        `}
        title={isOpen ? "Close AI Chat" : "Open AI Chat"}
        aria-label={isOpen ? "Close AI Chat" : "Open AI Chat"}
      >
        {isOpen ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <ChatPanel
          userId={userId ?? ""}
          onClose={handleClose}
          positionClass={isWindows ? "bottom-24 left-8" : "bottom-20 left-4"}
        />
      )}
    </>
  );
}

export default ChatWidget;
