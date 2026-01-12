/**
 * ConversationViewModal Component
 * Phone-style popup modal for viewing a full conversation thread.
 * Supports inline display of image/GIF attachments (TASK-1012).
 */
import React, { useEffect, useState, useCallback } from "react";
import type { MessageLike } from "../MessageThreadCard";

/**
 * Attachment info for display (TASK-1012)
 */
interface MessageAttachmentInfo {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  data: string | null;
}

interface ConversationViewModalProps {
  /** Messages in the thread */
  messages: MessageLike[];
  /** Contact name for header */
  contactName?: string;
  /** Phone number for header */
  phoneNumber: string;
  /** Map of phone -> name for group chat sender resolution */
  contactNames?: Record<string, string>;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Normalize phone for lookup (last 10 digits)
 */
function normalizePhoneForLookup(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Extract sender phone from message participants
 */
function getSenderPhone(msg: MessageLike): string | null {
  if (msg.direction === "outbound") return null;

  try {
    if (msg.participants) {
      const parsed =
        typeof msg.participants === "string"
          ? JSON.parse(msg.participants)
          : msg.participants;
      if (parsed.from) return parsed.from;
    }
  } catch {
    // Fall through
  }

  if ("sender" in msg && msg.sender) {
    return msg.sender;
  }

  return null;
}

/**
 * Format timestamp for display
 */
function formatMessageTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Check if a MIME type is a displayable image
 */
function isDisplayableImage(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("image/") &&
    !mimeType.includes("heic") // HEIC requires conversion
  );
}

/**
 * Attachment image component with loading state and error handling
 */
function AttachmentImage({
  attachment,
  isOutbound,
}: {
  attachment: MessageAttachmentInfo;
  isOutbound: boolean;
}): React.ReactElement | null {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!attachment.data || imageError) {
    // Show placeholder for missing/failed attachments
    return (
      <div
        className={`text-xs italic ${isOutbound ? "text-green-100" : "text-gray-400"}`}
      >
        [Image: {attachment.filename || "attachment"}]
      </div>
    );
  }

