/**
 * Channel/Communication Type Helpers
 *
 * The codebase has two competing naming systems for message channels:
 * - `channel` (typed MessageChannel): "email" | "sms" | "imessage"
 * - `communication_type` (untyped string): "email" | "text" | "imessage" | "sms"
 *
 * These helpers abstract the inconsistency so callers don't need to know
 * which field or value format a given record uses.
 *
 * @see TASK-2024, BACKLOG-754
 */

/**
 * Minimal shape needed for channel detection.
 * Accepts any object that may have `channel` and/or `communication_type`.
 */
export interface ChannelInfo {
  channel?: string;
  communication_type?: string;
}

/**
 * Determines if a communication is a text message (SMS or iMessage).
 *
 * Handles both naming systems:
 * - channel: "sms" | "imessage" | "text" (legacy)
 * - communication_type: "text" | "imessage" | "sms"
 */
export function isTextMessage(comm: ChannelInfo): boolean {
  if (comm.channel) {
    return (
      comm.channel === "sms" ||
      comm.channel === "imessage" ||
      comm.channel === "text" // Legacy value used in some records
    );
  }
  if (comm.communication_type) {
    return (
      comm.communication_type === "text" ||
      comm.communication_type === "imessage" ||
      comm.communication_type === "sms"
    );
  }
  return false;
}

/**
 * Determines if a communication is an email message.
 *
 * Handles both naming systems:
 * - channel: "email"
 * - communication_type: "email"
 */
export function isEmailMessage(comm: ChannelInfo): boolean {
  if (comm.channel) {
    return comm.channel === "email";
  }
  if (comm.communication_type) {
    return comm.communication_type === "email";
  }
  return false;
}
