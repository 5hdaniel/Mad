/**
 * SMS Reader Service (Android Companion)
 * Reads SMS messages from the Android content provider.
 *
 * TASK-1430: SMS BroadcastReceiver + background sync service
 *
 * Uses react-native-get-sms-android to query the Android SMS inbox.
 * Messages are read since a given timestamp to avoid re-reading old messages.
 *
 * Android SMS types (from content://sms):
 *   1 = MESSAGE_TYPE_INBOX (inbound)
 *   2 = MESSAGE_TYPE_SENT (outbound)
 *   3 = MESSAGE_TYPE_DRAFT
 *   4 = MESSAGE_TYPE_OUTBOX
 *   5 = MESSAGE_TYPE_FAILED
 *   6 = MESSAGE_TYPE_QUEUED
 *
 * We only sync types 1 (inbox/inbound) and 2 (sent/outbound).
 */

import { Platform, NativeModules } from "react-native";
import type { SyncMessage } from "../types/sync";
import { normalizePhoneNumber } from "./phoneNormalization";

/** Raw SMS record from react-native-get-sms-android */
interface RawSmsRecord {
  _id: string;
  thread_id: string;
  address: string;
  body: string;
  date: string;
  date_sent: string;
  type: string;
  read: string;
}

/** Filter options for querying SMS messages */
interface SmsFilter {
  box: "inbox" | "sent";
  /** Minimum date in milliseconds — only messages after this timestamp */
  minDate?: number;
  /** Maximum number of messages to read */
  maxCount?: number;
}

/** Android SMS type constants */
const SMS_TYPE_INBOX = "1";
const SMS_TYPE_SENT = "2";

/**
 * Read SMS messages from the Android content provider.
 *
 * @param sinceTimestamp - Unix timestamp (ms) — only reads messages newer than this
 * @param maxCount - Maximum number of messages to read per box (default 100)
 * @returns Array of SyncMessage objects ready for syncing
 */
export async function readSmsMessages(
  sinceTimestamp: number,
  maxCount: number = 100
): Promise<SyncMessage[]> {
  if (Platform.OS !== "android") {
    return [];
  }

  const SmsAndroid = NativeModules.SmsAndroid;
  if (!SmsAndroid) {
    console.warn("[SmsReader] SmsAndroid native module not available");
    return [];
  }

  // Read from both inbox and sent
  const [inboxMessages, sentMessages] = await Promise.all([
    readBox({ box: "inbox", minDate: sinceTimestamp, maxCount }),
    readBox({ box: "sent", minDate: sinceTimestamp, maxCount }),
  ]);

  // Combine, sort by timestamp ascending
  const allMessages = [...inboxMessages, ...sentMessages];
  allMessages.sort((a, b) => a.timestamp - b.timestamp);

  return allMessages;
}

/**
 * Read messages from a specific SMS box (inbox or sent).
 */
function readBox(filter: SmsFilter): Promise<SyncMessage[]> {
  return new Promise((resolve) => {
    const SmsAndroid = NativeModules.SmsAndroid;
    if (!SmsAndroid) {
      resolve([]);
      return;
    }

    const jsonFilter: Record<string, unknown> = {
      box: filter.box,
      maxCount: filter.maxCount ?? 100,
    };

    // Filter by date if provided
    if (filter.minDate !== undefined && filter.minDate > 0) {
      jsonFilter.minDate = filter.minDate;
    }

    SmsAndroid.list(
      JSON.stringify(jsonFilter),
      (fail: string) => {
        console.error(`[SmsReader] Failed to read ${filter.box}:`, fail);
        resolve([]);
      },
      (_count: number, smsList: string) => {
        try {
          const records = JSON.parse(smsList) as RawSmsRecord[];
          const messages = records
            .filter((r) => r.address && r.body)
            .map((r) => rawToSyncMessage(r));
          resolve(messages);
        } catch (err) {
          console.error(`[SmsReader] Failed to parse ${filter.box}:`, err);
          resolve([]);
        }
      }
    );
  });
}

/**
 * Convert a raw SMS record to a SyncMessage.
 */
function rawToSyncMessage(raw: RawSmsRecord): SyncMessage {
  const smsType = raw.type ?? SMS_TYPE_INBOX;
  const direction: "inbound" | "outbound" =
    smsType === SMS_TYPE_SENT ? "outbound" : "inbound";

  // Use date_sent if available and non-zero, otherwise use date
  const dateSent = parseInt(raw.date_sent, 10);
  const date = parseInt(raw.date, 10);
  const timestamp = dateSent > 0 ? dateSent : date;

  return {
    sender: normalizePhoneNumber(raw.address),
    body: raw.body,
    timestamp: isNaN(timestamp) ? Date.now() : timestamp,
    threadId: raw.thread_id ?? "",
    direction,
  };
}

/**
 * Get the count of unread SMS messages in the inbox.
 * Useful for displaying badge counts or status information.
 */
export async function getUnreadSmsCount(): Promise<number> {
  if (Platform.OS !== "android") {
    return 0;
  }

  const SmsAndroid = NativeModules.SmsAndroid;
  if (!SmsAndroid) {
    return 0;
  }

  return new Promise((resolve) => {
    const jsonFilter = JSON.stringify({
      box: "inbox",
      read: 0,
      maxCount: 1000,
    });

    SmsAndroid.list(
      jsonFilter,
      () => resolve(0),
      (count: number) => resolve(count)
    );
  });
}