  const mimeType = attachment.mime_type || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${attachment.data}`;

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      )}
      <img
        src={dataUrl}
        alt={attachment.filename || "Attachment"}
        className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setImageError(true);
        }}
        onClick={() => {
          // Open in new window for full-size view
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(`<img src="${dataUrl}" style="max-width: 100%; height: auto;" />`);
          }
        }}
      />
    </div>
  );
}

export function ConversationViewModal({
  messages,
  contactName,
  phoneNumber,
  contactNames = {},
  onClose,
}: ConversationViewModalProps): React.ReactElement {
  // Attachments state (TASK-1012)
  const [attachmentsMap, setAttachmentsMap] = useState<
    Record<string, MessageAttachmentInfo[]>
  >({});
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Sort messages chronologically
  const sortedMessages = [...messages].sort((a, b) => {
    const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
    const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
    return dateA - dateB;
  });

  // Check if this is a group chat (multiple unique senders)
  const uniqueSenders = new Set<string>();
  messages.forEach((msg) => {
    const sender = getSenderPhone(msg);
    if (sender) uniqueSenders.add(normalizePhoneForLookup(sender));
  });
  const isGroupChat = uniqueSenders.size > 1;

  /**
   * Get title for group chat header.
   * Shows participant names (up to 3) with "+X more" for larger groups.
   */
  const getGroupChatTitle = (): string => {
    // Build participant list from contactNames or unique senders
    const participants: string[] = [];

    // First, try to get names from contactNames prop
    for (const [phone, name] of Object.entries(contactNames)) {
      const normalized = normalizePhoneForLookup(phone);
      if (uniqueSenders.has(normalized)) {
        participants.push(name || phone);
      }
    }

    // Add any senders not in contactNames (show phone number)
    for (const sender of uniqueSenders) {
      const hasName = participants.some((p) => {
        // Check if this sender already has a name in the list
        return Object.entries(contactNames).some(([phone, name]) => {
          const normalized = normalizePhoneForLookup(phone);
          return normalized === sender && (name === p || phone === p);
        });
      });
      if (!hasName) {
        // Find the original phone format for this sender
        let originalPhone = sender;
        for (const msg of messages) {
          const msgSender = getSenderPhone(msg);
          if (msgSender && normalizePhoneForLookup(msgSender) === sender) {
            originalPhone = msgSender;
            break;
          }
        }
        participants.push(originalPhone);
      }
    }

    if (participants.length === 0) {
      return `Group (${uniqueSenders.size} participants)`;
    }

    // Show up to 3 names, then "+X more"
    if (participants.length <= 3) {
      return participants.join(", ");
    }
    return `${participants.slice(0, 3).join(", ")} +${participants.length - 3} more`;
  };

  // Load attachments for messages that have them (TASK-1012)
  const loadAttachments = useCallback(async () => {
    // Get message IDs that have attachments
    const messageIdsWithAttachments = messages
      .filter((msg) => msg.has_attachments)
      .map((msg) => msg.id);

    if (messageIdsWithAttachments.length === 0) return;

    setAttachmentsLoading(true);
    try {
      // Check if API is available (may not be on all platforms)
      if (window.api?.messages?.getMessageAttachmentsBatch) {
        const result = await window.api.messages.getMessageAttachmentsBatch(
          messageIdsWithAttachments
        );
        setAttachmentsMap(result);
      }
    } catch (error) {
      console.error("Failed to load attachments:", error);
    } finally {
      setAttachmentsLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Phone-style header */}
        <div className="bg-gradient-to-r from-green-500 to-teal-600 px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="flex-1">
            <h4 className="text-white font-semibold">
              {isGroupChat ? getGroupChatTitle() : (contactName || phoneNumber)}
            </h4>
            <p className="text-green-100 text-xs">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Messages list - phone style */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMessages.map((msg, index) => {
            const isOutbound = msg.direction === "outbound";
            const rawText =
              msg.body_text ||
              msg.body_plain ||
              ("body" in msg ? (msg as { body?: string }).body : "") ||
              "";

            const msgText = rawText;
            const msgTime = new Date(msg.sent_at || msg.received_at || 0);

            // Get sender info for group chats
            const senderPhone = getSenderPhone(msg);
            let senderName: string | undefined;
            let showSender = false;

            if (isGroupChat && senderPhone && !isOutbound) {
              const normalized = normalizePhoneForLookup(senderPhone);
              senderName =
                contactNames[senderPhone] ||
                contactNames[normalized] ||
                senderPhone;

              // Show sender if different from previous message
              if (index === 0) {
                showSender = true;
              } else {
                const prevSender = getSenderPhone(sortedMessages[index - 1]);
                if (prevSender) {
                  const prevNormalized = normalizePhoneForLookup(prevSender);
                  showSender = normalized !== prevNormalized;
                } else {
                  showSender = true;
                }
              }
            }

            // Get attachments for this message (TASK-1012)
            const messageAttachments = attachmentsMap[msg.id] || [];
            const displayableAttachments = messageAttachments.filter((att) =>
              isDisplayableImage(att.mime_type)
            );

            return (
              <div
                key={msg.id}
                className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isOutbound
                      ? "bg-green-500 text-white rounded-br-md"
                      : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                  }`}
                >
                  {showSender && senderName && (
                    <p
                      className="text-xs font-semibold text-green-600 mb-1"
                      data-testid="group-message-sender"
                    >
                      {senderName}
                    </p>
                  )}
                  {/* Display attachments (TASK-1012) */}
                  {displayableAttachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {displayableAttachments.map((att) => (
                        <AttachmentImage
                          key={att.id}
                          attachment={att}
                          isOutbound={isOutbound}
                        />
                      ))}
                    </div>
                  )}
                  {/* Show placeholder for attachments still loading */}
                  {!!msg.has_attachments &&
                    displayableAttachments.length === 0 &&
                    attachmentsLoading && (
                      <div
                        className={`text-xs italic mb-1 ${isOutbound ? "text-green-100" : "text-gray-400"}`}
                      >
                        Loading attachment...
                      </div>
                    )}
                  {/* Show placeholder for unsupported attachments */}
                  {!!msg.has_attachments &&
                    displayableAttachments.length === 0 &&
                    !attachmentsLoading &&
                    messageAttachments.length === 0 && (
                      <div
                        className={`text-xs italic mb-1 ${isOutbound ? "text-green-100" : "text-gray-400"}`}
                      >
                        [Attachment]
                      </div>
                    )}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msgText || (displayableAttachments.length === 0 ? "(No content)" : "")}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isOutbound ? "text-green-100" : "text-gray-400"
                    }`}
                  >
                    {formatMessageTime(msgTime)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-4 py-3 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm font-medium text-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConversationViewModal;
