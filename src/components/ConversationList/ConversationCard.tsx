/**
 * ConversationCard Component
 * Displays a single conversation/contact card with selection and info
 */
import React from "react";
import type { Conversation } from "../../hooks/useConversations";

interface ConversationCardProps {
  conversation: Conversation;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onViewInfo: (conversation: Conversation) => void;
  formatDate: (date: Date | string | number) => string;
  isFirstCard?: boolean;
}

export function ConversationCard({
  conversation,
  isSelected,
  onToggle,
  onViewInfo,
  formatDate,
  isFirstCard = false,
}: ConversationCardProps) {
  const handleCardClick = (): void => {
    onToggle(conversation.id);
  };

  const handleViewInfo = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    onViewInfo(conversation);
  };

  return (
    <div
      onClick={handleCardClick}
      data-tour={isFirstCard ? "contact-list" : undefined}
      className={`p-4 bg-white border-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          {/* Checkbox */}
          <div
            className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-4 flex items-center justify-center ${
              isSelected ? "bg-primary border-primary" : "border-gray-300"
            }`}
          >
            {isSelected && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {conversation.name}
            </h3>

            {/* Contact info summary */}
            {(conversation.phones?.length || conversation.emails?.length) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {conversation.phones?.length && (
                  <span>
                    {conversation.phones.length} Phone
                    {conversation.phones.length > 1 ? "s" : ""}
                  </span>
                )}
                {conversation.phones?.length &&
                  conversation.emails?.length &&
                  " · "}
                {conversation.emails?.length && (
                  <span>
                    {conversation.emails.length} Email
                    {conversation.emails.length > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            )}

            {/* Message statistics */}
            <p className="text-sm text-gray-500 mt-1">
              {conversation.directChatCount > 0 &&
              conversation.groupChatCount > 0 ? (
                // Has both direct and group chats
                <>
                  {conversation.directChatCount} direct message thread
                  {conversation.directChatCount > 1 ? "s" : ""} (
                  {conversation.directMessageCount} message
                  {conversation.directMessageCount !== 1 ? "s" : ""}){" and "}
                  {conversation.groupChatCount} group chat thread
                  {conversation.groupChatCount > 1 ? "s" : ""} (
                  {conversation.groupMessageCount} message
                  {conversation.groupMessageCount !== 1 ? "s" : ""})
                </>
              ) : conversation.directChatCount > 0 ? (
                // Only direct chats
                <>
                  {conversation.directChatCount} direct message thread
                  {conversation.directChatCount > 1 ? "s" : ""} (
                  {conversation.directMessageCount} message
                  {conversation.directMessageCount !== 1 ? "s" : ""})
                </>
              ) : conversation.groupChatCount > 0 ? (
                // Only group chats
                <>
                  {conversation.groupChatCount} group chat thread
                  {conversation.groupChatCount > 1 ? "s" : ""} (
                  {conversation.groupMessageCount} message
                  {conversation.groupMessageCount !== 1 ? "s" : ""})
                </>
              ) : (
                // Fallback to old format
                <>{conversation.messageCount || 0} messages</>
              )}
              {" · "}
              {formatDate(conversation.lastMessageDate)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="ml-4 flex gap-2 items-center">
          {/* Contact Info Button */}
          {(conversation.phones?.length || conversation.emails?.length) && (
            <button
              onClick={handleViewInfo}
              className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition-colors"
              title="View contact info"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
