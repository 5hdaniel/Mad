/**
 * Permission Utilities (Android Companion)
 * Handles runtime permission requests for SMS and Contacts access on Android.
 *
 * TASK-1430: SMS BroadcastReceiver + background sync service
 * BACKLOG-1449: Android contacts sync
 *
 * Required permissions:
 * - READ_SMS: Read messages from the Android SMS content provider
 * - RECEIVE_SMS: Receive real-time SMS broadcast notifications
 * - READ_CONTACTS: Read contacts from the Android Contacts provider
 *
 * These must also be declared in app.json under android.permissions.
 */

import { Platform, PermissionsAndroid } from "react-native";
import * as Contacts from "expo-contacts";

/** Possible states for SMS permissions */
export type SmsPermissionStatus = "granted" | "denied" | "never_ask_again" | "unavailable";

/** Possible states for contacts permissions */
export type ContactsPermissionStatus = "granted" | "denied" | "never_ask_again" | "unavailable";

/** Result of checking/requesting SMS permissions */
export interface SmsPermissionResult {
  readSms: SmsPermissionStatus;
  receiveSms: SmsPermissionStatus;
  /** True if both READ_SMS and RECEIVE_SMS are granted */
  allGranted: boolean;
}

/** Result of checking/requesting contacts permissions */
export interface ContactsPermissionResult {
  readContacts: ContactsPermissionStatus;
  /** True if READ_CONTACTS is granted */
  granted: boolean;
}

/**
 * Check the current state of SMS permissions without requesting them.
 *
 * @returns Current permission status for READ_SMS and RECEIVE_SMS
 */
export async function checkSmsPermissions(): Promise<SmsPermissionResult> {
  if (Platform.OS !== "android") {
    return {
      readSms: "unavailable",
      receiveSms: "unavailable",
      allGranted: false,
    };
  }

  const readResult = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_SMS
  );
  const receiveResult = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
  );

  return {
    readSms: readResult ? "granted" : "denied",
    receiveSms: receiveResult ? "granted" : "denied",
    allGranted: readResult && receiveResult,
  };
}

/**
 * Request SMS permissions from the user.
 * Shows the Android permission dialog if permissions have not been permanently denied.
 *
 * @returns Permission result after the request
 */
export async function requestSmsPermissions(): Promise<SmsPermissionResult> {
  if (Platform.OS !== "android") {
    return {
      readSms: "unavailable",
      receiveSms: "unavailable",
      allGranted: false,
    };
  }

  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);

  const readStatus = mapPermissionResult(
    results[PermissionsAndroid.PERMISSIONS.READ_SMS]
  );
  const receiveStatus = mapPermissionResult(
    results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS]
  );

  return {
    readSms: readStatus,
    receiveSms: receiveStatus,
    allGranted: readStatus === "granted" && receiveStatus === "granted",
  };
}

/**
 * Map Android permission result string to our status type.
 */
function mapPermissionResult(
  result: string | undefined
): SmsPermissionStatus {
  switch (result) {
    case PermissionsAndroid.RESULTS.GRANTED:
      return "granted";
    case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
      return "never_ask_again";
    case PermissionsAndroid.RESULTS.DENIED:
    default:
      return "denied";
  }
}

// ============================================
// CONTACTS PERMISSIONS (BACKLOG-1449)
// ============================================

/**
 * Check the current state of contacts permissions without requesting them.
 * Uses expo-contacts API for consistency with contactReader.ts.
 * BACKLOG-1480: PermissionsAndroid returned wrong results; expo-contacts is authoritative.
 *
 * @returns Current permission status for READ_CONTACTS
 */
export async function checkContactsPermissions(): Promise<ContactsPermissionResult> {
  if (Platform.OS !== "android") {
    return {
      readContacts: "unavailable",
      granted: false,
    };
  }

  const { status } = await Contacts.getPermissionsAsync();

  return {
    readContacts: status === "granted" ? "granted" : "denied",
    granted: status === "granted",
  };
}

/**
 * Request contacts permissions from the user.
 * Uses expo-contacts API for consistency with contactReader.ts.
 * BACKLOG-1480: PermissionsAndroid returned 'never_ask_again' even when granted.
 *
 * @returns Permission result after the request
 */
export async function requestContactsPermissions(): Promise<ContactsPermissionResult> {
  if (Platform.OS !== "android") {
    return {
      readContacts: "unavailable",
      granted: false,
    };
  }

  const response = await Contacts.requestPermissionsAsync();
  const status: ContactsPermissionStatus =
    response.status === "granted"
      ? "granted"
      : response.canAskAgain === false
        ? "never_ask_again"
        : "denied";

  return {
    readContacts: status,
    granted: response.status === "granted",
  };
}
