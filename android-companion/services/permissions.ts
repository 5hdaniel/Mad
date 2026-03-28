/**
 * SMS Permission Utilities (Android Companion)
 * Handles runtime permission requests for SMS access on Android.
 *
 * TASK-1430: SMS BroadcastReceiver + background sync service
 *
 * Required permissions:
 * - READ_SMS: Read messages from the Android SMS content provider
 * - RECEIVE_SMS: Receive real-time SMS broadcast notifications
 *
 * These must also be declared in app.json under android.permissions.
 */

import { Platform, PermissionsAndroid } from "react-native";

/** Possible states for SMS permissions */
export type SmsPermissionStatus = "granted" | "denied" | "never_ask_again" | "unavailable";

/** Result of checking/requesting SMS permissions */
export interface SmsPermissionResult {
  readSms: SmsPermissionStatus;
  receiveSms: SmsPermissionStatus;
  /** True if both READ_SMS and RECEIVE_SMS are granted */
  allGranted: boolean;
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
