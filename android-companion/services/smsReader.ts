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
 * Get a reference to the native SMS module.
 *
 * The react-native-get-sms-android library registers itself as "Sms"
 * (see SmsModule.java getName()). Earlier code incorrectly referenced
 * "SmsAndroid" which resolved to undefined, silently returning zero
 * messages on every read.
 *
 * Fix: BACKLOG-1448
 */
function getSmsNativeModule(): typeof NativeModules.Sms | null {
  const mod = NativeModules.Sms;
  if (!mod) {
    console.warn("[SmsReader] Sms native module not available");
    return null;
  }
  return mod;
}

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
    console.log("[SmsReader] Skipping — not Android");
    return [];
  }

  if (!getSmsNativeModule()) {
    return [];
  }

  console.log(
    `[SmsReader] Reading SMS since=${sinceTimestamp} (${sinceTimestamp > 0 ? new Date(sinceTimestamp).toISOString() : "epoch"}) maxCount=${maxCount}`
  );

  // Read from both inbox and sent
  const [inboxMessages, sentMessages] = await Promise.all([
    readBox({ box: "inbox", minDate: sinceTimestamp, maxCount }),
    readBox({ box: "sent", minDate: sinceTimestamp, maxCount }),
  ]);

  // Combine, sort by timestamp ascending
  const allMessages = [...inboxMessages, ...sentMessages];
  allMessages.sort((a, b) => a.timestamp - b.timestamp);

  console.log(
    `[SmsReader] Found ${inboxMessages.length} inbox + ${sentMessages.length} sent = ${allMessages.length} total`
  );

  return allMessages;
}

/**
 * Read messages from a specific SMS box (inbox or sent).
 */
function readBox(filter: SmsFilter): Promise<SyncMessage[]> {
  return new Promise((resolve) => {
    const smsModule = getSmsNativeModule();
    if (!smsModule) {
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

    console.log(
      `[SmsReader] Querying ${filter.box} with filter:`,
      JSON.stringify(jsonFilter)
    );

    smsModule.list(
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
            .map((r) => rawToSyncMessage(r, filter.box));
          console.log(
            `[SmsReader] ${filter.box}: ${records.length} raw records -> ${messages.length} valid messages`
          );
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
 *
 * Direction is determined primarily by which box was queried (inbox vs sent),
 * since the native module may not always return a reliable `type` field.
 * The `raw.type` is used as a secondary signal only when `box` is not provided.
 *
 * BACKLOG-1459: raw.type was undefined/null for some sent-box queries, causing
 * the `?? SMS_TYPE_INBOX` fallback to mark all messages as inbound.
 */
function rawToSyncMessage(raw: RawSmsRecord, box?: "inbox" | "sent"): SyncMessage {
  // Primary: use the box we explicitly queried
  // Fallback: use raw.type from the native module
  const direction: "inbound" | "outbound" = box
    ? (box === "sent" ? "outbound" : "inbound")
    : ((raw.type ?? SMS_TYPE_INBOX) === SMS_TYPE_SENT ? "outbound" : "inbound");

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

  const smsModule = getSmsNativeModule();
  if (!smsModule) {
    return 0;
  }

  return new Promise((resolve) => {
    const jsonFilter = JSON.stringify({
      box: "inbox",
      read: 0,
      maxCount: 1000,
    });

    smsModule.list(
      jsonFilter,
      () => resolve(0),
      (count: number) => resolve(count)
    );
  });
}
